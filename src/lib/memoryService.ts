import { PaymentMethod, Transaction } from '../types';
import { normalizeText, cleanTransactionDescription } from './categorizer';

export interface MemorizedEstablishment {
  id: string;
  pattern: string; // e.g. "Pão de Açúcar"
  normalizedKey: string; // e.g. "pao de acucar"
  category: string; // e.g. "Alimentação"
  paymentMethod?: PaymentMethod;
  updatedAt: string;
  useCount: number;
}

const STORAGE_KEY = 'fc_establishment_memory';

// Initial seed with high-confidence Brazilian establishments if user has no memory yet
const INITIAL_MEMORY_SEEDS: Omit<MemorizedEstablishment, 'id' | 'updatedAt' | 'useCount'>[] = [
  { pattern: 'iFood', normalizedKey: 'ifood', category: 'Alimentação', paymentMethod: 'Cartão de Crédito' },
  { pattern: 'Pão de Açúcar', normalizedKey: 'pao de acucar', category: 'Alimentação', paymentMethod: 'Cartão de Débito' },
  { pattern: 'Carrefour', normalizedKey: 'carrefour', category: 'Alimentação', paymentMethod: 'Cartão de Débito' },
  { pattern: 'Uber', normalizedKey: 'uber', category: 'Transporte', paymentMethod: 'Cartão de Crédito' },
  { pattern: '99 App', normalizedKey: '99app', category: 'Transporte', paymentMethod: 'Cartão de Crédito' },
  { pattern: 'Netflix', normalizedKey: 'netflix', category: 'Lazer & Assinaturas', paymentMethod: 'Cartão de Crédito' },
  { pattern: 'Spotify', normalizedKey: 'spotify', category: 'Lazer & Assinaturas', paymentMethod: 'Cartão de Crédito' },
  { pattern: 'Smart Fit', normalizedKey: 'smart fit', category: 'Saúde & Farmácia', paymentMethod: 'Cartão de Crédito' },
  { pattern: 'Drogasil', normalizedKey: 'drogasil', category: 'Saúde & Farmácia', paymentMethod: 'Cartão de Débito' },
  { pattern: 'Droga Raia', normalizedKey: 'droga raia', category: 'Saúde & Farmácia', paymentMethod: 'Cartão de Débito' },
  { pattern: 'Posto Shell', normalizedKey: 'posto shell', category: 'Transporte', paymentMethod: 'Cartão de Débito' },
  { pattern: 'Posto Ipiranga', normalizedKey: 'posto ipiranga', category: 'Transporte', paymentMethod: 'Cartão de Débito' },
];

/**
 * Loads memorized establishments from localStorage
 */
export function loadEstablishmentMemory(): Record<string, MemorizedEstablishment> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load establishment memory from localStorage', e);
  }

  // Seed default map
  const seeded: Record<string, MemorizedEstablishment> = {};
  const now = new Date().toISOString();
  INITIAL_MEMORY_SEEDS.forEach((seed, idx) => {
    seeded[seed.normalizedKey] = {
      id: `seed_${idx}`,
      ...seed,
      updatedAt: now,
      useCount: 1,
    };
  });
  return seeded;
}

/**
 * Saves memorized establishments to localStorage
 */
export function saveEstablishmentMemory(memory: Record<string, MemorizedEstablishment>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch (e) {
    console.warn('Failed to persist establishment memory to localStorage', e);
  }
}

/**
 * Extracts a normalized key from a merchant description by removing bank prefixes, numbers, and noise
 */
export function extractEstablishmentKey(rawText: string): { cleanName: string; normalizedKey: string } {
  if (!rawText) return { cleanName: '', normalizedKey: '' };

  const cleaned = cleanTransactionDescription(rawText)
    .replace(/\*+/g, ' ')
    .replace(/\b\d{4,}\b/g, '') // remove account/terminal numbers
    .replace(/\s+/g, ' ')
    .trim();

  const norm = normalizeText(cleaned);
  return {
    cleanName: cleaned || rawText.trim(),
    normalizedKey: norm,
  };
}

/**
 * Records or updates a category selection for an establishment
 */
