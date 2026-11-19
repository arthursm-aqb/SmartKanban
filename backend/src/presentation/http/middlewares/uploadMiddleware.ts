import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { DomainValidationError } from '../../../domain/errors';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.md', '.markdown', '.txt']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
  'application/octet-stream',
]);

function getExtension(fileName: string): string {
  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx === -1 ? '' : fileName.slice(dotIdx).toLowerCase();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = getExtension(file.originalname);
    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(
        new DomainValidationError(
          'Arquivo não suportado. Envie apenas documentos .pdf, .md ou .txt (máx. 5MB).',
        ),
      );
      return;
    }
    cb(null, true);
  },
});

const utf8FatalDecoder = new TextDecoder('utf-8', { fatal: true });

export const uploadContextDocumentMiddleware: RequestHandler[] = [
  upload.single('contextFile'),
  (req: Request, _res: Response, next: NextFunction) => {
    const file = req.file;
    if (!file) {
      next(
        new DomainValidationError(
          'Envie o arquivo de visão geral do sistema (.pdf, .md ou .txt) no campo "contextFile".',
        ),
      );
      return;
    }

    const ext = getExtension(file.originalname);
    if (ext === '.pdf') {
      if (file.buffer.length < 5 || file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        next(
          new DomainValidationError(
            'Arquivo PDF rejeitado: assinatura binária (magic bytes %PDF-) inválida.',
          ),
        );
        return;
      }
    } else {
      if (file.buffer.includes(0x00)) {
        next(
          new DomainValidationError(
            'Arquivo de texto rejeitado: conteúdo binário detectado em arquivo .md/.txt.',
          ),
        );
        return;
      }
      try {
        utf8FatalDecoder.decode(file.buffer);
      } catch {
        next(
          new DomainValidationError('Arquivo de texto rejeitado: codificação UTF-8 inválida.'),
        );
        return;
      }
    }

    next();
  },
];
