import {
  IDocumentParser,
  IDocumentParserRegistry,
  ParsedDocument,
  UploadedDocument,
} from '../../application/ports/services/IDocumentParser';
import { DomainValidationError } from '../../domain/errors';

const MAX_CONTEXT_CHARS = 50_000;

export class DocumentParserRegistry implements IDocumentParserRegistry {
  constructor(private readonly parsers: ReadonlyArray<IDocumentParser>) {}

  public async parse(file: UploadedDocument): Promise<ParsedDocument> {
    const parser = this.parsers.find((candidate) =>
      candidate.supports(file.originalName, file.mimeType),
    );
    if (!parser) {
      throw new DomainValidationError(
        'Formato de arquivo não suportado. Envie um documento .pdf, .md ou .txt.',
      );
    }

    const extracted = await parser.parse(file.buffer);
    const trimmed = extracted.slice(0, MAX_CONTEXT_CHARS).trim();

    return {
      fileName: file.originalName,
      fileType: parser.fileType,
      text: trimmed,
    };
  }
}