export function recordEstablishmentCategory(
  rawPattern: string,
  category: string,
  paymentMethod?: PaymentMethod,
  currentMemory: Record<string, MemorizedEstablishment> = loadEstablishmentMemory()
): { memory: Record<string, MemorizedEstablishment>; saved: MemorizedEstablishment | null } {
  if (!rawPattern || !category || category === 'Outros' || category === 'Não categorizado') {
    return { memory: currentMemory, saved: null };
  }

  const { cleanName, normalizedKey } = extractEstablishmentKey(rawPattern);
  if (!normalizedKey || normalizedKey.length < 2) {
    return { memory: currentMemory, saved: null };
  }

  const existing = currentMemory[normalizedKey];
  const updatedEntry: MemorizedEstablishment = {
    id: existing?.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    pattern: cleanName || rawPattern,
    normalizedKey,
    category,
    paymentMethod: paymentMethod || existing?.paymentMethod,
    updatedAt: new Date().toISOString(),
    useCount: (existing?.useCount || 0) + 1,
  };

  const nextMemory = {
    ...currentMemory,
    [normalizedKey]: updatedEntry,
  };

  saveEstablishmentMemory(nextMemory);
  return { memory: nextMemory, saved: updatedEntry };
}

/**
 * Records multiple establishment descriptions in batch
 */
export function recordBulkEstablishmentCategories(
  patterns: string[],
  category: string,
  paymentMethod?: PaymentMethod,
  currentMemory: Record<string, MemorizedEstablishment> = loadEstablishmentMemory()
): Record<string, MemorizedEstablishment> {
  let updatedMemory = { ...currentMemory };
  for (const p of patterns) {
    if (!p) continue;
    const { memory } = recordEstablishmentCategory(p, category, paymentMethod, updatedMemory);
    updatedMemory = memory;
  }
  return updatedMemory;
}

/**
 * Searches the memory for a matching establishment
 */
export function findCategoryFromMemory(
  text: string,
  memory: Record<string, MemorizedEstablishment>
): MemorizedEstablishment | null {
  if (!text) return null;

  const { normalizedKey } = extractEstablishmentKey(text);
  const rawNorm = normalizeText(text);

  // 1. Direct exact match on cleaned key
  if (normalizedKey && memory[normalizedKey]) {
    return memory[normalizedKey];
  }

  // 2. Direct exact match on full raw normalized text
  if (rawNorm && memory[rawNorm]) {
    return memory[rawNorm];
  }

  // 3. Substring match: check all keys in memory, preferring the longest match
  const keys = Object.keys(memory).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (key.length < 3) continue;

    // Check if key is a standalone word or phrase inside rawNorm
    if (rawNorm.includes(key) || (normalizedKey && normalizedKey.includes(key))) {
      return memory[key];
    }

    // Check if rawNorm is contained within the key (if rawNorm is long enough)
    if (normalizedKey && normalizedKey.length >= 4 && key.includes(normalizedKey)) {
      return memory[key];
    }
  }

  return null;
}

/**
 * Applies remembered categories to a list of transactions
 */
export function applyMemoryToTransactions(
  transactions: Transaction[],
  memory: Record<string, MemorizedEstablishment>,
  overrideExisting = false
): { updated: Transaction[]; matchCount: number } {
  let matchCount = 0;

  const updated = transactions.map((tx) => {
    // If not overriding and already categorized with something other than 'Outros'/'Não categorizado'
    if (
      !overrideExisting &&
      tx.category &&
      tx.category !== 'Outros' &&
      tx.category !== 'Não categorizado' &&
      !tx.isAutoCategorized
    ) {
      return tx;
    }

    const match =
      findCategoryFromMemory(tx.description, memory) ||
      findCategoryFromMemory(tx.originalDescription, memory);

    if (match) {
      const changed = tx.category !== match.category;
      if (changed) matchCount++;

      return {
        ...tx,
        category: match.category,
        paymentMethod: match.paymentMethod || tx.paymentMethod,
        isAutoCategorized: true,
        ruleApplied: `Memória: "${match.pattern}" -> ${match.category}`,
      };
    }

    return tx;
  });

  return { updated, matchCount };
}

/**
 * Deletes a memorized establishment from storage
 */
export function deleteEstablishmentMemory(
  normalizedKey: string,
  currentMemory: Record<string, MemorizedEstablishment>
): Record<string, MemorizedEstablishment> {
  const next = { ...currentMemory };
  delete next[normalizedKey];
  saveEstablishmentMemory(next);
  return next;
}

/**
 * Clears all user memorized establishments
 */
export function clearAllEstablishmentMemory(): Record<string, MemorizedEstablishment> {
  saveEstablishmentMemory({});
  return {};
}
