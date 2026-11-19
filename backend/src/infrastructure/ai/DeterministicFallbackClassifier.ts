import {
  BoardContextSummary,
  ClassifiedTaskResult,
  IPriorityClassifier,
  TaskToClassify,
} from '../../application/ports/services/IPriorityClassifier';
import { PriorityCriteria, PriorityScore } from '../../domain/value-objects/PriorityScore';

const HIGH_DEPENDENCY_KEYWORDS = [
  'banco',
  'schema',
  'migration',
  'migração',
  'autenticação',
  'auth',
  'jwt',
  'segurança',
  'security',
  'api',
  'websocket',
  'infra',
  'arquitetura',
  'configuração',
  'setup',
  'base',
  'contrato',
  'core',
  'bloqueio',
  'dependência',
];

const HIGH_IMPACT_KEYWORDS = [
  'usuário',
  'login',
  'cadastro',
  'kanban',
  'wip',
  'tempo real',
  'realtime',
  'prioridade',
  'ia',
  'gemini',
  'pagamento',
  'crítico',
  'erro',
  'bug',
  'falha',
  'produção',
  'principal',
  'fluxo',
];

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((count, kw) => (lower.includes(kw) ? count + 1 : count), 0);
}

export class DeterministicFallbackClassifier implements IPriorityClassifier {
  public static readonly MODEL_NAME = 'fallback-deterministic';

  public async classify(
    context: BoardContextSummary,
    tasks: TaskToClassify[],
  ): Promise<ClassifiedTaskResult[]> {
    const docTokens = tokenize(context.contextDocumentText);
    const boardLoadFactor =
      context.inImplementationCount + context.inReviewCount >= 5
        ? 4
        : context.inImplementationCount + context.inReviewCount >= 2
          ? 3
          : 2;

    return tasks.map((task, taskIndex) => {
      const combinedText = `${task.title} ${task.description}`;
      const taskTokens = tokenize(combinedText);

      let overlapCount = 0;
      for (const token of taskTokens) {
        if (docTokens.has(token)) overlapCount += 1;
      }

      const businessAlignment = clampScore(
        docTokens.size === 0 ? 2 : 1 + Math.min(4, Math.ceil((overlapCount / Math.max(1, taskTokens.size)) * 6)),
      );

      const depMatches = countKeywordMatches(combinedText, HIGH_DEPENDENCY_KEYWORDS);
      const technicalDependency = clampScore(1 + Math.min(4, depMatches * 1.5));

      const impactMatches = countKeywordMatches(combinedText, HIGH_IMPACT_KEYWORDS);
      const userImpact = clampScore(1 + Math.min(4, impactMatches * 1.5));

      const boardUrgency = clampScore(
        boardLoadFactor + (depMatches > 0 ? 1 : 0) - (taskIndex > 4 ? 1 : 0),
      );

      const criteria: PriorityCriteria = {
        businessAlignment,
        technicalDependency,
        userImpact,
        boardUrgency,
      };

      const weighted =
        businessAlignment * 0.3 +
        technicalDependency * 0.3 +
        userImpact * 0.25 +
        boardUrgency * 0.15;

      const overallScore = clampScore(weighted);
      const confidence = Number(
        Math.min(0.85, Math.max(0.55, 0.55 + overlapCount * 0.04 + (depMatches + impactMatches) * 0.03)).toFixed(2),
      );

      return {
        taskIndex,
        priority: PriorityScore.create(overallScore, confidence, criteria),
        classifiedByModel: DeterministicFallbackClassifier.MODEL_NAME,
      };
    });
  }
}
