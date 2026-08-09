import { User } from "../entities/User.js";

export interface IUserService {
  getUserById(id: string): Promise<User | null>;
  createUser(id: string, email: string, name?: string): Promise<User>;
}
