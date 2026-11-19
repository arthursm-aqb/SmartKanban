import { describe, expect, it, vi } from 'vitest';
import { BoardContextSummary } from '../../../src/application/ports/services/IPriorityClassifier';
import { DeterministicFallbackClassifier } from '../../../src/infrastructure/ai/DeterministicFallbackClassifier';
import {
  GeminiDecisionsClassifier,
  IDecisionsClient,
} from '../../../src/infrastructure/ai/GeminiDecisionsClassifier';

const sampleContext: BoardContextSummary = {
  projectName: 'Kanban Inteligente',
  contextDocumentText:
    'Sistema Kanban colaborativo com autenticação HttpOnly JWT, PostgreSQL, WebSocket em tempo real e priorização por Gemini Decisions.',
  storyTitle: 'Autenticação segura com HttpOnly e Refresh Token',
  storyDescription: 'Permitir cadastro, login e renovação segura de sessão.',
  existingBacklogCount: 2,
  inSpecificationCount: 1,
  specifiedTasksCount: 0,
  inImplementationCount: 2,
  inReviewCount: 1,
  existingStoryTitles: ['Autenticação segura', 'Quadro Kanban em tempo real'],
};

const sampleTasks = [
  { title: 'Criar schema Prisma de RefreshSession', description: 'Tabela no PostgreSQL com tokenHash' },
  { title: 'Ajustar cor da borda do rodapé', description: 'Refinamento visual opcional' },
];

describe('GeminiDecisionsClassifier', () => {
  it('chama gemini-decision-1 com rubricas score (0..5) e mapeia scores e confidence corretamente', async () => {
    const createMock = vi.fn().mockResolvedValue({
      answers: {
        t0_priority: { type: 'score', score: 4.7, confidence: 0.91 },
        t0_businessAlignment: { type: 'score', score: 4.8, confidence: 0.93 },
        t0_technicalDependency: { type: 'score', score: 4.9, confidence: 0.95 },
        t0_userImpact: { type: 'score', score: 4.1, confidence: 0.88 },
        t0_boardUrgency: { type: 'score', score: 4.2, confidence: 0.86 },
        t1_priority: { type: 'score', score: 1.2, confidence: 0.82 },
        t1_businessAlignment: { type: 'score', score: 1.0, confidence: 0.81 },
        t1_technicalDependency: { type: 'score', score: 0.3, confidence: 0.9 },
        t1_userImpact: { type: 'score', score: 1.4, confidence: 0.79 },
        t1_boardUrgency: { type: 'score', score: 0.9, confidence: 0.84 },
      },
    });
    const fakeClient: IDecisionsClient = { create: createMock };
    const classifier = new GeminiDecisionsClassifier(new DeterministicFallbackClassifier(), {
      model: 'gemini-decision-1',
      decisionsClient: fakeClient,
    });

    const results = await classifier.classify(sampleContext, sampleTasks);

    expect(createMock).toHaveBeenCalledTimes(1);
    const callArg = createMock.mock.calls[0]![0];
    expect(callArg.model).toBe('gemini-decision-1');
    expect(callArg.api_version).toBe('v1beta');
    expect(callArg.input).toContain('<system_overview_document>');
    expect(callArg.questions.t0_priority.type).toBe('score');
    expect(callArg.questions.t0_priority.criteria).toHaveLength(6);

    expect(results).toHaveLength(2);
    expect(results[0]!.classifiedByModel).toBe('gemini-decision-1');
    expect(results[0]!.priority.value).toBe(5);
    expect(results[0]!.priority.confidence).toBe(0.91);
    expect(results[0]!.priority.criteria.technicalDependency).toBe(5);

    expect(results[1]!.priority.value).toBe(1);
    expect(results[1]!.priority.criteria.technicalDependency).toBe(0);
  });

  it('aciona DeterministicFallbackClassifier quando a resposta tem score inválido (> 5)', async () => {
    const fakeClient: IDecisionsClient = {
      create: vi.fn().mockResolvedValue({
        answers: {
          t0_priority: { type: 'score', score: 7, confidence: 0.9 },
        },
      }),
    };
    const classifier = new GeminiDecisionsClassifier(new DeterministicFallbackClassifier(), {
      model: 'gemini-decision-1',
      decisionsClient: fakeClient,
    });

    const results = await classifier.classify(sampleContext, sampleTasks);

    expect(results).toHaveLength(2);
    expect(results[0]!.classifiedByModel).toBe(DeterministicFallbackClassifier.MODEL_NAME);
    expect(results[0]!.priority.value).toBeGreaterThanOrEqual(0);
    expect(results[0]!.priority.value).toBeLessThanOrEqual(5);
  });

  it('aciona DeterministicFallbackClassifier quando falta chave de critério ou ocorre erro de rede', async () => {
    const missingKeyClient: IDecisionsClient = {
      create: vi.fn().mockResolvedValue({
        answers: {
          t0_priority: { type: 'score', score: 4, confidence: 0.9 },
          // missing t0_businessAlignment and t1_*
        },
      }),
    };
    const failingClient: IDecisionsClient = {
      create: vi.fn().mockRejectedValue(new Error('Network timeout')),
    };

    const res1 = await new GeminiDecisionsClassifier(new DeterministicFallbackClassifier(), {
      model: 'gemini-decision-1',
      decisionsClient: missingKeyClient,
    }).classify(sampleContext, sampleTasks);

    const res2 = await new GeminiDecisionsClassifier(new DeterministicFallbackClassifier(), {
      model: 'gemini-decision-1',
      decisionsClient: failingClient,
    }).classify(sampleContext, sampleTasks);

    expect(res1[0]!.classifiedByModel).toBe('fallback-deterministic');
    expect(res2[0]!.classifiedByModel).toBe('fallback-deterministic');
  });

  it('usa fallback diretamente quando não há GEMINI_API_KEY configurada', async () => {
    const classifier = new GeminiDecisionsClassifier(new DeterministicFallbackClassifier(), {
      apiKey: undefined,
      model: 'gemini-decision-1',
    });

    const results = await classifier.classify(sampleContext, sampleTasks);
    expect(results).toHaveLength(2);
    expect(results[0]!.classifiedByModel).toBe('fallback-deterministic');
    // Core DB/auth task should score >= cosmetic footer border task
    expect(results[0]!.priority.value).toBeGreaterThanOrEqual(results[1]!.priority.value);
  });
});
