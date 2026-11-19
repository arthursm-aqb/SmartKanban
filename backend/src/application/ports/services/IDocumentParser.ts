import { ContextFileType } from '../../../domain/entities/Team';

export interface UploadedDocument {
  originalName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ParsedDocument {
  fileName: string;
  fileType: ContextFileType;
  text: string;
}

export interface IDocumentParser {
  readonly fileType: ContextFileType;
  supports(fileName: string, mimeType: string): boolean;
  parse(buffer: Buffer): Promise<string>;
}

export interface IDocumentParserRegistry {
  parse(file: UploadedDocument): Promise<ParsedDocument>;
}
