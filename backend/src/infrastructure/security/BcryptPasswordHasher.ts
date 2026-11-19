import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../../application/ports/services/IPasswordHasher';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly saltRounds: number = 12) {}

  public async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.saltRounds);
  }

  public async compare(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash);
  }
}
