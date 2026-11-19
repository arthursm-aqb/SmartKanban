import crypto from 'crypto';
import { IInviteCodeGenerator } from '../../application/ports/services/IInviteCodeGenerator';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export class CryptoInviteCodeGenerator implements IInviteCodeGenerator {
  public generate(): string {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    let result = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      result += ALPHABET[bytes[i]! % ALPHABET.length]!;
    }
    return result;
  }
}
