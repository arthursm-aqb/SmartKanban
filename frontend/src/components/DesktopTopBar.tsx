import { Link } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function DesktopTopBar({
  backToTeams = false,
  projectTitle,
}: {
  backToTeams?: boolean;
  projectTitle?: string;
}) {
  const { user, logout } = useAuth();

  return (
    <header className="win-window topbar">
      <div className="topbar-brand">
        <LayoutGrid size={18} aria-hidden="true" />
        <span>Smart Kanban</span>
        {projectTitle && (
          <span className="mono" style={{ fontSize: '0.85rem', opacity: 0.85 }}>
            — {projectTitle}
          </span>
        )}
      </div>

      <div className="topbar-controls">
        {backToTeams && (
          <Link to="/teams" className="win-btn">
            <ArrowLeft size={14} aria-hidden="true" />
            Equipes
          </Link>
        )}

        {user && (
          <>
            <span className="mono" style={{ fontSize: '0.82rem', paddingInline: 4 }}>
              {user.name}
            </span>
            <button type="button" className="win-btn" onClick={() => void logout()}>
              <LogOut size={14} aria-hidden="true" />
              Sair
            </button>
          </>
        )}
      </div>
    </header>
  );
}
