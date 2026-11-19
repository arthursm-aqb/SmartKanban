import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import {
  ConflictError,
  DomainError,
  DomainValidationError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  WipLimitExceededError,
} from '../../../domain/errors';

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: 'O arquivo excede o tamanho máximo permitido de 5MB.',
      });
      return;
    }
    res.status(400).json({
      error: 'UPLOAD_ERROR',
      message: 'Erro ao processar o upload do arquivo.',
    });
    return;
  }

  if (err instanceof WipLimitExceededError) {
    res.status(422).json({
      error: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.code, message: err.message });
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.code, message: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.code, message: err.message });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.code, message: err.message });
    return;
  }

  if (err instanceof DomainValidationError || err instanceof DomainError) {
    res.status(400).json({ error: err.code, message: err.message, details: err.details });
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.error('[Unhandled HTTP Error]', err);
  }
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor.',
  });
}
