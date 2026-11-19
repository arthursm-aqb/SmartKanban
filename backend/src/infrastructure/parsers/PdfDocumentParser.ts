import { createRequire } from 'module';
import path from 'path';
import { IDocumentParser } from '../../application/ports/services/IDocumentParser';
import { ContextFileType } from '../../domain/entities/Team';
import { DomainValidationError } from '../../domain/errors';

type PdfParseFn = (data: Uint8Array) => Promise<{ text: string }>;

function loadPdfParse(): PdfParseFn {
  const req = createRequire(path.resolve(__dirname, '../../../package.json'));
  const mod = req('pdf-parse/lib/pdf-parse.js') as PdfParseFn | { default: PdfParseFn };
  return typeof mod === 'function' ? mod : mod.default;
}

const pdfParse = loadPdfParse();

const PDF_MAGIC_HEADER = '%PDF-';

export class PdfDocumentParser implements IDocumentParser {
  public readonly fileType = ContextFileType.PDF;

  public supports(fileName: string, mimeType: string): boolean {
    const lower = fileName.toLowerCase();
    return lower.endsWith('.pdf') && (mimeType === 'application/pdf' || mimeType === 'application/octet-stream');
  }

  public async parse(buffer: Buffer): Promise<string> {
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== PDF_MAGIC_HEADER) {
      throw new DomainValidationError(
        'Arquivo PDF inválido: assinatura binária (magic bytes %PDF-) não reconhecida.',
      );
    }

    try {
      // Pass an isolated Uint8Array (byteOffset === 0) so pdf-parse/pdf.js
      // never reads adjacent bytes in Node's shared Buffer pool.
      const isolated = Uint8Array.from(buffer);
      const parsed = await pdfParse(isolated);
      return parsed.text.replace(/\r\n/g, '\n').trim();
    } catch (err) {
      throw new DomainValidationError('Não foi possível extrair texto do arquivo PDF enviado.', {
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
