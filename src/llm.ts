import { Server } from './server';
import { LLMOptions } from './config';
import {
  Action,
  C2S,
  C2SMessageActionsForce,
  C2SMessageActionsRegister,
  C2SMessageActionsResult,
  C2SMessageActionsUnregister,
  C2SMessageContext,
  C2SMessageStartup,
  S2C,
  S2CMessageAction,
} from './sdk_types';
import ollama, { ChatRequest, ChatResponse, Message, Options } from 'ollama';
import EventEmitter from 'events';
import util from 'util';

interface ActionChoiceResponse {
  message: string;
  action: string;
}

export class LargeLanguageModelHandler extends EventEmitter {
  private readonly model: string;
  private readonly ollamaOptions: Partial<Options>;

  private periodicTimeout?: NodeJS.Timeout;
  private readonly periodicTimeoutTime?: number;

  private responding: boolean = false;
  private hasForcedResponse: boolean = false;
  private waitingForResult: boolean = false;
  private actionResults: Map<string, C2SMessageActionsResult>;
  private actions: Map<string, Action>;
  private context: Array<Message>;

  private ids: number = 0;

  constructor(server: Server, opts: LLMOptions) {
    super();
    this.model = opts.model;
    this.ollamaOptions = opts.ollamaOptions || {};
    this.periodicTimeoutTime = opts.periodicTimeoutTime;

    this.actions = new Map();
    this.actionResults = new Map();
    this.context = new Array({
      role: 'system',
      content: 'You play games. Use actions to interact with the game.',
    });

    this.registerEvents(server);
    this.initializePeriodicResponse();
  }

  private initializePeriodicResponse() {
    if (this.periodicTimeoutTime) {
      this.periodicTimeout = setTimeout(() => {
        this.periodicResponse();
      }, this.periodicTimeoutTime);
    }
  }

  private async getResponse(
    messages: Array<Message>,
    format?: object,
  ): Promise<ChatResponse> {
    try {
      this.responding = true;
      console.log(
        `-Ollama-> ${util.inspect(messages.at(-1), false, null, true)}`,
      );

      const response = await ollama.chat({
        model: this.model,
        options: this.ollamaOptions,
        messages: messages,
        format: format,
      });

      console.log(
        `<-Ollama- ${util.inspect(response.message, false, null, true)}`,
      );
      return response;
    } finally {
      this.responding = false;
    }
  }

  private async parseActionChoice(
    response: ChatResponse,
  ): Promise<ActionChoiceResponse | null> {
    try {
      return JSON.parse(response.message.content);
    } catch (error) {
      console.error('Failed to parse action choice:', error);
      return null;
    }
  }

  private async periodicResponse(): Promise<ActionChoiceResponse | null> {
    // Periodic response requests are skipped if it is already responding, unlike action response requests which are queued.
    if (this.responding || this.hasForcedResponse || this.actions.size === 0) {
      return null;
    }

    const actionNames = Array.from(this.actions.keys());
    const periodicPrompt = {
      role: 'user',
      content: `You have the following actions available: ${JSON.stringify(
        actionNames,
      )}. Respond with a message describing what you want to do and the name of the action you want to take. Respond in JSON.`,
    };

    try {
      this.context.push(periodicPrompt);
      const response = await this.getResponse(this.context, {
        type: 'object',
        properties: {
          message: {
            type: 'string',
          },
          action: {
            type: 'string',
            enum: actionNames,
          },
        },
        required: ['message'],
      });

      this.context.push(response.message);
      const actionChoice = await this.parseActionChoice(response);

      if (this.periodicTimeoutTime) {
        this.periodicTimeout = setTimeout(
          () => this.periodicResponse(),
          this.periodicTimeoutTime,
        );
      }

      return actionChoice;
    } catch (error) {
      console.error('Periodic response error:', error);
      return null;
    }
  }

