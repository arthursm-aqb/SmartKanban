import { DomainValidationError } from '../errors';

const INVITE_CODE_REGEX = /^[A-Z0-9]{8}$/;

export class InviteCode {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(raw: string): InviteCode {
    const normalized = raw.trim().toUpperCase();
    if (!INVITE_CODE_REGEX.test(normalized)) {
      throw new DomainValidationError(
        'Código de convite inválido. Deve conter exatamente 8 caracteres alfanuméricos.',
      );
    }
    return new InviteCode(normalized);
  }
}
