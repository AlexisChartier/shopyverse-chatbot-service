export enum Role {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export interface ChatMessage {
  role: Role;
  content: string;
  metadata?: Record<string, any>;
}

// Interface générique pour les outils (Tools)
export interface Tool {
  name: string;
  description: string;
  execute(args: any): Promise<any>;
}