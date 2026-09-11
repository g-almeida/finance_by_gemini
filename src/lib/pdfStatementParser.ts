import { Transaction, PaymentMethod } from '../types';

export interface ParsedPdfResult {
  transactions: Transaction[];
  year: number;
  detectedPeriod?: string;
  source: 'gemini' | 'algorithmic';
  rawTextLength?: number;
}

/**
 * Infer payment method from transaction description
 */
export function inferPaymentMethodFromDescription(desc: string): PaymentMethod {
  const upper = desc.toUpperCase();
  if (upper.includes('PIX')) return 'PIX';
  if (upper.includes('CARTAO') || upper.includes('CARTÃO') || upper.includes('COMPRA CART')) {
    if (upper.includes('DEBITO') || upper.includes('DÉBITO')) return 'Cartão de Débito';
    return 'Cartão de Débito'; // in bank account statements, debit cards are most common
  }
  if (upper.includes('BOLETO') || upper.includes('PAG BOLETO') || upper.includes('SISCOM') || upper.includes('PAGAMENTO TITULO')) {
    return 'Boleto';
  }
  if (upper.includes('TED') || upper.includes('DOC') || upper.includes('TRANSF') || upper.includes('TEF')) {
    return 'Transferência / TED';
  }
  if (upper.includes('DINHEIRO') || upper.includes('SAQUE')) {
    return 'Dinheiro';
  }
  return 'Outro';
}

/**
 * Clean and normalize transaction description from Itaú bank extracts
 */
export function cleanItauDescription(desc: string): string {
  let cleaned = desc
    .replace(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s*/, '')
    .replace(/^(R\$|\$)\s*/, '')
    .trim();

  // Strip trailing amounts or signs
  cleaned = cleaned.replace(/[-+]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[-+]?$/, '').trim();

  // Common bank prefixes to simplify
  const bankPrefixes = [
    'PIX TRANSF',
    'PIX RECEBIDO',
    'PIX ENVIADO',
    'TED RECEBIDA',
    'TED TRANSF',
    'PAGTO ELETRONICO',
    'PAG BOLETO',
    'COMPRA CARTAO',
    'COMPRA DEBITO',
    'REND PAGO APLIC',
  ];

  for (const prefix of bankPrefixes) {
    if (cleaned.toUpperCase().startsWith(prefix)) {
      // Keep prefix readable
      break;
    }
  }

  return cleaned || desc;
}

/**
 * Check if a line is an Itaú balance row or summary row (should NOT be a transaction)
 */
