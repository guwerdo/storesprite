export interface ISocketService {
  connect(userId?: string): void;
  disconnect(): void;
  joinTenant(userId: string): void;
  on<T>(event: string, callback: (data: T) => void): void;
  off<T>(event: string, callback?: (data: T) => void): void;
}
