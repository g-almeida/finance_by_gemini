import { Transaction, CategorizationRule, PaymentMethod, MemorizedEstablishment } from '../types';
import { findCategoryFromMemory } from './memoryService';

export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferPaymentMethod(desc: string): PaymentMethod {
  const norm = normalizeText(desc);
  if (norm.includes('pix')) return 'PIX';
  if (norm.includes('cartao de debito') || norm.includes('debito')) return 'Cartão de Débito';
  if (
    norm.includes('cartao de credito') ||
    norm.includes('compra cartao') ||
    norm.includes('compra visa') ||
    norm.includes('compra master') ||
    norm.includes('compra elo')
  ) {
    return 'Cartão de Crédito';
  }
  if (norm.includes('boleto') || norm.includes('pagamento titulo') || norm.includes('pagto titulo') || norm.includes('pagto eletron cobranca')) {
    return 'Boleto';
  }
  if (norm.includes('ted') || norm.includes('doc') || norm.includes('transferencia')) {
    return 'Transferência / TED';
  }
  if (norm.includes('saque') || norm.includes('dinheiro')) {
    return 'Dinheiro';
  }
  return 'Outro';
}

export function cleanTransactionDescription(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();

  // Strip common bank prefixes
  cleaned = cleaned
    .replace(/^PIX\s+TRANSF\s+/i, 'PIX ')
    .replace(/^PIX\s+ENVIADO\s+/i, 'PIX ')
    .replace(/^PIX\s+RECEBIDO\s+/i, 'PIX Recebido ')
    .replace(/^COMPRA\s+(CARTAO|ELO|VISA|MASTERCARD)\s+/i, '')
    .replace(/^PAGTO\s+ELETRON\s+COBRANCA\s+/i, 'Pgto ')
    .replace(/^PAGAMENTO\s+DE\s+TITULO\s+/i, 'Boleto ')
    .replace(/^PAGTO\s+TITULO\s+/i, 'Boleto ')
    .replace(/^REND\s+PAGO\s+APLIC\s+/i, 'Rendimento Aplicação ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

export function matchRule(
  description: string,
  rule: CategorizationRule
): boolean {
  if (!rule.active) return false;
  const normDesc = normalizeText(description);
  const normKeyword = normalizeText(rule.keyword);

  if (!normKeyword) return false;

  switch (rule.matchType) {
    case 'exact':
      return normDesc === normKeyword;
    case 'starts_with':
      return normDesc.startsWith(normKeyword);
    case 'regex':
      try {
        const regex = new RegExp(rule.keyword, 'i');
        return regex.test(description);
      } catch {
        return false;
      }
    case 'contains':
    default:
      return normDesc.includes(normKeyword);
  }
}

export function categorizeSingle(
  tx: Transaction,
  rules: CategorizationRule[],
  memory?: Record<string, MemorizedEstablishment>
): {
  category: string;
  paymentMethod?: PaymentMethod;
  cleanDescription?: string;
  isAutoCategorized: boolean;
  isMemorized?: boolean;
  ruleApplied?: string;
} {
  const rawText = `${tx.originalDescription || ''} ${tx.description || ''}`;

  // 1. High-priority check: Establishment Memory (user's prior selections)
  if (memory && Object.keys(memory).length > 0) {
    const memoryMatch =
      findCategoryFromMemory(tx.description, memory) ||
      findCategoryFromMemory(tx.originalDescription, memory);

    if (memoryMatch) {
      return {
        category: memoryMatch.category,
        paymentMethod: memoryMatch.paymentMethod || tx.paymentMethod || inferPaymentMethod(rawText),
        isAutoCategorized: true,
        isMemorized: true,
        ruleApplied: `Memória prévia: "${memoryMatch.pattern}" -> ${memoryMatch.category}`,
      };
    }
  }

  // 2. Custom rules check
  for (const rule of rules) {
    if (matchRule(rawText, rule)) {
      return {
        category: rule.category,
        paymentMethod: rule.paymentMethod || tx.paymentMethod || inferPaymentMethod(rawText),
        cleanDescription: rule.cleanDescription,
        isAutoCategorized: true,
        ruleApplied: `Regra: "${rule.keyword}" -> ${rule.category}`,
      };
    }
  }

  // If no rule or memory matched, infer payment method
  return {
    category: tx.category || 'Outros',
    paymentMethod: tx.paymentMethod || inferPaymentMethod(rawText),
    isAutoCategorized: false,
  };
}

export function batchCategorizeTransactions(
  transactions: Transaction[],
  rules: CategorizationRule[],
  forceRecategorize = false,
  memory?: Record<string, MemorizedEstablishment>
): { transactions: Transaction[]; categorizedCount: number } {
  let count = 0;
  const updated = transactions.map((tx) => {
    if (!forceRecategorize && tx.category && tx.category !== 'Outros' && !tx.isAutoCategorized) {
      // Keep manual categorization
      return tx;
    }

    const match = categorizeSingle(tx, rules, memory);
    if (match.isAutoCategorized && match.category !== tx.category) {
      count++;
      return {
        ...tx,
        category: match.category,
        paymentMethod: match.paymentMethod || tx.paymentMethod,
        description: match.cleanDescription || tx.description,
        isAutoCategorized: true,
        isMemorized: match.isMemorized,
        ruleApplied: match.ruleApplied,
      };
    }
    return tx;
  });

  return { transactions: updated, categorizedCount: count };
}

// Request server AI categorization via Gemini endpoint
export async function requestAICategorization(
  transactions: Transaction[],
  categories: string[]
): Promise<{ id: string; category: string; cleanDescription?: string; paymentMethod?: PaymentMethod }[]> {
  const response = await fetch('/api/categorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactions: transactions.map((t) => ({
        id: t.id,
        description: t.originalDescription || t.description,
        amount: t.amount,
      })),
      categories,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AI categorization failed with status ${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}
