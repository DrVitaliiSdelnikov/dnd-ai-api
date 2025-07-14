export interface AngularChatMessage {
  role: string;
  content: string;
}

export interface GeminiMessagePart {
  text: string;
}

export interface GeminiMessage {
  role: string;
  parts: GeminiMessagePart[];
}

export interface GeminiRequestBody {
  contents: GeminiMessage[];
  systemInstruction?: {
    parts: GeminiMessagePart[];
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}
