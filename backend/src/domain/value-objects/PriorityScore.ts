import { DomainValidationError } from '../errors';

export interface PriorityCriteria {
  businessAlignment: number;
  technicalDependency: number;
  userImpact: number;
  boardUrgency: number;
}

export class PriorityScore {
  public readonly value: number;
  public readonly confidence: number;
  public readonly criteria: PriorityCriteria;

  private constructor(value: number, confidence: number, criteria: PriorityCriteria) {
    this.value = value;
    this.confidence = confidence;
    this.criteria = criteria;
  }

  private static assertValidScore(score: number, fieldName: string): number {
    if (!Number.isInteger(score) || score < 0 || score > 5) {
      throw new DomainValidationError(
        `${fieldName} deve ser um número inteiro entre 0 e 5 (recebido: ${String(score)}).`,
      );
    }
    return score;
  }

  private static assertValidConfidence(confidence: number): number {
    if (typeof confidence !== 'number' || Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new DomainValidationError(
        `confidence deve ser um número entre 0 e 1 (recebido: ${String(confidence)}).`,
      );
    }
    return Number(confidence.toFixed(4));
  }

  public static create(value: number, confidence: number, criteria: PriorityCriteria): PriorityScore {
    const validatedValue = PriorityScore.assertValidScore(value, 'priorityScore');
    const validatedConfidence = PriorityScore.assertValidConfidence(confidence);
    const validatedCriteria: PriorityCriteria = {
      businessAlignment: PriorityScore.assertValidScore(criteria.businessAlignment, 'businessAlignment'),
      technicalDependency: PriorityScore.assertValidScore(criteria.technicalDependency, 'technicalDependency'),
      userImpact: PriorityScore.assertValidScore(criteria.userImpact, 'userImpact'),
      boardUrgency: PriorityScore.assertValidScore(criteria.boardUrgency, 'boardUrgency'),
    };
    return new PriorityScore(validatedValue, validatedConfidence, validatedCriteria);
  }
}
