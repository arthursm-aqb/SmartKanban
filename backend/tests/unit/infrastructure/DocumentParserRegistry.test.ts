import { describe, expect, it } from 'vitest';
import { ContextFileType } from '../../../src/domain/entities/Team';
import { DomainValidationError } from '../../../src/domain/errors';
import { DocumentParserRegistry } from '../../../src/infrastructure/parsers/DocumentParserRegistry';
import { MarkdownDocumentParser } from '../../../src/infrastructure/parsers/MarkdownDocumentParser';
import { PdfDocumentParser } from '../../../src/infrastructure/parsers/PdfDocumentParser';
import { TxtDocumentParser } from '../../../src/infrastructure/parsers/TxtDocumentParser';

function createMinimalValidPdfBuffer(text: string): Buffer {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const streamContent = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(streamContent, 'utf8')} >> stream\n${streamContent}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

describe('DocumentParserRegistry (OCP + Magic Bytes)', () => {
  const registry = new DocumentParserRegistry([
    new PdfDocumentParser(),
    new MarkdownDocumentParser(),
    new TxtDocumentParser(),
  ]);

  it('extrai texto de arquivo .md', async () => {
    const parsed = await registry.parse({
      originalName: 'visao_geral.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Kanban Inteligente\nSistema colaborativo em tempo real.', 'utf8'),
    });
    expect(parsed.fileType).toBe(ContextFileType.MD);
    expect(parsed.text).toContain('Kanban Inteligente');
  });

  it('extrai texto de arquivo .txt', async () => {
    const parsed = await registry.parse({
      originalName: 'arquitetura.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Visão geral do projeto em texto puro.', 'utf8'),
    });
    expect(parsed.fileType).toBe(ContextFileType.TXT);
    expect(parsed.text).toBe('Visão geral do projeto em texto puro.');
  });

  it('extrai texto de arquivo .pdf válido com assinatura %PDF-', async () => {
    const pdfBuffer = createMinimalValidPdfBuffer('Visao Geral PDF Kanban');
    const parsed = await registry.parse({
      originalName: 'visao.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    });
    expect(parsed.fileType).toBe(ContextFileType.PDF);
    expect(parsed.text).toContain('Visao Geral PDF Kanban');
  });

  it('rejeita arquivo .pdf falsificado sem magic bytes %PDF-', async () => {
    await expect(
      registry.parse({
        originalName: 'falso.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('NOT A REAL PDF FILE CONTENT', 'utf8'),
      }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('rejeita binário disfarçado de .md', async () => {
    await expect(
      registry.parse({
        originalName: 'malicioso.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from([0x4d, 0x5a, 0x00, 0x90, 0x00]),
      }),
    ).rejects.toThrow(DomainValidationError);
  });

  it('rejeita extensão não suportada (.exe)', async () => {
    await expect(
      registry.parse({
        originalName: 'script.exe',
        mimeType: 'application/octet-stream',
        buffer: Buffer.from('binary'),
      }),
    ).rejects.toThrow(DomainValidationError);
  });
});
