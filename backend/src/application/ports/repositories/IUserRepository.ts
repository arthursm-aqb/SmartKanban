import { User } from '../../../domain/entities/User';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
}