  private async forceResponse(
    state: string | null,
    query: string,
    ephemeralContext: boolean,
    actionNames: string[],
  ) {
    const forcePrompt = {
      role: 'user',
      content: `${
        state ? `The current state of the game is: ${state}. ` : ''
      }${query} Respond with a message describing what you want to do and the name of the action you want to take. Choose one of the following actions: ${JSON.stringify(
        actionNames,
      )}. Respond in JSON.`,
    };

    // Use a copy instead if ephemeral, so that we don't modify the original. Using the copy means state and query is not "remembered".
    const contextToUse = ephemeralContext ? [...this.context] : this.context;
    contextToUse.push(forcePrompt);

    try {
      const response = await this.getResponse(contextToUse, {
        type: 'object',
        properties: {
          message: {
            type: 'string',
          },
          action: {
            type: 'string',
            enum: actionNames,
          },
        },
        required: ['message', 'action'],
      });

      this.context.push(response.message);
      return await this.parseActionChoice(response);
    } catch (error) {
      console.error('Force response error:', error);
      return null;
    }
  }

  private async doAction(actionName: string): Promise<boolean> {
    const action = this.actions.get(actionName);
    if (!action) {
      throw new Error(`Action ${actionName} not found.`);
    }

    let schema: object;
    try {
      if (typeof action.schema === 'string') {
        schema = JSON.parse(action.schema);
      } else {
        schema = action.schema;
      }
    } catch (error) {
      throw new Error(`Invalid schema for action ${actionName}: ${error}`);
    }

    const id = (this.ids++).toString();
    const doActionPrompt = {
      role: 'user',
      content: `You are doing the following action: ${actionName}. ${action.description} Respond in JSON.`,
    };
    this.context.push(doActionPrompt);
    const response = await this.getResponse(this.context, schema);
    this.context.push(response.message);

    this.emit('send', {
      command: S2C.ACTION,
      data: {
        id: id,
        name: actionName,
        data: response.message.content,
      },
    } as S2CMessageAction);

    await this.waitForResult(id);
    const actionResult = this.actionResults.get(id);

    if (!actionResult) {
      throw new Error('No action result received.');
    }

    if (actionResult.data.message) {
      this.context.push({
        role: 'user',
        content: actionResult.data.message,
      });
    }

    return actionResult.data.bool;
  }

  public async waitForNotResponding() {
    while (this.responding) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  public async waitForResult(id: string) {
    while (!this.actionResults.has(id)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  public cleanup() {
    if (this.periodicTimeout) {
      clearTimeout(this.periodicTimeout);
    }
  }

  // Events
  private registerEvents(server: Server) {
    server.on(C2S.STARTUP, this.handleStartup.bind(this));
    server.on(C2S.CONTEXT, this.handleContext.bind(this));
    server.on(C2S.ACTIONS_REGISTER, this.handleActionsRegister.bind(this));
    server.on(C2S.ACTIONS_UNREGISTER, this.handleActionsUnregister.bind(this));
    server.on(C2S.ACTIONS_FORCE, this.handleActionsForce.bind(this));
    server.on(C2S.ACTIONS_RESULT, this.handleActionsResult.bind(this));
  }

  private handleStartup(data: C2SMessageStartup) {
    this.context.push({
      role: 'user',
      content: `A game of ${data.game} has started.`,
    });
  }

  private handleContext(data: C2SMessageContext) {
    this.context.push({
      role: 'user',
      content: data.data.message,
    });
  }

  private handleActionsRegister(data: C2SMessageActionsRegister) {
    for (const action of data.data.actions) {
      this.actions.set(action.name, action);
    }
  }

  private handleActionsUnregister(data: C2SMessageActionsUnregister) {
    for (const actionName of data.data.action_names) {
      this.actions.delete(actionName);
    }
  }

  private async handleActionsForce(data: C2SMessageActionsForce) {
    this.hasForcedResponse = true;
    await this.waitForNotResponding();

    let actionChoice: ActionChoiceResponse | null = null;
    while (!actionChoice) {
      actionChoice = await this.forceResponse(
        data.data.state || null,
        data.data.query,
        data.data.ephemeral_context || false,
        data.data.action_names,
      );
    }

    try {
      await this.doAction(actionChoice.action);
    } catch (error) {
      console.error('Failed to execute forced action:', error);
    } finally {
      this.hasForcedResponse = false;
    }
  }

  private handleActionsResult(data: C2SMessageActionsResult) {
    this.actionResults.set(data.data.id, data);
  }
}
