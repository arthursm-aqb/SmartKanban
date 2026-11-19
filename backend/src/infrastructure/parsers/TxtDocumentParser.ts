import { IDocumentParser } from '../../application/ports/services/IDocumentParser';
import { ContextFileType } from '../../domain/entities/Team';
import { decodeValidatedUtf8 } from './MarkdownDocumentParser';

export class TxtDocumentParser implements IDocumentParser {
  public readonly fileType = ContextFileType.TXT;

  public supports(fileName: string, mimeType: string): boolean {
    const lower = fileName.toLowerCase();
    return (
      lower.endsWith('.txt') &&
      (mimeType === 'text/plain' || mimeType === 'application/octet-stream')
    );
  }

  public async parse(buffer: Buffer): Promise<string> {
    return decodeValidatedUtf8(buffer, 'Texto (.txt)');
  }
}