export function isItauBalanceOrHeaderRow(line: string): boolean {
  const upper = line.toUpperCase().trim();

  const ignorePatterns = [
    'SALDO ANTERIOR',
    'SALDO DO DIA',
    'SDO CTA/APL',
    'SDO CTA',
    'SALDO FINAL',
    'SALDO TOTAL DISPONIVEL',
    'SALDO DISPONIVEL',
    'SALDO EM CONTA',
    'TOTAL DE ENTRADAS',
    'TOTAL DE SAIDAS',
    'TOTAL DE SAÍDAS',
    'LIMITE CHEQUE ESPECIAL',
    'LIMITE DA CONTA',
    'EXTRATO DE CONTA CORRENTE',
    'EXTRATO MENSAL',
    'EXTRATO CONSOLIDADO',
    'BANCO ITAU',
    'ITAU UNIBANCO',
    'AGENCIA / CONTA',
    'AGÊNCIA / CONTA',
    'FOLHA / SEQUENCIA',
    'DATA LANÇAMENTO',
    'DATA LANCAMENTO',
    'HISTÓRICO',
    'HISTORICO',
    'DOCUMENTO VALOR',
    'DOCUMENTO',
    'OUVIDORIA',
    'SAC ITAU',
    'DEFICIENTE AUDITIVO',
    'FALE CONOSCO',
    'CENTRAL DE ATENDIMENTO',
  ];

  for (const pat of ignorePatterns) {
    if (upper.includes(pat)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect year from text, filename, or folder path
 */
export function detectYearFromContext(
  text: string,
  fileName: string = '',
  folderPath: string = '',
  defaultYear: number = 2026
): number {
  // Check filename first e.g. "extrato_2026_01.pdf" or "2026"
  const fileMatch = fileName.match(/\b(202\d)\b/);
  if (fileMatch) {
    const yr = parseInt(fileMatch[1], 10);
    if (yr >= 2020 && yr <= 2035) return yr;
  }

  // Check folder path e.g. "...itau/extract/2026"
  const folderMatch = folderPath.match(/\b(202\d)\b/);
  if (folderMatch) {
    const yr = parseInt(folderMatch[1], 10);
    if (yr >= 2020 && yr <= 2035) return yr;
  }

  // Check period in text e.g. "Período: 01/01/2026 a 31/01/2026" or "01/2026"
  const periodMatch = text.match(/Per[íi]odo:?\s*\d{2}\/\d{2}\/(202\d)/i);
  if (periodMatch) {
    return parseInt(periodMatch[1], 10);
  }

  const monthYearMatch = text.match(/\b\d{2}\/(202\d)\b/);
  if (monthYearMatch) {
    return parseInt(monthYearMatch[1], 10);
  }

  // Any 202x in header area
  const headText = text.slice(0, 2000);
  const headYear = headText.match(/\b(202[4-9])\b/);
  if (headYear) {
    return parseInt(headYear[1], 10);
  }

  return defaultYear;
}

/**
 * Deterministic line-by-line parser for Itaú Bank Account Statement text
 */
export function parseItauBankExtractText(
  rawText: string,
  fileName: string = '',
  folderPath: string = '',
  defaultYear: number = 2026
): ParsedPdfResult {
  const year = detectYearFromContext(rawText, fileName, folderPath, defaultYear);
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const transactions: Transaction[] = [];

  // Look for date at start of line: DD/MM or DD/MM/AAAA
  // Followed by description, followed by amount and possible minus sign or (-)
  const lineRegex = /^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+([+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*[-+]?|\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:\(-\)|[-+]))(?:\s+.*)?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isItauBalanceOrHeaderRow(line)) {
      continue;
    }

    const match = line.match(lineRegex);
    if (match) {
      const rawDate = match[1];
      const rawDesc = match[2].trim();
      const rawVal = match[3].trim();

      if (isItauBalanceOrHeaderRow(rawDesc)) {
        continue;
      }

      // Parse date: format to YYYY-MM-DD
      const dateParts = rawDate.split('/');
      const day = dateParts[0].padStart(2, '0');
      const month = dateParts[1].padStart(2, '0');
      let txYear = year;
      if (dateParts[2]) {
        const yr = parseInt(dateParts[2], 10);
        txYear = yr < 100 ? 2000 + yr : yr;
      }
      const dateStr = `${txYear}-${month}-${day}`;

      // Parse amount & sign
      // Is it negative or positive?
      // In Itaú: debits usually have trailing '-' or '(-)' or leading '-'
      // Credits/earnings have no '-' or have '+' or '(+)' or keyword like REND PAGO, SALARIO, etc.
      let isNegative = false;
      if (
        rawVal.includes('-') ||
        rawVal.includes('(-)') ||
        line.endsWith('-') ||
        line.endsWith('D') ||
        /\bDEB\b/i.test(rawDesc) ||
        /\bDEBITO\b/i.test(rawDesc) ||
        /\bCOMPRA\b/i.test(rawDesc) ||
        /\bPAGTO\b/i.test(rawDesc) ||
        /\bTARIFA\b/i.test(rawDesc) ||
        /\bSISCOM\b/i.test(rawDesc) ||
        /\bIOF\b/i.test(rawDesc)
      ) {
        isNegative = true;
      }

      // Check for strong credit/income keywords that override false negative detection
      const upperDesc = rawDesc.toUpperCase();
      const isStrongCredit =
        upperDesc.includes('REND PAGO') ||
        upperDesc.includes('SALARIO') ||
        upperDesc.includes('SALÁRIO') ||
        upperDesc.includes('PRO-LABORE') ||
        upperDesc.includes('PRO LABORE') ||
        upperDesc.includes('DIVIDENDO') ||
        upperDesc.includes('TED RECEBIDA') ||
        upperDesc.includes('PIX RECEBIDO') ||
        upperDesc.includes('TED REC') ||
        upperDesc.includes('DEP DINHEIRO') ||
        upperDesc.includes('DEPOSITO') ||
        upperDesc.includes('ESTORNO') ||
        upperDesc.includes('RESG APLIC') ||
        rawVal.includes('+') ||
        rawVal.includes('(+)');

      if (isStrongCredit && !rawVal.includes('-')) {
        isNegative = false;
      }

      // Clean number string
      const cleanNumStr = rawVal
        .replace(/[^\d,-]/g, '')
        .replace('-', '')
        .replace('.', '')
        .replace(',', '.');

      const absVal = parseFloat(cleanNumStr);
      if (isNaN(absVal) || absVal === 0) continue;

      const finalAmount = isNegative ? -absVal : absVal;

      // Suggest initial category
      let category = 'Outros';
      let isEarning = false;

      if (finalAmount > 0) {
        isEarning = true;
        if (upperDesc.includes('REND PAGO') || upperDesc.includes('RESG APLIC') || upperDesc.includes('INVEST')) {
          category = 'Investimentos';
        } else if (upperDesc.includes('SALARIO') || upperDesc.includes('SALÁRIO') || upperDesc.includes('PRO-LABORE')) {
          category = 'Salário & Receitas';
        } else if (upperDesc.includes('PIX RECEB') || upperDesc.includes('TED REC') || upperDesc.includes('TRANSF REC')) {
          category = 'Transferências & PIX';
        } else {
          category = 'Salário & Receitas';
        }
      } else {
        if (upperDesc.includes('PIX')) {
          category = 'Transferências & PIX';
        } else if (upperDesc.includes('CARTAO') || upperDesc.includes('CARTÃO')) {
          category = 'Compras Pessoais';
        } else if (upperDesc.includes('TARIFA') || upperDesc.includes('IOF')) {
          category = 'Impostos & Taxas';
        } else if (upperDesc.includes('PAG BOLETO') || upperDesc.includes('SISCOM')) {
          category = 'Serviços & Assinaturas';
        }
      }

      const pm = inferPaymentMethodFromDescription(rawDesc);
      const cleanDesc = cleanItauDescription(rawDesc);

      transactions.push({
        id: `itau-extract-${dateStr}-${i}-${Math.round(absVal * 100)}`,
        date: dateStr,
        description: cleanDesc,
        originalDescription: rawDesc,
        amount: finalAmount,
        category,
        paymentMethod: pm,
        sourceFile: fileName,
        sourceFolder: folderPath || '...itau/extract',
        sourceType: 'bank_account',
        fileType: 'pdf',
        isEarning,
        isAutoCategorized: true,
        ruleApplied: `Extrato Conta Corrente Itaú (${isEarning ? 'Ganho / Crédito' : 'Débito'})`,
      });
    }
  }

  return {
    transactions,
    year,
    source: 'algorithmic',
    rawTextLength: rawText.length,
  };
}
