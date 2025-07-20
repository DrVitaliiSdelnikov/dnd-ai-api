interface AngularChatMessage {
  role: string;
  content: string;
}

interface SummarizeRequestBody {
  messages: AngularChatMessage[];
  existingSummary?: string;
}
