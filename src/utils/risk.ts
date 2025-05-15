import { RiskProbability, RiskImpact } from '@/types/risk';

export function calculateRiskScore(probability: RiskProbability, impact: RiskImpact): number {
  // Beispiel: HIGH = 3, MEDIUM = 2, LOW = 1
  const probMap = { [RiskProbability.LOW]: 1, [RiskProbability.MEDIUM]: 2, [RiskProbability.HIGH]: 3 };
  const impactMap = { [RiskImpact.LOW]: 1, [RiskImpact.MEDIUM]: 2, [RiskImpact.HIGH]: 3 };
  return probMap[probability] * impactMap[impact];
} 