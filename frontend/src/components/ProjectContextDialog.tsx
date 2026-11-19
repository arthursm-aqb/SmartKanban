import { RetroDialog } from './RetroDialog';

interface ProjectContextDialogProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  fileName: string;
  fileType: string;
  contextText: string;
}

export function ProjectContextDialog({
  open,
  onClose,
  projectName,
  fileName,
  fileType,
  contextText,
}: ProjectContextDialogProps) {
  return (
    <RetroDialog open={open} title={`Visão Geral do Sistema — ${projectName}`} onClose={onClose}>
      <div className="mono" style={{ fontSize: '0.8rem', marginBottom: 8, color: 'var(--win-muted)' }}>
        Arquivo carregado: {fileName} ({fileType}) — usado como reforço de contexto pelo Gemini
        Decisions
      </div>
      <pre
        className="win-sunken mono"
        style={{
          padding: 12,
          margin: 0,
          whiteSpace: 'pre-wrap',
          maxHeight: '55vh',
          overflowY: 'auto',
          fontSize: '0.84rem',
        }}
      >
        {contextText}
      </pre>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="win-btn win-btn-primary" onClick={onClose}>
          Fechar
        </button>
      </div>
    </RetroDialog>
  );
}
