import { IDocumentParser } from '../../application/ports/services/IDocumentParser';
import { ContextFileType } from '../../domain/entities/Team';
import { DomainValidationError } from '../../domain/errors';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

export function decodeValidatedUtf8(buffer: Buffer, label: string): string {
  if (buffer.includes(0x00)) {
    throw new DomainValidationError(`Arquivo ${label} inválido: conteúdo binário detectado.`);
  }
  try {
    return utf8Decoder.decode(buffer).replace(/\r\n/g, '\n').trim();
  } catch {
    throw new DomainValidationError(`Arquivo ${label} inválido: codificação UTF-8 inválida.`);
  }
}

export class MarkdownDocumentParser implements IDocumentParser {
  public readonly fileType = ContextFileType.MD;

  public supports(fileName: string, mimeType: string): boolean {
    const lower = fileName.toLowerCase();
    return (
      (lower.endsWith('.md') || lower.endsWith('.markdown')) &&
      (mimeType === 'text/markdown' ||
        mimeType === 'text/plain' ||
        mimeType === 'text/x-markdown' ||
        mimeType === 'application/octet-stream')
    );
  }

  public async parse(buffer: Buffer): Promise<string> {
    return decodeValidatedUtf8(buffer, 'Markdown (.md)');
  }
}
