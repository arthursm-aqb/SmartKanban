import { DomainValidationError } from '../errors';

export class WipLimit {
  public readonly value: number | null;

  private constructor(value: number | null) {
    this.value = value;
  }

  public static create(value: number | null): WipLimit {
    if (value === null) {
      return new WipLimit(null);
    }
    if (!Number.isInteger(value) || value < 1 || value > 99) {
      throw new DomainValidationError(
        `Limite WIP deve ser nulo (sem limite) ou um inteiro entre 1 e 99 (recebido: ${String(value)}).`,
      );
    }
    return new WipLimit(value);
  }

  public isUnlimited(): boolean {
    return this.value === null;
  }
}
