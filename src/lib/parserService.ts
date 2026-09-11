import * as XLSX from 'xlsx';
import { Transaction } from '../types';
import { cleanTransactionDescription, inferPaymentMethod } from './categorizer';

/**
 * Checks whether a given raw value resembles a date (string, Date, or Excel serial number)
 */
export function isDateLike(raw: any): boolean {
  if (raw === null || raw === undefined || raw === '') return false;
  if (raw instanceof Date) return true;

  if (typeof raw === 'number') {
    // Excel serial date for years ~2015 to 2035 (approx 42000 to 50000)
    return raw >= 40000 && raw <= 55000;
  }

  const str = String(raw).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true;
  // DD/MM/YYYY or DD-MM-YYYY or DD/MM
  if (/^\d{1,2}[\/\.-]\d{1,2}([\/\.-]\d{2,4})?$/.test(str)) return true;

  return false;
}

/**
 * Parse Excel serial date or string date (DD/MM/YYYY, YYYY-MM-DD)
 */
export function parseExcelDate(raw: any, fallbackYear = new Date().getFullYear()): string {
  if (raw === null || raw === undefined || raw === '') {
    return new Date().toISOString().split('T')[0];
  }

  // If number (Excel serial date)
  if (typeof raw === 'number') {
    // Excel epoch is 1899-12-30
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  if (raw instanceof Date) {
    if (!isNaN(raw.getTime())) {
      return raw.toISOString().split('T')[0];
    }
  }

  const str = String(raw).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const matchFull = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/);
  if (matchFull) {
    const day = matchFull[1].padStart(2, '0');
    const month = matchFull[2].padStart(2, '0');
    let year = matchFull[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  // DD/MM (short Itaú date)
  const matchShort = str.match(/^(\d{1,2})[\/\.-](\d{1,2})$/);
  if (matchShort) {
    const day = matchShort[1].padStart(2, '0');
    const month = matchShort[2].padStart(2, '0');
    return `${fallbackYear}-${month}-${day}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Parse Brazilian currency format "1.234,56" or "-1.234,56" or "(1.234,56)"
 */
export function parseBrazilianAmount(raw: any): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;

  let str = String(raw).trim();
  const isParentheses = str.startsWith('(') && str.endsWith(')');
  str = str.replace(/[()R$\s]/g, '');

  // If contains comma as decimal separator (e.g. 1.250,50)
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }

  let val = parseFloat(str);
  if (isNaN(val)) return 0;
  if (isParentheses && val > 0) {
    val = -val;
  }
  return val;
}

/**
 * Robust extractor for description/establishment text from a spreadsheet row.
 * Guarantees that the date column is NEVER mistaken for description.
 */
export function extractRowDescription(
  row: any[],
  preferredColDesc: number,
  colDate: number,
  dateStr: string,
  excludedCols: number[] = []
): { description: string; resolvedColDesc: number } {
  let rawDesc = '';
  if (
    preferredColDesc !== -1 &&
    preferredColDesc !== colDate &&
    preferredColDesc < row.length
  ) {
    rawDesc = String(row[preferredColDesc] ?? '').trim();
  }

  // If rawDesc is empty OR looks like a date OR equals dateStr, actively search other columns
  const looksLikeDate =
    !rawDesc ||
    isDateLike(rawDesc) ||
    rawDesc === dateStr ||
    rawDesc === String(row[colDate] ?? '').trim() ||
    parseExcelDate(rawDesc) === dateStr;

  if (looksLikeDate) {
    for (let c = 0; c < row.length; c++) {
      if (c === colDate || excludedCols.includes(c)) continue;
      const cellVal = String(row[c] ?? '').trim();
      if (!cellVal) continue;

      if (
        isDateLike(cellVal) ||
        cellVal === dateStr ||
        cellVal === String(row[colDate] ?? '').trim() ||
        parseExcelDate(cellVal) === dateStr
      ) {
        continue;
      }

      // Skip purely numeric values or currency amounts
      const numTest = cellVal.replace(/[R$\s\.]/g, '').replace(',', '.');
      if (!isNaN(Number(numTest)) && numTest.length > 0) continue;

      // Check if string contains alphabetical characters (merchant, store name, description)
      if (/[a-zA-ZáéíóúãõçÁÉÍÓÚÃÕÇ]{2,}/.test(cellVal)) {
        return { description: cellVal, resolvedColDesc: c };
      }
    }
  }

  return { description: rawDesc || 'Transação', resolvedColDesc: preferredColDesc };
}

// Generate unique deterministic transaction id
export function generateTransactionId(date: string, desc: string, amount: number, idx: number): string {
  const norm = desc.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
  return `tx_${date}_${Math.round(amount * 100)}_${norm}_${idx}`;
}

export interface ParseResult {
  transactions: Transaction[];
  sheetNames: string[];
  totalRowsFound: number;
  warnings: string[];
  isMainControlSheet?: boolean;
}

export function parseStatementBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName = 'extrato.xlsx'
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const warnings: string[] = [];
  const transactions: Transaction[] = [];

  const isMainSheet =
    fileName.toLowerCase().includes('controle financeiro lindo2') ||
    workbook.SheetNames.some(
      (name) =>
        name.toLowerCase().includes('transa') ||
        name.toLowerCase().includes('hist') ||
        name.toLowerCase().includes('controle')
    );

  if (isMainSheet) {
    // Attempt to parse Tab 2 (Transactions history) or Tab 3 (Monthly auto)
    const result = parseMainControlSheet(workbook, fileName);
    if (result.transactions.length > 0) {
      return result;
    }
  }

  // Parse generic statement (Itaú checking account, credit card, or custom sheet)
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const data: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    if (!data || data.length === 0) continue;

    // Find header row
    let headerRowIdx = -1;
    let colDate = -1;
    let colDesc = -1;
    let colAmount = -1;
    let colEntrada = -1;
    let colSaida = -1;
    let colCategory = -1;
    let colPayment = -1;

    for (let r = 0; r < Math.min(25, data.length); r++) {
      const row = data[r];
      if (!Array.isArray(row)) continue;

      let tempDate = -1;
      let tempDesc = -1;
      let tempAmount = -1;
      let tempEntrada = -1;
      let tempSaida = -1;
      let tempCategory = -1;
      let tempPayment = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if (!val) continue;

        // Date column identification: must explicitly check for date keywords
        const isDateHeader =
          val === 'data' ||
          val === 'dt' ||
          val.startsWith('data ') ||
          val.startsWith('dt.') ||
          val.startsWith('dt ') ||
          val.includes('data lancamento') ||
          val.includes('data do lancamento') ||
          val.includes('data da transacao') ||
          val.includes('data compra') ||
          val.includes('dt lancamento');

        if (isDateHeader) {
          tempDate = c;
          continue; // Crucial: once identified as date, NEVER set as description!
        }

        // Description / Merchant column identification
        const isDescHeader =
          val.includes('descricao') ||
          val.includes('descrição') ||
          val.includes('historico') ||
          val.includes('histórico') ||
          val.includes('estabelecimento') ||
          val.includes('estab') ||
          val.includes('comercio') ||
          val.includes('comércio') ||
          val.includes('loja') ||
          val.includes('favorecido') ||
          val.includes('beneficiario') ||
          val.includes('beneficiário') ||
          val.includes('transacao') ||
          val.includes('transação') ||
          val.includes('movimento') ||
          val.includes('movimentacao') ||
          val.includes('movimentação') ||
          val.includes('identificacao') ||
          val.includes('identificação') ||
          val.includes('detalhe') ||
          val.includes('detalhes') ||
          val.includes('discriminacao') ||
          val.includes('discriminação') ||
          val.includes('lancamento') ||
          val.includes('lançamento') ||
          val === 'item' ||
          val === 'nome' ||
          val === 'titulo' ||
          val === 'compra';

        if (isDescHeader && tempDesc === -1) {
          tempDesc = c;
          continue;
        }

        if (
          val.includes('valor') ||
          val === 'r$' ||
          val.includes('valor r$') ||
          val.includes('quantia')
        ) {
          tempAmount = c;
          continue;
        }

        if (val.includes('entrada') || val.includes('credito') || val.includes('receita')) {
          tempEntrada = c;
          continue;
        }

        if (val.includes('saida') || val.includes('debito') || val.includes('despesa')) {
          tempSaida = c;
          continue;
        }

        if (val.includes('categoria')) {
          tempCategory = c;
          continue;
        }

        if (
          val.includes('pagamento') ||
          val.includes('cartao') ||
          val.includes('forma') ||
          val.includes('meio')
        ) {
          tempPayment = c;
          continue;
        }
      }

      if (
        tempDate !== -1 &&
        (tempDesc !== -1 ||
          tempAmount !== -1 ||
          (tempEntrada !== -1 && tempSaida !== -1) ||
          tempCategory !== -1)
      ) {
        headerRowIdx = r;
        colDate = tempDate;
        colDesc = tempDesc;
        colAmount = tempAmount;
        colEntrada = tempEntrada;
        colSaida = tempSaida;
        colCategory = tempCategory;
        colPayment = tempPayment;
        break;
      }
    }

    // Fallback if no explicit header row found: look for first row with a valid date in column 0
    if (headerRowIdx === -1) {
      for (let r = 0; r < Math.min(20, data.length); r++) {
        const row = data[r];
        if (!Array.isArray(row) || row.length < 2) continue;
        const potentialDate = String(row[0] || '').trim();
        if (isDateLike(potentialDate)) {
          headerRowIdx = r - 1; // start reading from r
          colDate = 0;
          colDesc = 1; // assume column 1 is description
          colAmount = row.length > 2 ? 2 : 1;
          break;
        }
      }
    }

    if (headerRowIdx === -1 || colDate === -1) {
      continue;
    }

    // Double check: colDesc must never equal colDate
    if (colDesc === colDate) {
      colDesc = -1;
    }

    // If colDesc is still -1, choose the first non-date, non-amount column in header row
    if (colDesc === -1 && headerRowIdx !== -1 && headerRowIdx < data.length) {
      const headerRow = data[headerRowIdx];
      for (let c = 0; c < headerRow.length; c++) {
        if (
          c !== colDate &&
          c !== colAmount &&
          c !== colEntrada &&
          c !== colSaida &&
          c !== colCategory &&
          c !== colPayment
        ) {
          colDesc = c;
          break;
        }
      }
    }

    // Read data rows
    let rowCount = 0;
    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawDate = row[colDate];
      if (!rawDate) continue;

      const dateStr = parseExcelDate(rawDate);

      // Extract description safely ensuring date column is never used as description
      const excludedCols = [colAmount, colEntrada, colSaida, colCategory, colPayment].filter(
        (c) => c !== -1
      );
      const { description: rawDesc, resolvedColDesc } = extractRowDescription(
        row,
        colDesc,
        colDate,
        dateStr,
        excludedCols
      );

      if (colDesc === -1 && resolvedColDesc !== -1) {
        colDesc = resolvedColDesc;
      }

      // Skip summary / balance rows that aren't transactions
      const lowerDesc = rawDesc.toLowerCase();
      if (
        lowerDesc.includes('saldo anterior') ||
        lowerDesc.includes('saldo do dia') ||
        lowerDesc.includes('saldo final') ||
        lowerDesc.includes('total de entradas') ||
        lowerDesc.includes('total de saidas') ||
        lowerDesc.length === 0
      ) {
        continue;
      }

      let amount = 0;
      if (colEntrada !== -1 && colSaida !== -1) {
        const entrada = parseBrazilianAmount(row[colEntrada]);
        const saida = parseBrazilianAmount(row[colSaida]);
        if (entrada > 0) amount = entrada;
        else if (saida !== 0) amount = -Math.abs(saida);
      } else if (colAmount !== -1) {
        amount = parseBrazilianAmount(row[colAmount]);
      } else {
        amount = parseBrazilianAmount(row[2]);
      }

      // If amount is 0 and description is default, ignore
      if (amount === 0 && (!rawDesc || rawDesc === 'Transação')) continue;

      // In credit card statements, expenses are often positive numbers.
      const isCardFile =
        fileName.toLowerCase().includes('fatura') || fileName.toLowerCase().includes('cartao');
      if (
        isCardFile &&
        amount > 0 &&
        !lowerDesc.includes('pagamento recebido') &&
        !lowerDesc.includes('estorno')
      ) {
        amount = -amount;
      }

      const category = colCategory !== -1 ? String(row[colCategory] || '').trim() : '';
      const paymentMethod =
        colPayment !== -1
          ? (String(row[colPayment] || '').trim() as any)
          : inferPaymentMethod(rawDesc);

      const cleanedDesc = cleanTransactionDescription(rawDesc);
      const finalDesc = cleanedDesc || rawDesc;
      const txId = generateTransactionId(dateStr, finalDesc, amount, rowCount++);

      transactions.push({
        id: txId,
        date: dateStr,
        description: finalDesc,
        originalDescription: rawDesc,
        amount,
        category: category || 'Outros',
        paymentMethod: paymentMethod || inferPaymentMethod(rawDesc),
        sourceFile: fileName,
        sourceSheet: sheetName,
        isAutoCategorized: Boolean(category && category !== 'Outros'),
      });
    }
  }

  return {
    transactions,
    sheetNames: workbook.SheetNames,
    totalRowsFound: transactions.length,
    warnings,
    isMainControlSheet: false,
  };
}

/**
 * Dedicated parser for 'Controle Financeiro lindo2.xlsx'
 * Carefully parses Tab 2 (Transactions history) and Tab 3 (Monthly auto-extracted transactions)
 */
export function parseMainControlSheet(
  workbook: XLSX.WorkBook,
  fileName: string
): ParseResult {
  const transactions: Transaction[] = [];
  const sheetNames = workbook.SheetNames;
  const warnings: string[] = [];

  // Tab 2 is index 1, Tab 3 is index 2. We search candidate sheets:
  const candidateIndices: number[] = [];
  sheetNames.forEach((name, idx) => {
    const low = name.toLowerCase();
    if (
      low.includes('transa') ||
      low.includes('hist') ||
      low.includes('lanc') ||
      low.includes('geral') ||
      idx === 1 || // 2nd tab
      idx === 2 // 3rd tab
    ) {
      if (!candidateIndices.includes(idx)) candidateIndices.push(idx);
    }
  });

  if (candidateIndices.length === 0 && sheetNames.length > 0) {
    candidateIndices.push(0);
  }

  for (const idx of candidateIndices) {
    if (idx >= sheetNames.length) continue;
    const name = sheetNames[idx];
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;

    const data: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    if (!data || data.length < 2) continue;

    // Search for header row
    let headerRowIdx = -1;
    let colDate = -1;
    let colDesc = -1;
    let colAmount = -1;
    let colCategory = -1;
    let colPayment = -1;

    for (let r = 0; r < Math.min(15, data.length); r++) {
      const row = data[r];
      if (!Array.isArray(row)) continue;

      let tempDate = -1;
      let tempDesc = -1;
      let tempAmount = -1;
      let tempCat = -1;
      let tempPay = -1;

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').toLowerCase().trim();
        if (!val) continue;

        const isDate =
          val === 'data' ||
          val === 'dt' ||
          val.startsWith('data ') ||
          val.startsWith('dt.') ||
          val.includes('data lancamento') ||
          val.includes('data do lancamento');

        if (isDate) {
          tempDate = c;
          continue;
        }

        const isDesc =
          val.includes('descri') ||
          val.includes('estab') ||
          val.includes('hist') ||
          val.includes('item') ||
          val.includes('comercio') ||
          val.includes('loja') ||
          val.includes('favorec') ||
          val.includes('transa') ||
          val.includes('movim') ||
          val.includes('identif') ||
          val.includes('detalhe') ||
          val.includes('lancamento') ||
          val === 'nome' ||
          val === 'titulo';

        if (isDesc && tempDesc === -1) {
          tempDesc = c;
          continue;
        }

        if (val.includes('valor') || val === 'r$' || val.includes('quantia')) {
          tempAmount = c;
          continue;
        }

        if (val.includes('categ')) {
          tempCat = c;
          continue;
        }

        if (
          val.includes('pagamento') ||
          val.includes('metodo') ||
          val.includes('cartao') ||
          val.includes('forma')
        ) {
          tempPay = c;
          continue;
        }
      }

      if (tempDate !== -1 && (tempDesc !== -1 || tempAmount !== -1 || tempCat !== -1)) {
        headerRowIdx = r;
        colDate = tempDate;
        colDesc = tempDesc;
        colAmount = tempAmount;
        colCategory = tempCat;
        colPayment = tempPay;
        break;
      }
    }

    // If no header found, search first row with date
    if (headerRowIdx === -1) {
      for (let r = 0; r < Math.min(15, data.length); r++) {
        const row = data[r];
        if (!Array.isArray(row) || row.length < 2) continue;
        if (isDateLike(row[0])) {
          headerRowIdx = r - 1;
          colDate = 0;
          colDesc = 1;
          colAmount = row.length > 2 ? 2 : 1;
          break;
        }
      }
    }

    if (headerRowIdx !== -1 && colDate !== -1) {
      // Disambiguate: colDesc must never equal colDate
      if (colDesc === colDate) {
        colDesc = -1;
      }

      // If colDesc is -1, pick the first non-date, non-amount column
      if (colDesc === -1 && headerRowIdx < data.length) {
        const headerRow = data[headerRowIdx];
        for (let c = 0; c < headerRow.length; c++) {
          if (c !== colDate && c !== colAmount && c !== colCategory && c !== colPayment) {
            colDesc = c;
            break;
          }
        }
      }

      let count = 0;
      for (let r = headerRowIdx + 1; r < data.length; r++) {
        const row = data[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        const rawDate = row[colDate];
        if (!rawDate) continue;

        const dateStr = parseExcelDate(rawDate);

        const excludedCols = [colAmount, colCategory, colPayment].filter((c) => c !== -1);
        const { description: rawDesc, resolvedColDesc } = extractRowDescription(
          row,
          colDesc,
          colDate,
          dateStr,
          excludedCols
        );

        if (colDesc === -1 && resolvedColDesc !== -1) {
          colDesc = resolvedColDesc;
        }

        const rawAmount = colAmount !== -1 ? parseBrazilianAmount(row[colAmount]) : 0;
        const category = colCategory !== -1 ? String(row[colCategory] || '').trim() : 'Outros';
        const payment =
          colPayment !== -1
            ? (String(row[colPayment] || '').trim() as any)
            : inferPaymentMethod(rawDesc);

        if (!rawDesc && rawAmount === 0) continue;

        const cleanedDesc = cleanTransactionDescription(rawDesc);
        const finalDesc = cleanedDesc || rawDesc;
        const txId = generateTransactionId(dateStr, finalDesc, rawAmount, count++);

        transactions.push({
          id: txId,
          date: dateStr,
          description: finalDesc,
          originalDescription: rawDesc,
          amount: rawAmount,
          category: category || 'Outros',
          paymentMethod: payment || inferPaymentMethod(rawDesc),
          sourceFile: fileName,
          sourceSheet: name,
          isAutoCategorized: Boolean(category && category !== 'Outros'),
        });
      }

      if (transactions.length > 0) {
        break;
      }
    }
  }

  return {
    transactions,
    sheetNames,
    totalRowsFound: transactions.length,
    warnings,
    isMainControlSheet: true,
  };
}
