import { Options } from 'ollama';

export interface LLMOptions {
  model: string;
  contextLength: number;
  periodicTimeoutTime?: number;
  periodicPrompt?: string;
  ollamaOptions?: Partial<Options>;
}

interface ServerOptions {
  port: number;
}

export interface AppConfig {
  llmOptions: LLMOptions;
  serverOptions: ServerOptions;
}

export const config: AppConfig = {
  llmOptions: {
    model: 'llama3.2:latest',
    contextLength: 8192,
    periodicTimeoutTime: 1000 * 10, // 10 seconds
    ollamaOptions: {
      temperature: 0.85,
      num_ctx: 8192,
    },
  },
  serverOptions: {
    port: 8000,
  },
};
