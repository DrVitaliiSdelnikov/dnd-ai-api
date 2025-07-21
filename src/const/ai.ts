export const AiParams = {
  temperature: 0.75,
  maxOutputTokens: 8192,
};

export const AiModelName = `gemini-2.5-flash-preview-05-20`;

export function getGeminiApiUrl(googleApiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${AiModelName}:generateContent?key=${googleApiKey}`;
}

export enum ChatRoles {
  assistant = 'assistant',
  system = 'system',
  user = 'user',
  model = 'model',
}
