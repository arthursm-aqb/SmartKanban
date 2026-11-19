import { describe, expect, it } from 'vitest';
import { DomainValidationError } from '../../../src/domain/errors';
import { InviteCode } from '../../../src/domain/value-objects/InviteCode';
import { PriorityScore } from '../../../src/domain/value-objects/PriorityScore';
import { WipLimit } from '../../../src/domain/value-objects/WipLimit';

describe('Domain Value Objects', () => {
  describe('PriorityScore', () => {
    const validCriteria = {
      businessAlignment: 4,
      technicalDependency: 5,
      userImpact: 3,
      boardUrgency: 2,
    };

    it('aceita inteiros de 0 a 5 e confiança de 0 a 1', () => {
      const zero = PriorityScore.create(0, 0.5, {
        businessAlignment: 0,
        technicalDependency: 0,
        userImpact: 0,
        boardUrgency: 0,
      });
      const five = PriorityScore.create(5, 0.92, validCriteria);
      expect(zero.value).toBe(0);
      expect(five.value).toBe(5);
      expect(five.confidence).toBe(0.92);
    });

    it('rejeita priorityScore < 0, > 5 ou decimal', () => {
      expect(() => PriorityScore.create(-1, 0.8, validCriteria)).toThrow(DomainValidationError);
      expect(() => PriorityScore.create(6, 0.8, validCriteria)).toThrow(DomainValidationError);
      expect(() => PriorityScore.create(3.5, 0.8, validCriteria)).toThrow(DomainValidationError);
      expect(() => PriorityScore.create(Number.NaN, 0.8, validCriteria)).toThrow(DomainValidationError);
    });

    it('rejeita confidence fora de [0, 1] ou critério fora de [0, 5]', () => {
      expect(() => PriorityScore.create(3, -0.1, validCriteria)).toThrow(DomainValidationError);
      expect(() => PriorityScore.create(3, 1.01, validCriteria)).toThrow(DomainValidationError);
      expect(() =>
        PriorityScore.create(3, 0.7, { ...validCriteria, userImpact: 6 }),
      ).toThrow(DomainValidationError);
    });
  });

  describe('WipLimit', () => {
    it('aceita null e inteiros de 1 a 99', () => {
      expect(WipLimit.create(null).isUnlimited()).toBe(true);
      expect(WipLimit.create(1).value).toBe(1);
      expect(WipLimit.create(99).value).toBe(99);
    });

    it('rejeita 0, negativos, > 99 ou decimais', () => {
      expect(() => WipLimit.create(0)).toThrow(DomainValidationError);
      expect(() => WipLimit.create(-2)).toThrow(DomainValidationError);
      expect(() => WipLimit.create(100)).toThrow(DomainValidationError);
      expect(() => WipLimit.create(2.5)).toThrow(DomainValidationError);
    });
  });

  describe('InviteCode', () => {
    it('normaliza para maiúsculas e valida 8 caracteres alfanuméricos', () => {
      expect(InviteCode.create(' ab12cd34 ').value).toBe('AB12CD34');
    });

    it('rejeita formatos inválidos', () => {
      expect(() => InviteCode.create('SHORT')).toThrow(DomainValidationError);
      expect(() => InviteCode.create('AB12-D34')).toThrow(DomainValidationError);
    });
  });
});
