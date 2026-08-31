import { User } from "../../entities/user/User.js";

export interface IUserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  add(user: Partial<User> & { id: string; email: string }): Promise<User>;
  update(id: string, updates: Partial<Omit<User, "id" | "createdAt">>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}
