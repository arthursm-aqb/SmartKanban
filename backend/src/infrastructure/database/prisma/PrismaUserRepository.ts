import { PrismaClient } from '@prisma/client';
import { CreateUserData, IUserRepository } from '../../../application/ports/repositories/IUserRepository';
import { User } from '../../../domain/entities/User';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
      },
    });
  }
}
