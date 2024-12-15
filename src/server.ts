import { EventEmitter } from 'events';
import { LargeLanguageModelHandler } from './llm';
import { WebSocketServer } from 'ws';
import { AppConfig } from './config';
import { C2SMessage, S2CMessage } from './sdk_types';
import util from 'util';

export class Server extends EventEmitter {
  private wss: WebSocketServer;
  private llm: LargeLanguageModelHandler;

  constructor(cfg: AppConfig) {
    super();
    this.wss = new WebSocketServer({ port: cfg.serverOptions.port });
    this.llm = new LargeLanguageModelHandler(this, cfg.llmOptions);

    this.events(this.wss);

    this.llm.on('send', (message) => this.broadcast(message as S2CMessage));
  }

  private events(wss: WebSocketServer) {
    wss.on('connection', (ws) => {
      console.log('WebSocket connection opened');

      ws.on('message', (message: BinaryData) => {
        this.handleMessage(message);
      });

      ws.on('error', (error: string) => {
        console.error(error);
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });
    });
  }

  private broadcast(message: S2CMessage) {
    console.log(`--S2C--> ${util.inspect(message, false, null, true)}`);

    for (const connection of this.wss.clients) {
      connection.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: BinaryData) {
    try {
      const c2sMessage = JSON.parse(message.toString()) as C2SMessage;
      console.log(`<--C2S-- ${util.inspect(c2sMessage, false, null, true)}`);
      this.emit(c2sMessage.command, c2sMessage);
    } catch (error) {
      // JSON Errors are ignored by the Server. It's the Client's responsibility to send valid JSON.
      console.error(error);
    }
  }
}
