import { EventEmitter } from 'events';
import { LargeLanguageModelHandler } from './llm';
import { WebSocketServer } from 'ws';
import { AppConfig } from './config';
import { C2SMessage, S2CMessage } from './sdk_types';

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
    for (const connection of this.wss.clients) {
      connection.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: BinaryData) {
    try {
      const messageString = message.toString();
      console.log(`Received: ${messageString}`);
      const data = JSON.parse(messageString) as C2SMessage;
      this.emit(data.command, data);
    } catch (error) {
      // JSON Errors are ignored by the Server. It's the Client's responsibility to send valid JSON.
      console.error(error);
    }
  }
}
