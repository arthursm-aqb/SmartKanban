# Smart Kanban

Sistema Kanban inteligente e colaborativo em tempo real orientado a **Histórias de Usuário**. Possui **Limites WIP configuráveis** e **classificação inteligente de prioridade das tarefas via IA (0 a 5)**.

---

## Principais Funcionalidades

- **Equipes, Convites e Contexto do Sistema:**
  - Cada equipe possui 1 projeto e código de convite de 8 caracteres.
  - Ao criar a equipe, envia-se um arquivo `.pdf`, `.md` ou `.txt` com a visão geral do sistema. O texto extraído é salvo no PostgreSQL como reforço de contexto para a IA e o quadro Kanban é inicializado vazio.
- **Colaboração 100% em Tempo Real:**
  - Atualizações instantâneas de cards, linhas de tarefas, WIP, presença online, **Quadro de Anotações (Post-its)** e **Histórico de Ações (Audit Log)**.
- **Fluxo Kanban e Regras Exatas de WIP:**
  - **Backlog:** 1 por História de Usuário.
  - **Especificação (`Em especificação` | `Especificado`):** 1 por História em `Em especificação` + 1 por **linha de tarefas** em `Especificado` (ex.: `H1` gera `T1..T4` em uma linha única que conta como `1` até que todas as tarefas da linha saiam de `Especificado`).
  - **Implementação (`Em implementação` | `Implementado`):** 1 por Tarefa em qualquer uma das duas subcolunas.
  - **Revisão de Código (`Em revisão` | `Revisado`):** 1 por Tarefa em `Em revisão` (**`Revisado` não entra na contagem do WIP** e tarefas já revisadas não retornam às fases anteriores).
- **Priorização automática com Gemini Decisions:**
  - O modelo avalia de 0 a 5 **Alinhamento**, **Dependência Técnica**, **Impacto no Usuário** e **Urgência no Quadro**.

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
