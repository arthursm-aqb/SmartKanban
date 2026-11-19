# Arquitetura Técnica — Smart Kanban

## 1. Clean Architecture & Regra de Dependência

O backend (`backend/src/`) é dividido em 4 camadas concêntricas onde dependências apontam estritamente para dentro (`Presentation / Infrastructure -> Application -> Domain`):

- **`domain/`**: zero dependências externas. Contém entidades, Value Objects (`PriorityScore`, `WipLimit`, `InviteCode`, `KanbanStage`), erros de domínio e o serviço puro `WipPolicyService`.
- **`application/`**: orquestra casos de uso (`use-cases/*`) utilizando apenas abstrações definidas em `ports/repositories/*` e `ports/services/*`.
- **`infrastructure/`**: implementações concretas de banco (`Prisma*Repository`), IA (`GeminiDecisionsClassifier`, `DeterministicFallbackClassifier`), parsers (`PdfDocumentParser`, `MarkdownDocumentParser`, `TxtDocumentParser`), segurança (`JwtTokenService`, `BcryptPasswordHasher`, `InMemoryRateLimiter`) e WebSocket (`SocketIoRealtimePublisher`).
- **`presentation/`**: adaptadores finos HTTP (Express + Zod v4 + Multer 2) e WebSocket (`Socket.IO` via wrapper `registerSocketHandler`).
- **`main/`**: validação *fail-fast* de variáveis de ambiente (`env.ts`) e *Composition Root* (`container.ts`).

---

## 2. Aplicação dos Princípios SOLID

| Princípio | Aplicação no Código |
|---|---|
| **S — Single Responsibility** | Cada arquivo em `application/use-cases/` implementa um único caso de uso (`MoveStoryUseCase`, `GenerateAndPrioritizeTasksUseCase`, `UpdateColumnWipUseCase`, etc.). |
| **O — Open/Closed** | `DocumentParserRegistry` aceita qualquer lista de `IDocumentParser`; novos formatos são adicionados sem alterar `CreateTeamWithProjectUseCase`. `IPriorityClassifier` permite trocar ou compor classificadores sem tocar nos casos de uso. |
| **L — Liskov Substitution** | Tanto `GeminiDecisionsClassifier` quanto `DeterministicFallbackClassifier` cumprem estritamente o contrato de `IPriorityClassifier` (sempre devolvendo `PriorityScore` válido `0..5` e `confidence` `[0, 1]`). |
| **I — Interface Segregation** | Repositórios e serviços de porta são pequenos e específicos (`IStoryRepository`, `ITaskRepository`, `IRealtimePublisher`, `IRateLimiter`, etc.). |
| **D — Dependency Inversion** | Casos de uso recebem interfaces no construtor, permitindo rodar todos os 33 testes unitários e o teste de integração completo sem acoplamento obrigatório com serviços externos. |

---

## 3. Segurança em Camadas

1. **Sessão em `HttpOnly` Cookies:** `kanban_access_token` (`15 min`, path `/`) e `kanban_refresh_token` (`7 dias`, path `/api/auth`).
2. **Rotação e Detecção de Reuso:** cada refresh token tem seu hash SHA-256 persistido em `RefreshSession` com `familyId`. Se um refresh token já revogado for reenviado, toda a cadeia `familyId` é revogada no PostgreSQL.
3. **Anti-CSRF e `Origin` Check:** rotas mutáveis HTTP exigem correspondência de `Origin`/`Referer` com `FRONTEND_ORIGIN` e *Double Submit Cookie* (`kanban_csrf_token` == header `X-CSRF-Token`).
4. **WebSocket Seguro (Anti-CSWSH + Anti-IDOR):** o handshake Socket.IO valida `Origin` e o cookie `HttpOnly`. Após `board:join`, o `boardId` verificado fica em `socket.data.boardId` (jamais aceito do payload do cliente nos comandos seguintes) e cada caso de uso revalida `isMemberOfBoard(boardId, userId)`.
5. **Rate Limiting e Throttling:**
   - HTTP: `POST /api/auth/login` limitado por `IP + email` (5 falhas / 15 min), `/register` (5 / hora), `/refresh` (30 / 15 min).
   - WebSocket: `30 eventos/s` por socket no geral; `5 gerações/min` por `userId` e **lock simultâneo por `storyId`** em `story:generate_tasks`.
6. **Validação Estrita com Zod (`z.strictObject`):** impede *mass assignment* (ex.: rejeita `priorityScore` enviado em `task:update`) e impõe limite de 72 bytes UTF-8 para senhas do bcrypt.

---

## 4. Integração com Gemini Decisions (`gemini-decision-1`)

- O modelo `gemini-decision-1` da API `v1beta/decisions` não gera texto livre (*zero output tokens*).
- O `GeminiDecisionsClassifier` envia `<system_overview_document>`, `<current_board_state>`, `<user_story>` e `<tasks_list>` como `input` compartilhado e avalia 5 perguntas `type: 'score'` (`0..5`) por tarefa (`priority`, `businessAlignment`, `technicalDependency`, `userImpact`, `boardUrgency`) em uma única chamada.
- A resposta é validada pelo `decisionsApiResponseSchema` (Zod); em caso de ausência de chave, falha de rede ou resposta incompleta, o sistema aciona o `DeterministicFallbackClassifier`.
