import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, FileText, FolderPlus, HelpCircle, LogIn, Users } from 'lucide-react';
import { DesktopTopBar } from '../components/DesktopTopBar';
import { RetroDialog } from '../components/RetroDialog';
import { apiFetch } from '../services/apiClient';
import { TeamSummary } from '../types/kanban';
import { useAccessibleFormValidation } from '../utils/formAriaSync';

export function TeamsPage() {
  const navigate = useNavigate();
  const createFormRef = useAccessibleFormValidation<HTMLFormElement>();
  const joinFormRef = useAccessibleFormValidation<HTMLFormElement>();

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create team modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [contextFile, setContextFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showFileHelp, setShowFileHelp] = useState(false);

  // Join by invite state
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      setError(null);
      const res = await apiFetch<{ teams: TeamSummary[] }>('/api/teams');
      setTeams(res.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar equipes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Equipes e Projetos | Smart Kanban';
    void loadTeams();
  }, [loadTeams]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextFile) {
      setCreateError('Selecione o arquivo .pdf, .md ou .txt com a visão geral do sistema.');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const formData = new FormData();
      formData.append('teamName', teamName.trim());
      formData.append('projectName', projectName.trim());
      formData.append('contextFile', contextFile);

      const created = await apiFetch<{ boardId: string }>('/api/teams', {
        method: 'POST',
        body: formData,
      });

      setCreateOpen(false);
      setTeamName('');
      setProjectName('');
      setContextFile(null);
      navigate(`/board/${created.boardId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar equipe e projeto.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    try {
      const res = await apiFetch<{ boardId: string }>('/api/teams/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase() }),
      });
      setInviteCode('');
      navigate(`/board/${res.boardId}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Não foi possível entrar com o convite.');
    } finally {
      setJoining(false);
    }
  };

  const copyInvite = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="desktop-shell">
      <a href="#teams-main" className="skip-link visually-hidden">
        Ir para o painel de equipes
      </a>
      <DesktopTopBar />

      <main
        id="teams-main"
        tabIndex={-1}
        style={{
          flex: 1,
          maxWidth: 1120,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <section className="win-window" aria-labelledby="teams-title">
          <div className="win-titlebar">
            <h1 id="teams-title" style={{ margin: 0, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} aria-hidden="true" />
              Painel de equipes
            </h1>
            <button
              type="button"
              className="win-btn win-btn-primary"
              style={{ minHeight: 28, padding: '3px 10px', fontSize: '0.82rem' }}
              onClick={() => {
                setCreateError(null);
                setShowFileHelp(false);
                setCreateOpen(true);
              }}
            >
              <FolderPlus size={14} aria-hidden="true" />
              Criar Equipe &amp; Projeto
            </button>
          </div>

          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)', gap: 16 }}>
            <div>
              <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Suas Equipes</h2>

              {error && (
                <div role="alert" className="win-banner-error">
                  {error}
                </div>
              )}

              {loading ? (
                <p className="win-hint">Carregando equipes...</p>
              ) : teams.length === 0 ? (
                <div className="win-sunken" style={{ padding: 16 }}>
                  <p style={{ margin: 0 }}>
                    Você ainda não participa de nenhuma equipe. Crie uma nova enviando a visão geral
                    do sistema (<code>.pdf</code>, <code>.md</code> ou <code>.txt</code>) ou entre
                    usando um código de convite ao lado.
                  </p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {teams.map((item) => (
                    <li key={item.team.id} className="kanban-card" style={{ padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                            {item.projectName}{' '}
                            <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--win-muted)' }}>
                              ({item.team.name})
                            </span>
                          </div>
                          <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--win-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span>{item.memberCount} membro(s)</span>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <FileText size={12} aria-hidden="true" /> {item.contextFileName}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="win-btn mono"
                            style={{ minHeight: 30, fontSize: '0.78rem' }}
                            onClick={() => void copyInvite(item.team.inviteCode)}
                            aria-label={`Copiar código de convite ${item.team.inviteCode}`}
                          >
                            <Copy size={12} aria-hidden="true" />
                            {copiedCode === item.team.inviteCode ? 'Copiado!' : item.team.inviteCode}
                          </button>

                          <button
                            type="button"
                            className="win-btn win-btn-primary"
                            onClick={() => navigate(`/board/${item.boardId}`)}
                          >
                            Abrir Quadro Kanban
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <aside className="win-sunken" style={{ padding: 14, alignSelf: 'start' }}>
              <h2 style={{ marginTop: 0, fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogIn size={15} aria-hidden="true" />
                Entrar por Convite
              </h2>

              {joinError && (
                <div role="alert" className="win-banner-error">
                  {joinError}
                </div>
              )}

              <form ref={joinFormRef} onSubmit={(e) => void handleJoinTeam(e)}>
                <div className="win-field">
                  <label htmlFor="invite-code-input" className="win-label">
                    Código da Equipe <span aria-hidden="true">*</span>
                  </label>
                  <span id="invite-hint" className="win-hint">
                    8 caracteres alfanuméricos (ex: AB12CD34)
                  </span>
                  <input
                    id="invite-code-input"
                    name="inviteCode"
                    type="text"
                    className="win-input mono"
                    required
                    pattern="[A-Za-z0-9]{8}"
                    maxLength={8}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="characters"
                    aria-describedby="invite-hint"
                    data-error="invite-error"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  />
                  <span id="invite-error" className="win-error-msg">
                    Erro: Digite um código com 8 letras ou números.
                  </span>
                </div>

                <button type="submit" className="win-btn win-btn-primary" style={{ width: '100%' }} disabled={joining}>
                  {joining ? 'Entrando...' : 'Entrar na Equipe'}
                </button>
              </form>
            </aside>
          </div>
        </section>
      </main>

      <RetroDialog
        open={createOpen}
        title="Nova Equipe e Projeto"
        onClose={() => setCreateOpen(false)}
        closeDisabled={creating}
      >
        <form ref={createFormRef} onSubmit={(e) => void handleCreateTeam(e)}>
          {createError && (
            <div role="alert" className="win-banner-error">
              {createError}
            </div>
          )}

          <div className="win-field">
            <label htmlFor="new-team-name" className="win-label">
              Nome da Equipe <span aria-hidden="true">*</span>
            </label>
            <input
              id="new-team-name"
              type="text"
              className="win-input"
              required
              minLength={2}
              maxLength={60}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="win-field">
            <label htmlFor="new-project-name" className="win-label">
              Nome do Projeto <span aria-hidden="true">*</span>
            </label>
            <input
              id="new-project-name"
              type="text"
              className="win-input"
              required
              minLength={2}
              maxLength={80}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="win-field">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label htmlFor="context-file-input" className="win-label">
                Arquivo de Visão Geral (.pdf, .md ou .txt) <span aria-hidden="true">*</span>
              </label>
              <button
                type="button"
                className="win-btn win-btn-icon"
                style={{ minWidth: 22, minHeight: 22, padding: 0 }}
                aria-expanded={showFileHelp}
                aria-controls="context-file-importance"
                aria-label="Por que enviar o arquivo de visão geral?"
                onClick={() => setShowFileHelp((prev) => !prev)}
              >
                <HelpCircle size={13} aria-hidden="true" />
              </button>
            </div>
            {showFileHelp && (
              <div id="context-file-importance" className="win-banner-info" style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                O texto deste arquivo serve como base de contexto para o Gemini Decisions classificar
                a prioridade (0 a 5) das tarefas geradas no quadro. O quadro Kanban começa vazio.
              </div>
            )}
            <span id="file-hint" className="win-hint">
              Tamanho máximo: 5MB.
            </span>
            <input
              id="context-file-input"
              type="file"
              accept=".pdf,.md,.markdown,.txt"
              required
              aria-describedby="file-hint"
              className="win-input"
              style={{ padding: 6 }}
              onChange={(e) => setContextFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="win-btn" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </button>
            <button type="submit" className="win-btn win-btn-primary" disabled={creating}>
              {creating ? 'Criando Quadro...' : 'Criar Equipe e Abrir Kanban'}
            </button>
          </div>
        </form>
      </RetroDialog>
    </div>
  );
}
