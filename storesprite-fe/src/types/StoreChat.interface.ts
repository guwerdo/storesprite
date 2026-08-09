export interface IChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}
