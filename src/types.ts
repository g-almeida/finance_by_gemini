export type PaymentMethod =
  | 'PIX'
  | 'Cartão de Crédito'
  | 'Cartão de Débito'
  | 'Boleto'
  | 'Transferência / TED'
  | 'Dinheiro'
  | 'Outro';

export type CategoryType = 'expense' | 'income' | 'investment' | 'transfer';

export interface Category {
  id: string;
  name: string;
  color: string;
  type: CategoryType;
  icon?: string;
  monthlyBudget?: number;
}

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  originalDescription: string;
  amount: number; // positive = income/credit/earning, negative = expense/debit
  category: string; // Category name
  paymentMethod: PaymentMethod;
  sourceFile?: string;
  sourceSheet?: string;
  sourceFolder?: string;
  sourceType?: 'credit_card' | 'bank_account' | 'manual';
  fileType?: 'spreadsheet' | 'pdf';
  isEarning?: boolean;
  isAutoCategorized?: boolean;
  isMemorized?: boolean;
  ruleApplied?: string;
  notes?: string;
}

export interface MemorizedEstablishment {
  id: string;
  pattern: string;
  normalizedKey: string;
  category: string;
  paymentMethod?: PaymentMethod;
  updatedAt: string;
  useCount: number;
}

export interface CategorizationRule {
  id: string;
  keyword: string;
  matchType: 'contains' | 'starts_with' | 'exact' | 'regex';
  category: string;
  paymentMethod?: PaymentMethod;
  cleanDescription?: string;
  active: boolean;
}

export interface DriveSyncStatus {
  lastSync?: string;
  isSyncing: boolean;
  error?: string | null;
  filesProcessed: number;
  transactionsImported: number;
  newTransactionsDetected: number;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  status: 'pending' | 'processed' | 'error';
  transactionCount?: number;
  folderPath?: string;
  fileType?: 'spreadsheet' | 'pdf';
  sourceType?: 'credit_card' | 'bank_account';
  year?: number;
  isBankExtract?: boolean;
}

export interface MonthSummary {
  month: number; // 0-11
  monthName: string;
  income: number;
  expenses: number;
  balance: number;
  accumulatedBalance: number;
  transactionCount: number;
}

export interface CategorySummary {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  color: string;
  type: CategoryType;
}

export interface YearlyStats {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number; // percentage
  avgMonthlyExpense: number;
  uncategorizedCount: number;
  months: MonthSummary[];
  topExpenseCategories: CategorySummary[];
  incomeCategories: CategorySummary[];
  paymentMethods: { method: PaymentMethod; amount: number; count: number }[];
}
