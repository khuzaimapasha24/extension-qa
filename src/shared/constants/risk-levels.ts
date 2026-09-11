import { ActionRiskLevel } from '../types/agent';

export interface ActionRiskRule {
  pattern: RegExp;
  level: ActionRiskLevel;
  reason: string;
}

export const ACTION_RISK_RULES: ActionRiskRule[] = [
  {
    pattern: /(pay|checkout|purchase|credit|card|cvv|billing|stripe|paypal)/i,
    level: 'HIGH',
    reason: 'Payment or financial transaction detected',
  },
  {
    pattern: /(delete|remove|destroy|terminate|cancel-account|purge)/i,
    level: 'HIGH',
    reason: 'Destructive or irreversible data removal action',
  },
  {
    pattern: /(password|secret|auth-token|private-key)/i,
    level: 'HIGH',
    reason: 'Sensitive credential or authentication field alteration',
  },
  {
    pattern: /(submit|send[\s_-]?message|contact[\s_-]?(?:us|form)|post[\s_-]?comment|register|sign[\s_-]?up|form)/i,
    level: 'MEDIUM',
    reason: 'Form submission or external communication action',
  },
  {
    pattern: /(click|navigate|scroll|open|close|tab|accordion|modal|filter|search)/i,
    level: 'LOW',
    reason: 'Safe read-only UI exploration interaction',
  },
];

export function classifyActionRisk(actionDescription: string, elementText?: string): ActionRiskLevel {
  const combined = `${actionDescription} ${elementText || ''}`;
  for (const rule of ACTION_RISK_RULES) {
    if (rule.pattern.test(combined)) {
      return rule.level;
    }
  }
  return 'LOW';
}
