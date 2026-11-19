import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, UserPlus } from 'lucide-react';
import { DesktopTopBar } from '../components/DesktopTopBar';
import { useAuth } from '../contexts/AuthContext';
import { ApiClientError } from '../services/apiClient';
import { useAccessibleFormValidation } from '../utils/formAriaSync';

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const formRef = useAccessibleFormValidation<HTMLFormElement>();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    document.title =
      mode === 'login' ? 'Entrar | Smart Kanban' : 'Criar Conta | Smart Kanban';
    setServerError(null);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setServerError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.fields) {
        const firstFieldError = Object.values(err.fields).flat().find(Boolean);
        setServerError(firstFieldError ?? err.message);
      } else {
        setServerError(err instanceof Error ? err.message : 'Falha na autenticação.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="desktop-shell">
      <a href="#auth-main" className="skip-link visually-hidden">
        Ir para o conteúdo principal
      </a>
      <DesktopTopBar />

      <main
        id="auth-main"
        tabIndex={-1}
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: '20px 12px',
        }}
      >
        <section className="win-window" style={{ width: '100%', maxWidth: 460 }} aria-labelledby="auth-heading">
          <div className="win-titlebar">
            <h1 id="auth-heading" style={{ margin: 0, fontSize: '0.96rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              {mode === 'login' ? <KeyRound size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
              {mode === 'login' ? 'Login' : 'Novo Usuário — Cadastrar'}
            </h1>
          </div>

          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button
                type="button"
                className={`win-btn ${mode === 'login' ? 'win-btn-primary' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setMode('login')}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`win-btn ${mode === 'register' ? 'win-btn-primary' : ''}`}
                style={{ flex: 1 }}
                onClick={() => setMode('register')}
              >
                Cadastrar
              </button>
            </div>

            {serverError && (
              <div role="alert" className="win-banner-error">
                <span aria-hidden="true">❌ </span>
                {serverError}
              </div>
            )}

            <form
              ref={formRef}
              method="POST"
              onSubmit={(e) => void handleSubmit(e)}
              aria-labelledby="auth-heading"
            >
              {mode === 'register' && (
                <div className="win-field">
                  <label htmlFor="auth-name" className="win-label">
                    Nome completo <span aria-hidden="true">*</span>
                  </label>
                  <span id="auth-name-hint" className="win-hint">
                    Mínimo de 2 caracteres.
                  </span>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    className="win-input"
                    required
                    minLength={2}
                    maxLength={80}
                    autoComplete="name"
                    enterKeyHint="next"
                    aria-describedby="auth-name-hint"
                    data-error="auth-name-error"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <span id="auth-name-error" className="win-error-msg">
                    Erro: Informe seu nome (entre 2 e 80 caracteres).
                  </span>
                </div>
              )}

              <div className="win-field">
                <label htmlFor="auth-email" className="win-label">
                  E-mail <span aria-hidden="true">*</span>
                </label>
                <span id="auth-email-hint" className="win-hint">
                  Formato: nome@dominio.com
                </span>
                <input
                  id="auth-email"
                  name="email"
                  type="email"
                  className="win-input"
                  required
                  autoComplete="username"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  enterKeyHint="next"
                  aria-describedby="auth-email-hint"
                  data-error="auth-email-error"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <span id="auth-email-error" className="win-error-msg">
                  Erro: Digite um endereço de e-mail válido.
                </span>
              </div>

              <div className="win-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="auth-password" className="win-label">
                    Senha <span aria-hidden="true">*</span>
                  </label>
                  <button
                    type="button"
                    className="win-btn"
                    style={{ minHeight: 24, padding: '2px 8px', fontSize: '0.76rem' }}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <span id="auth-password-hint" className="win-hint">
                  {mode === 'register'
                    ? 'Mínimo de 8 caracteres.'
                    : 'Digite sua senha cadastrada.'}
                </span>
                <input
                  id="auth-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="win-input"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  maxLength={72}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  enterKeyHint="done"
                  aria-describedby="auth-password-hint"
                  data-error="auth-password-error"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span id="auth-password-error" className="win-error-msg">
                  Erro: {mode === 'register' ? 'A senha deve ter pelo menos 8 caracteres.' : 'Informe sua senha.'}
                </span>
              </div>

              <button
                type="submit"
                className="win-btn win-btn-primary"
                style={{ width: '100%', minHeight: 38 }}
                disabled={submitting}
              >
                {submitting
                  ? 'Autenticando...'
                  : mode === 'login'
                    ? 'Acessar'
                    : 'Criar Conta e Acessar Equipes'}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
