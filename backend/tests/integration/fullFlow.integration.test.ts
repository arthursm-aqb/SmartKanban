import { AddressInfo } from 'net';
import request from 'supertest';
import { io as createSocketClient, Socket as ClientSocket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';
import { StickyNoteColor } from '../../src/domain/entities/StickyNote';
import { ColumnType, SubcolumnType } from '../../src/domain/value-objects/KanbanStage';
import { PriorityScore } from '../../src/domain/value-objects/PriorityScore';
import { createApp, CreatedApp } from '../../src/main/app';
import {
  ACCESS_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from '../../src/presentation/http/cookies';
import { createTestContainer } from '../doubles/InMemoryContainer';

const ORIGIN = 'http://localhost:5173';

interface CookieJar {
  cookies: Record<string, string>;
  csrfToken: string;
}

function updateJarFromSetCookie(jar: CookieJar, setCookieHeader?: string[] | string): void {
  if (!setCookieHeader) return;
  const list = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const raw of list) {
    const [pair] = raw.split(';');
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const val = pair.slice(eqIdx + 1).trim();
    if (val === '') {
      delete jar.cookies[name];
    } else {
      jar.cookies[name] = val;
    }
    if (name === CSRF_COOKIE_NAME) {
      jar.csrfToken = val;
    }
  }
}

function cookieHeaderOf(jar: CookieJar): string {
  return Object.entries(jar.cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function emitAck<T = any>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ack of ${event}`)), 5000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function waitForEvent<T = any>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event ${event}`)), 5000);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Integration: HTTP (HttpOnly + CSRF + Upload) & WebSocket (Kanban + WIP + Gemini Decisions)', () => {
  let running: CreatedApp | null = null;
  const openSockets: ClientSocket[] = [];

  afterEach(async () => {
    for (const s of openSockets) {
      s.disconnect();
    }
    openSockets.length = 0;
    if (running) {
      await new Promise<void>((resolve) => running!.io.close(() => resolve()));
      await new Promise<void>((resolve) => running!.httpServer.close(() => resolve()));
      running = null;
    }
  });

  async function bootServer() {
    const { container } = createTestContainer({
      frontendOrigin: ORIGIN,
      authRateLimitOptions: { registerMax: 50, loginMax: 5, refreshMax: 50 },
      priorityClassifier: {
        classify: async (_ctx, tasks) =>
          tasks.map((task, idx) => ({
            taskIndex: idx,
            priority: PriorityScore.create(Math.max(0, 5 - idx), 0.91, {
              businessAlignment: Math.max(0, 5 - idx),
              technicalDependency: 4,
              userImpact: 4,
              boardUrgency: 3,
            }),
            classifiedByModel: 'gemini-decision-1',
          })),
      },
    });
    running = createApp(container);
    await new Promise<void>((resolve) => running!.httpServer.listen(0, '127.0.0.1', () => resolve()));
    const port = (running.httpServer.address() as AddressInfo).port;
    return { baseUrl: `http://127.0.0.1:${port}`, app: running.app };
  }

  async function registerUserViaHttp(
    app: CreatedApp['app'],
    name: string,
    email: string,
    password: string,
  ): Promise<{ jar: CookieJar; userId: string }> {
    const jar: CookieJar = { cookies: {}, csrfToken: '' };

    const csrfRes = await request(app).get('/api/auth/csrf').set('Origin', ORIGIN).expect(200);
    updateJarFromSetCookie(jar, csrfRes.headers['set-cookie']);

    // Simulate cold load: GET /csrf followed by failing POST /refresh (must NOT clear CSRF cookie!)
    const failedRefreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(jar))
      .set('X-CSRF-Token', jar.csrfToken)
      .expect(401);
    updateJarFromSetCookie(jar, failedRefreshRes.headers['set-cookie']);
    expect(jar.cookies[CSRF_COOKIE_NAME]).toBeTruthy();

    const regRes = await request(app)
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(jar))
      .set('X-CSRF-Token', jar.csrfToken)
      .send({ name, email, password })
      .expect(201);

    const setCookies = regRes.headers['set-cookie'] as unknown as string[];
    expect(setCookies.some((c) => c.startsWith(`${ACCESS_COOKIE_NAME}=`) && c.includes('HttpOnly'))).toBe(true);
    expect(setCookies.some((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`) && c.includes('HttpOnly'))).toBe(true);

    updateJarFromSetCookie(jar, setCookies);
    return { jar, userId: regRes.body.user.id };
  }

  function connectSocket(baseUrl: string, jar: CookieJar, origin: string = ORIGIN): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = createSocketClient(baseUrl, {
        transports: ['websocket'],
        extraHeaders: {
          Cookie: cookieHeaderOf(jar),
          Origin: origin,
        },
        reconnection: false,
      });
      openSockets.push(socket);
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (err) => reject(err));
    });
  }

  it('valida segurança HTTP (CSRF, Origin, Refresh Rotation, Reuse Detection, Upload magic bytes) e fluxo completo WebSocket', async () => {
    const { baseUrl, app } = await bootServer();

    // 1. CSRF & Origin protections block unsafe requests
    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example.com')
      .send({ email: 'a@b.com', password: 'Password123!' })
      .expect(403);

    await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'a@b.com', password: 'Password123!' })
      .expect(403);

    // 2. Register Alice, Bob and Eve (outsider)
    const alice = await registerUserViaHttp(app, 'Alice', 'alice@csa.ifrn.edu.br', 'SenhaForte123!');
    const bob = await registerUserViaHttp(app, 'Bob', 'bob@csa.ifrn.edu.br', 'SenhaForte123!');
    const eve = await registerUserViaHttp(app, 'Eve', 'eve@csa.ifrn.edu.br', 'SenhaForte123!');

    // 3. Test Refresh Token rotation + Reuse Detection
    const oldRefreshCookie = alice.jar.cookies[REFRESH_COOKIE_NAME]!;
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(alice.jar))
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .expect(200);
    updateJarFromSetCookie(alice.jar, refreshRes.headers['set-cookie']);
    expect(alice.jar.cookies[REFRESH_COOKIE_NAME]).not.toBe(oldRefreshCookie);

    // Replay old R1 -> 401 + revokes entire family (including R2)!
    await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set(
        'Cookie',
        `${REFRESH_COOKIE_NAME}=${oldRefreshCookie}; ${CSRF_COOKIE_NAME}=${alice.jar.csrfToken}`,
      )
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .expect(401);

    // Legitimate R2 was also revoked by Reuse Detection -> 401!
    await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(alice.jar))
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .expect(401);

    // Alice logs in cleanly again
    const csrfFresh = await request(app).get('/api/auth/csrf').set('Origin', ORIGIN).expect(200);
    updateJarFromSetCookie(alice.jar, csrfFresh.headers['set-cookie']);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(alice.jar))
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .send({ email: 'alice@csa.ifrn.edu.br', password: 'SenhaForte123!' })
      .expect(200);
    updateJarFromSetCookie(alice.jar, loginRes.headers['set-cookie']);

    // 4. Reject fake PDF upload without %PDF- magic bytes
    await request(app)
      .post('/api/teams')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(alice.jar))
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .field('teamName', 'Equipe Invalida')
      .field('projectName', 'Proj Invalido')
      .attach('contextFile', Buffer.from('not a pdf', 'utf8'), {
        filename: 'fake.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    // 5. Create Team + Project with valid .md overview document -> generates empty 4-column board
    const teamRes = await request(app)
      .post('/api/teams')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(alice.jar))
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .field('teamName', 'Equipe User Function')
      .field('projectName', 'Kanban Inteligente')
      .attach(
        'contextFile',
        Buffer.from('# Visão Geral\nSistema Kanban colaborativo com WebSocket e Gemini Decisions.', 'utf8'),
        { filename: 'visao_geral.md', contentType: 'text/markdown' },
      )
      .expect(201);

    const { boardId } = teamRes.body as { boardId: string; team: { inviteCode: string } };
    const inviteCode = teamRes.body.team.inviteCode as string;

    // 6. Bob joins by invite code via HTTP (HttpOnly cookie)
    await request(app)
      .post('/api/teams/join')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(bob.jar))
      .set('X-CSRF-Token', bob.jar.csrfToken)
      .send({ inviteCode })
      .expect(200);

    // 7. WebSocket handshake security checks
    await expect(connectSocket(baseUrl, { cookies: {}, csrfToken: '' }, ORIGIN)).rejects.toThrow(
      'UNAUTHORIZED',
    );
    await expect(connectSocket(baseUrl, alice.jar, 'https://evil.example.com')).rejects.toThrow(
      'ORIGIN_NOT_ALLOWED',
    );

    // Eve connects with her own valid HttpOnly cookie, but anti-IDOR blocks board:join
    const eveSocket = await connectSocket(baseUrl, eve.jar);
    const eveJoin = await emitAck(eveSocket, 'board:join', { boardId });
    expect(eveJoin.ok).toBe(false);
    expect(eveJoin.error).toBe('FORBIDDEN');

    // 8. Alice and Bob connect via WebSocket using their HttpOnly cookies and join the board
    const aliceSocket = await connectSocket(baseUrl, alice.jar);
    const bobSocket = await connectSocket(baseUrl, bob.jar);

    const aliceJoin = await emitAck(aliceSocket, 'board:join', { boardId });
    expect(aliceJoin.ok).toBe(true);
    expect(aliceJoin.data.columns).toHaveLength(4);
    expect(aliceJoin.data.stories).toHaveLength(0);

    const presenceOnAlice = waitForEvent(aliceSocket, 'board:presence_updated');
    const bobJoin = await emitAck(bobSocket, 'board:join', { boardId });
    expect(bobJoin.ok).toBe(true);
    const presenceEvent = await presenceOnAlice;
    expect(presenceEvent.users).toHaveLength(2);

    // 9. Configure WIP limits & verify broadcast to Bob
    const wipBroadcastOnBob = waitForEvent(bobSocket, 'board:wip_updated');
    const wipSpec = await emitAck(aliceSocket, 'board:update_wip', {
      columnType: ColumnType.SPECIFICATION,
      wipLimit: 1,
    });
    expect(wipSpec.ok).toBe(true);
    const receivedWip = await wipBroadcastOnBob;
    expect(receivedWip.column.wipLimit).toBe(1);

    await emitAck(aliceSocket, 'board:update_wip', {
      columnType: ColumnType.IMPLEMENTATION,
      wipLimit: 2,
    });
    await emitAck(aliceSocket, 'board:update_wip', {
      columnType: ColumnType.CODE_REVIEW,
      wipLimit: 1,
    });

    // 10. Create 2 stories, move H1 -> Em especificação, confirm H2 blocked by WIP (1/1)
    const h1Ack = await emitAck(aliceSocket, 'story:create', {
      title: 'História 1 - Fluxo Principal',
      description: 'Fluxo base do Kanban',
    });
    const h2Ack = await emitAck(bobSocket, 'story:create', {
      title: 'História 2 - Post-its',
      description: 'Quadro de anotações',
    });
    const h1Id = h1Ack.data.story.id as string;
    const h2Id = h2Ack.data.story.id as string;

    const moveH1 = await emitAck(aliceSocket, 'story:move', {
      storyId: h1Id,
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });
    expect(moveH1.ok).toBe(true);

    const blockedH2 = await emitAck(bobSocket, 'story:move', {
      storyId: h2Id,
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });
    expect(blockedH2.ok).toBe(false);
    expect(blockedH2.error).toBe('WIP_LIMIT_EXCEEDED');

    // 11. Generate tasks from H1 in Em especificação -> Gemini Decisions classifies 0..5 -> 1 row in Especificado
    const generatedOnBob = waitForEvent(bobSocket, 'board:tasks_generated');
    const genAck = await emitAck(aliceSocket, 'story:generate_tasks', {
      storyId: h1Id,
      tasks: [
        { title: 'T1 - Criar tabelas PostgreSQL', description: 'Schema principal' },
        { title: 'T2 - Implementar WebSocket gateway', description: 'Socket.IO rooms' },
        { title: 'T3 - Ajustar legenda da coluna', description: 'Detalhe de UI' },
      ],
    });
    expect(genAck.ok).toBe(true);
    expect(genAck.data.tasks).toHaveLength(3);
    expect(genAck.data.tasks[0].priorityScore).toBe(5);
    expect(genAck.data.tasks[0].classifiedByModel).toBe('gemini-decision-1');
    expect(genAck.data.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(1);

    const broadcastTasks = await generatedOnBob;
    expect(broadcastTasks.tasks).toHaveLength(3);

    const [t1, t2, t3] = genAck.data.tasks as Array<{ id: string }>;

    // 12. Mass-assignment check: client cannot inject priorityScore via task:update
    const massAssignAck = await emitAck(aliceSocket, 'task:update', {
      taskId: t1!.id,
      title: 'T1 editada',
      priorityScore: 0,
    });
    expect(massAssignAck.ok).toBe(false);
    expect(massAssignAck.error).toBe('VALIDATION_ERROR');

    // 13. Move T1, T2 -> Em implementação; SPECIFICATION stays 1 until T3 leaves!
    await emitAck(bobSocket, 'task:move', {
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
      position: 0,
    });
    const moveT2 = await emitAck(bobSocket, 'task:move', {
      taskId: t2!.id,
      toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
      position: 1,
    });
    expect(moveT2.data.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(1);
    expect(moveT2.data.wipOccupancy[ColumnType.IMPLEMENTATION].currentCount).toBe(2);

    // T1 -> IN_REVIEW -> REVIEWED (does NOT block CODE_REVIEW WIP!)
    await emitAck(aliceSocket, 'task:move', {
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.IN_REVIEW,
      position: 0,
    });
    const t1Reviewed = await emitAck(aliceSocket, 'task:move', {
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.REVIEWED,
      position: 0,
    });
    expect(t1Reviewed.data.wipOccupancy[ColumnType.CODE_REVIEW].currentCount).toBe(0);

    // T2 -> IN_REVIEW -> REVIEWED (proves multiple tasks in REVIEWED never violate CODE_REVIEW WIP=1)
    await emitAck(aliceSocket, 'task:move', {
      taskId: t2!.id,
      toSubcolumn: SubcolumnType.IN_REVIEW,
      position: 0,
    });
    const t2Reviewed = await emitAck(aliceSocket, 'task:move', {
      taskId: t2!.id,
      toSubcolumn: SubcolumnType.REVIEWED,
      position: 1,
    });
    expect(t2Reviewed.ok).toBe(true);
    expect(t2Reviewed.data.wipOccupancy[ColumnType.CODE_REVIEW].currentCount).toBe(0);

    // Reviewed tasks cannot be moved back to IN_REVIEW or earlier stages
    const revertReviewed = await emitAck(aliceSocket, 'task:move', {
      taskId: t1!.id,
      toSubcolumn: SubcolumnType.IN_REVIEW,
      position: 0,
    });
    expect(revertReviewed.ok).toBe(false);
    expect(revertReviewed.error).toBe('DOMAIN_VALIDATION_ERROR');

    // Move T3 (last task of H1's row) -> IN_IMPLEMENTATION -> SPECIFICATION drops to 0!
    const t3Moved = await emitAck(bobSocket, 'task:move', {
      taskId: t3!.id,
      toSubcolumn: SubcolumnType.IN_IMPLEMENTATION,
      position: 0,
    });
    expect(t3Moved.data.wipOccupancy[ColumnType.SPECIFICATION].currentCount).toBe(0);

    // Now H2 can move to Em especificação!
    const h2Moved = await emitAck(bobSocket, 'story:move', {
      storyId: h2Id,
      toSubcolumn: SubcolumnType.IN_SPECIFICATION,
      position: 0,
    });
    expect(h2Moved.ok).toBe(true);

    // 14. Sticky Notes realtime collaboration
    const noteBroadcastOnAlice = waitForEvent(aliceSocket, 'board:note_created');
    const noteAck = await emitAck(bobSocket, 'note:create', {
      content: 'Validar backup do PostgreSQL antes da demo!',
      color: StickyNoteColor.YELLOW,
      posX: 150,
      posY: 90,
    });
    expect(noteAck.ok).toBe(true);
    const noteEvent = await noteBroadcastOnAlice;
    expect(noteEvent.note.content).toContain('PostgreSQL');

    // 15. Activity Log tab via WebSocket
    const activityAck = await emitAck(aliceSocket, 'activity:list', { limit: 50 });
    expect(activityAck.ok).toBe(true);
    expect(activityAck.data.logs.length).toBeGreaterThanOrEqual(10);

    // 16. Logout revokes RefreshSession so /refresh fails with 401
    const oldAliceRefresh = alice.jar.cookies[REFRESH_COOKIE_NAME]!;
    await request(app)
      .post('/api/auth/logout')
      .set('Origin', ORIGIN)
      .set('Cookie', cookieHeaderOf(alice.jar))
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .expect(200);

    await request(app)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set(
        'Cookie',
        `${REFRESH_COOKIE_NAME}=${oldAliceRefresh}; ${CSRF_COOKIE_NAME}=${alice.jar.csrfToken}`,
      )
      .set('X-CSRF-Token', alice.jar.csrfToken)
      .expect(401);
  });

  it('emite cookies SameSite=None e Secure em modo produção cross-site e ativa trust proxy', async () => {
    const prodOrigin = 'https://smart-kanban.vercel.app';
    const { container } = createTestContainer({
      frontendOrigin: prodOrigin,
      isProduction: true,
      cookieConfig: { secure: true, sameSite: 'none' },
    });
    running = createApp(container);

    expect(running.app.get('trust proxy')).toBe(1);

    const csrfRes = await request(running.app)
      .get('/api/auth/csrf')
      .set('Origin', prodOrigin)
      .expect(200);
    const csrfCookies = csrfRes.headers['set-cookie'] as unknown as string[];
    const csrfCookie = csrfCookies.find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`));
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie).toContain('SameSite=None');
    expect(csrfCookie).toContain('Secure');
    expect(csrfRes.body.csrfToken).toBeTruthy();

    const regRes = await request(running.app)
      .post('/api/auth/register')
      .set('Origin', prodOrigin)
      .set('Cookie', `${CSRF_COOKIE_NAME}=${csrfRes.body.csrfToken}`)
      .set('X-CSRF-Token', csrfRes.body.csrfToken)
      .send({
        name: 'Deploy User',
        email: 'deploy@smartkanban.app',
        password: 'PasswordForte123!',
      })
      .expect(201);

    const regCookies = regRes.headers['set-cookie'] as unknown as string[];
    const accessCookie = regCookies.find((c) => c.startsWith(`${ACCESS_COOKIE_NAME}=`));
    const refreshCookie = regCookies.find((c) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
    expect(accessCookie).toContain('HttpOnly');
    expect(accessCookie).toContain('SameSite=None');
    expect(accessCookie).toContain('Secure');
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('SameSite=None');
    expect(refreshCookie).toContain('Secure');
    expect(regRes.body.csrfToken).toBeTruthy();
  });
});
