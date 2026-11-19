import { DomainError } from './DomainError';

export class UnauthorizedError extends DomainError {
  constructor(message = 'Autenticação necessária.', details?: Record<string, unknown>) {
    super('UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Você não tem permissão para executar esta ação.', details?: Record<string, unknown>) {
    super('FORBIDDEN', message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, details?: Record<string, unknown>) {
    super('NOT_FOUND', `${entity} não encontrado(a).`, details);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, details);
  }
}

export class DomainValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('DOMAIN_VALIDATION_ERROR', message, details);
  }
}
