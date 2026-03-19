import { ChatOrchestrator } from '@/application/chat/chatOrchestrator';

export type ChatService = ChatOrchestrator;

export const chatService = new ChatOrchestrator();
