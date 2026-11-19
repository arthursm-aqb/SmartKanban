import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Copy,
  FileText,
  History,
  Kanban,
  StickyNote,
  Users,
  X,
} from 'lucide-react';
import { ActivityLogTab } from '../components/ActivityLogTab';
import { DesktopTopBar } from '../components/DesktopTopBar';
import { KanbanBoard } from '../components/KanbanBoard';
import { ProjectContextDialog } from '../components/ProjectContextDialog';
import { StickyNotesBoard } from '../components/StickyNotesBoard';
import { BoardRealtimeProvider, useBoardRealtime } from '../contexts/BoardRealtimeContext';

type WorkspaceTab = 'kanban' | 'notes' | 'activity';

function WorkspaceContent() {
  const {
    snapshot,
    onlineUsers,
    wsStatus,
    errorMessage,
    statusBanner,
    clearError,
  } = useBoardRealtime();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('kanban');
  const [contextOpen, setContextOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  useEffect(() => {
    if (snapshot) {
      document.title = `${snapshot.project.name} | Smart Kanban`;
    }
  }, [snapshot]);

  const copyInvite = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(snapshot.team.inviteCode);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="desktop-shell">
      <a href="#workspace-main" className="skip-link visually-hidden">
        Ir para o quadro do projeto
      </a>

      <DesktopTopBar backToTeams projectTitle={snapshot?.project.name} />

      <main
        id="workspace-main"
        tabIndex={-1}
        className="win-window"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {/* Window Titlebar + Team Toolbar */}
        <div className="win-titlebar">
          <div className="win-titlebar-left">
            <h1 style={{ margin: 0, fontSize: '0.96rem' }}>
              {snapshot
                ? `${snapshot.team.name} — ${snapshot.project.name}`
                : 'Conectando ao Workspace...'}
            </h1>
          </div>

          {snapshot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="win-btn mono"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: '0.78rem' }}
                onClick={() => void copyInvite()}
              >
                <Copy size={12} aria-hidden="true" />
                {copiedInvite ? 'Convite Copiado!' : `Convite: ${snapshot.team.inviteCode}`}
              </button>

              <button
                type="button"
                className="win-btn"
                style={{ minHeight: 26, padding: '2px 8px', fontSize: '0.78rem' }}
                onClick={() => setContextOpen(true)}
              >
                <FileText size={12} aria-hidden="true" />
                Visão Geral ({snapshot.project.contextFileType})
              </button>
            </div>
          )}
        </div>

        {/* Classic Win95 Navigation Tabs */}
        <div className="win-tabs" role="tablist" aria-label="Áreas do Projeto">
          <button
            type="button"
            role="tab"
            id="tab-kanban"
            aria-selected={activeTab === 'kanban'}
            aria-controls="panel-kanban"
            className="win-tab"
            onClick={() => setActiveTab('kanban')}
          >
            <Kanban size={15} aria-hidden="true" />
            Quadro Kanban
          </button>

          <button
            type="button"
            role="tab"
            id="tab-notes"
            aria-selected={activeTab === 'notes'}
            aria-controls="panel-notes"
            className="win-tab"
            onClick={() => setActiveTab('notes')}
          >
            <StickyNote size={15} aria-hidden="true" />
            Quadro de Anotações ({snapshot?.notes.length ?? 0})
          </button>

          <button
            type="button"
            role="tab"
            id="tab-activity"
            aria-selected={activeTab === 'activity'}
            aria-controls="panel-activity"
            className="win-tab"
            onClick={() => setActiveTab('activity')}
          >
            <History size={15} aria-hidden="true" />
            Histórico de Ações ({snapshot?.activityLogs.length ?? 0})
          </button>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="win-banner-error"
            style={{
              margin: '10px 12px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>{errorMessage}</span>
            <button
              type="button"
              className="win-btn win-btn-icon"
              aria-label="Fechar aviso"
              onClick={clearError}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Active Tab Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!snapshot ? (
            <div style={{ padding: 24 }}>
              <p className="mono" style={{ margin: 0 }}>
                {wsStatus === 'error'
                  ? 'Não foi possível conectar ao quadro via WebSocket.'
                  : 'Carregando quadro Kanban em tempo real via WebSocket...'}
              </p>
            </div>
          ) : (
            <>
              <div
                role="tabpanel"
                id="panel-kanban"
                aria-labelledby="tab-kanban"
                hidden={activeTab !== 'kanban'}
              >
                {activeTab === 'kanban' && <KanbanBoard />}
              </div>

              <div
                role="tabpanel"
                id="panel-notes"
                aria-labelledby="tab-notes"
                hidden={activeTab !== 'notes'}
              >
                {activeTab === 'notes' && <StickyNotesBoard />}
              </div>

              <div
                role="tabpanel"
                id="panel-activity"
                aria-labelledby="tab-activity"
                hidden={activeTab !== 'activity'}
              >
                {activeTab === 'activity' && <ActivityLogTab />}
              </div>
            </>
          )}
        </div>

        {/* Classic Win95 Bottom Status Bar */}
        <footer className="statusbar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="statusbar-cell mono">
              <Users size={13} aria-hidden="true" />
              Online ({onlineUsers.length}):{' '}
              {onlineUsers.map((u) => u.name).join(', ') || '—'}
            </span>
          </div>

          <span className="statusbar-cell" style={{ flex: '1 1 240px', justifyContent: 'flex-start' }}>
            {statusBanner}
          </span>
        </footer>
      </main>

      {snapshot && (
        <ProjectContextDialog
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          projectName={snapshot.project.name}
          fileName={snapshot.project.contextFileName}
          fileType={snapshot.project.contextFileType}
          contextText={snapshot.project.contextText}
        />
      )}
    </div>
  );
}

export function WorkspacePage() {
  const { boardId } = useParams<{ boardId: string }>();
  if (!boardId) return null;

  return (
    <BoardRealtimeProvider boardId={boardId}>
      <WorkspaceContent />
    </BoardRealtimeProvider>
  );
}
