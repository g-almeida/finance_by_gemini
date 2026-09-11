import { Transaction, YearlyStats, MonthSummary, CategorySummary, PaymentMethod } from '../types';
import { DEFAULT_CATEGORIES } from './constants';

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const MONTH_NAMES_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatCompactBRL(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}R$ ${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}R$ ${(abs / 1_000).toFixed(1)}k`;
  }
  return formatBRL(value);
}

export function getAvailableYears(transactions: Transaction[]): number[] {
  const yearsSet = new Set<number>();
  for (const t of transactions) {
    if (t.date) {
      const year = parseInt(t.date.slice(0, 4), 10);
      if (!isNaN(year) && year > 2000 && year < 2100) {
        yearsSet.add(year);
      }
    }
  }

  const currentYear = new Date().getFullYear();
  yearsSet.add(currentYear);

  return Array.from(yearsSet).sort((a, b) => b - a);
}

export function computeYearlyStats(
  transactions: Transaction[],
  year: number
): YearlyStats {
  const yearTxs = transactions.filter((t) => {
    if (!t.date) return false;
    return parseInt(t.date.slice(0, 4), 10) === year;
  });

  const monthBuckets: { income: number; expenses: number; count: number }[] = Array.from(
    { length: 12 },
    () => ({ income: 0, expenses: 0, count: 0 })
  );

  let totalIncome = 0;
  let totalExpenses = 0;
  let uncategorizedCount = 0;

  const categoryExpensesMap = new Map<string, { amount: number; count: number }>();
  const categoryIncomeMap = new Map<string, { amount: number; count: number }>();
  const paymentMethodMap = new Map<PaymentMethod, { amount: number; count: number }>();

  for (const tx of yearTxs) {
    const month = parseInt(tx.date.slice(5, 7), 10) - 1; // 0-11
    const amount = tx.amount;

    if (!tx.category || tx.category === 'Outros' || tx.category === 'Não categorizado') {
      uncategorizedCount++;
    }

    // Payment method
    const pm = tx.paymentMethod || 'Outro';
    const pmStat = paymentMethodMap.get(pm) || { amount: 0, count: 0 };
    pmStat.amount += Math.abs(amount);
    pmStat.count += 1;
    paymentMethodMap.set(pm, pmStat);

    if (amount > 0) {
      // Income
      totalIncome += amount;
      if (month >= 0 && month < 12) {
        monthBuckets[month].income += amount;
        monthBuckets[month].count += 1;
      }
      const cat = tx.category || 'Salário & Receitas';
      const catStat = categoryIncomeMap.get(cat) || { amount: 0, count: 0 };
      catStat.amount += amount;
      catStat.count += 1;
      categoryIncomeMap.set(cat, catStat);
    } else if (amount < 0) {
      // Expense
      const exp = Math.abs(amount);
      totalExpenses += exp;
      if (month >= 0 && month < 12) {
        monthBuckets[month].expenses += exp;
        monthBuckets[month].count += 1;
      }
      const cat = tx.category || 'Outros';
      const catStat = categoryExpensesMap.get(cat) || { amount: 0, count: 0 };
      catStat.amount += exp;
      catStat.count += 1;
      categoryExpensesMap.set(cat, catStat);
    }
  }

  // Monthly summary
  let runningBalance = 0;
  const months: MonthSummary[] = monthBuckets.map((b, idx) => {
    const balance = b.income - b.expenses;
    runningBalance += balance;
    return {
      month: idx,
      monthName: MONTH_NAMES_PT[idx],
      income: b.income,
      expenses: b.expenses,
      balance,
      accumulatedBalance: runningBalance,
      transactionCount: b.count,
    };
  });

  // Category summaries
  const topExpenseCategories: CategorySummary[] = Array.from(categoryExpensesMap.entries())
    .map(([catName, data]) => {
      const match = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      return {
        category: catName,
        amount: data.amount,
        percentage: totalExpenses > 0 ? (data.amount / totalExpenses) * 100 : 0,
        count: data.count,
        color: match?.color || '#64748b',
        type: 'expense' as const,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeCategories: CategorySummary[] = Array.from(categoryIncomeMap.entries())
    .map(([catName, data]) => {
      const match = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === catName.toLowerCase());
      return {
        category: catName,
        amount: data.amount,
        percentage: totalIncome > 0 ? (data.amount / totalIncome) * 100 : 0,
        count: data.count,
        color: match?.color || '#10b981',
        type: 'income' as const,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const paymentMethods = Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
  }));

  const netBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netBalance / totalIncome) * 100) : 0;
  const activeMonths = months.filter((m) => m.transactionCount > 0).length || 1;
  const avgMonthlyExpense = totalExpenses / activeMonths;

  return {
    year,
    totalIncome,
    totalExpenses,
    netBalance,
    savingsRate,
    avgMonthlyExpense,
    uncategorizedCount,
    months,
    topExpenseCategories,
    incomeCategories,
    paymentMethods,
  };
}
