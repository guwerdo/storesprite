import "reflect-metadata";
import { injectable } from "inversify";
import { io, Socket } from "socket.io-client";
import { ISocketService } from "../types/SocketService.interface.js";

@injectable()
export class SocketService implements ISocketService {
  private _socket: Socket | null = null;
  private _userId: string | null = null;

  public connect(userId?: string): void {
    if (userId) {
      this._userId = userId;
    }

    if (this._socket && this._socket.connected) {
      if (this._userId) {
        this.joinTenant(this._userId);
      }
      return;
    }

    const backendUrl = typeof import.meta.env.VITE_API_URL === 'string'
      ? import.meta.env.VITE_API_URL
      : 'http://localhost:3000';
    this._socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    this._socket.on("connect", () => {
      if (this._userId) {
        this.joinTenant(this._userId);
      }
    });
  }

  public joinTenant(userId: string): void {
    this._userId = userId;
    if (this._socket && this._socket.connected) {
      this._socket.emit("join_tenant", { userId });
    }
  }

  public on<T>(event: string, callback: (data: T) => void): void {
    if (!this._socket) {
      this.connect();
    }
    this._socket?.on(event, callback as (...args: unknown[]) => void);
  }

  public off<T>(event: string, callback?: (data: T) => void): void {
    if (callback) {
      this._socket?.off(event, callback as (...args: unknown[]) => void);
    } else {
      this._socket?.off(event);
    }
  }

  public disconnect(): void {
    if (this._socket) {
      this._socket.disconnect();
      this._socket = null;
    }
  }
}
