# Smart Kanban

Sistema Kanban colaborativo em tempo real orientado a **Histórias de Usuário**, **Limites WIP configuráveis** e **classificação inteligente de prioridade (0 a 5)** via **Google Gemini Decisions (`gemini-decision-1`)**, construído com **TypeScript**, **React**, **Node.js**, **PostgreSQL**, **WebSocket (Socket.IO)** e estética **Retro Arch / Win95 Classic Teal**.

---

## Principais Funcionalidades

- **Autenticação Segura (`HttpOnly` + JWT Rotacionado):**
  - Cadastro, login e painel principal de equipes operam via HTTP com **cookies `HttpOnly`** (Access Token curto de `15 min` + Refresh Token `7 dias` salvo por hash SHA-256 no PostgreSQL com rotação e detecção de reuso). Zero tokens em `localStorage`.
  - Proteção anti-CSRF (*Double Submit Cookie* + validação de `Origin`), `helmet`, `bcryptjs` (cost 12) e `express-rate-limit`.
- **Equipes, Convites e Contexto do Sistema (`.pdf`, `.md`, `.txt`):**
  - Cada equipe possui 1 projeto e código de convite de 8 caracteres.
  - Ao criar a equipe, envia-se um arquivo `.pdf`, `.md` ou `.txt` com a visão geral do sistema (validado por extensão, MIME e *magic bytes*). O texto extraído é salvo no PostgreSQL como reforço de contexto para a IA e o quadro Kanban é inicializado vazio com 4 colunas.
- **Colaboração 100% em Tempo Real via WebSocket:**
  - Dentro de uma equipe, o handshake Socket.IO lê diretamente o cookie `HttpOnly`, valida `Origin` e verifica participação na equipe (anti-IDOR) a cada evento.
  - Atualizações instantâneas de cards, linhas de tarefas, WIP, presença online, **Quadro de Anotações (Post-its)** e **Histórico de Ações (Audit Log)**.
- **Fluxo Kanban e Regras Exatas de WIP:**
  - **Backlog:** 1 por História de Usuário.
  - **Especificação (`Em especificação` | `Especificado`):** 1 por História em `Em especificação` + 1 por **linha de tarefas** em `Especificado` (ex.: `H1` gera `T1..T4` em uma linha única que conta como `1` até que todas as tarefas da linha saiam de `Especificado`).
  - **Implementação (`Em implementação` | `Implementado`):** 1 por Tarefa em qualquer uma das duas subcolunas.
  - **Revisão de Código (`Em revisão` | `Revisado`):** 1 por Tarefa em `Em revisão` (**`Revisado` não entra na contagem do WIP** e tarefas já revisadas não retornam às fases anteriores).
- **Priorização com Gemini Decisions (`gemini-decision-1`):**
  - Ao clicar em uma história em `Em especificação`, abre-se um pop-up para cadastrar suas tarefas (`T1..Tn`) e clicar em **"Gerar tarefas"**.
  - O backend chama `ai.decisions.create` (`v1beta`, `gemini-decision-1`) com rubricas `type: 'score'` (`0` a `5`) avaliando **Alinhamento**, **Dependência Técnica**, **Impacto no Usuário** e **Urgência no Quadro** (zero tokens de saída; fallback determinístico automático quando offline ou sem chave).
- **Design System Retro Arch / Win95 Classic Teal:**
  - Janelas, botões chanfrados (*bevel 3D*), diálogos `<dialog>` nativos, paleta **Win95 Classic Teal** adaptada para monitores modernos e suporte a `forced-colors` (Alto Contraste).

---

## Arquitetura (Clean Architecture + SOLID)

Veja os detalhes completos em [docs/architecture.md](docs/architecture.md).

```text
backend/src/
├── domain/          # Entidades, Value Objects (PriorityScore, WipLimit), WipPolicyService, Erros
├── application/     # Portas (ISP/DIP), DTOs e 22 Use Cases (1 responsabilidade por classe - SRP)
├── infrastructure/  # Prisma PostgreSQL, GeminiDecisionsClassifier + Fallback, Parsers OCP, Socket.IO
├── presentation/    # Controllers HTTP (HttpOnly + CSRF), Schemas Zod v4, Gateway WebSocket
└── main/            # Env fail-fast, Composition Root (container.ts), Express + Socket.IO server
```

---

## Como Executar Localmente

### 1. Subir PostgreSQL
Com Docker:
```bash
docker compose up -d
```
*(Ou ajuste `backend/.env` apontando `DATABASE_URL` para seu PostgreSQL local.)*

### 2. Configurar Variáveis de Ambiente
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```
Preencha `GEMINI_API_KEY` em `backend/.env` (opcional — sem chave, o sistema usa o `DeterministicFallbackClassifier`).

### 3. Instalar Dependências, Gerar Prisma e Rodar Migrações
```bash
npm --prefix backend install
npm --prefix frontend install
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
```

### 4. Iniciar Backend e Frontend
Em dois terminais:
```bash
npm run dev:backend
npm run dev:frontend
```
Acesse `http://localhost:5173`.

---

## Testes Automatizados e Build

```bash
# Testes unitários do backend (domínio, casos de uso, parsers, Zod, Gemini Decisions)
npm run test:backend

# Teste de integração ponta a ponta (HTTP HttpOnly + CSRF + Socket.IO 2 clientes + WIP)
npm run test:backend:integration

# Testes de interface do frontend (Vitest + React Testing Library)
npm run test:frontend

# Compilação completa TypeScript (backend + frontend)
npm run build
```

---

## Uso Crítico de IA no Desenvolvimento

Em alinhamento às boas práticas de engenharia de software:
- O código assistido por IA passou por revisão de fronteiras arquiteturais (garantindo zero acoplamento de Express, Prisma, Zod ou SDK do Gemini dentro de `domain/` e `application/`).
- Falhas específicas detectadas e depuradas durante o desenvolvimento (como isolamento de `Uint8Array` para o `pdf-parse` contra o *Buffer pool* do Node.js, adaptação exata à API `v1beta/decisions` sem tokens de geração do `gemini-decision-1`, e fallback de `closedby` para `<dialog>`) foram cobertas por testes automatizados.
