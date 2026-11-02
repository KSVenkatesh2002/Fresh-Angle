export interface GenerateTextOptions {
  system?: string;
  prompt: string;
  json?: boolean;
  temperature?: number;
}

export interface AiGenerationResult {
  text: string;
  model: string;
  provider: string;
}

export interface AiProvider {
  readonly id: string;
  readonly name: string;
  generateText(options: GenerateTextOptions): Promise<AiGenerationResult>;
}

export class AiProviderError extends Error {
  public readonly provider: string;
  public readonly statusCode?: number;
  public readonly originalError?: unknown;

  constructor(
    provider: string,
    message: string,
    statusCode?: number,
    originalError?: unknown
  ) {
    super(`[AI Provider: ${provider}] ${message}`);
    this.name = 'AiProviderError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}
