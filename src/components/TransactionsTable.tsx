import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Sparkles,
  Download,
  Plus,
  Trash2,
  Tag,
  CheckCircle2,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  Zap,
  Pencil,
  Check,
  X,
  BookmarkCheck,
  Landmark,
  TrendingUp,
  TrendingDown,
  Coins,
} from 'lucide-react';
import { Transaction, Category, PaymentMethod, MemorizedEstablishment } from '../types';
import { DEFAULT_CATEGORIES, PAYMENT_METHODS } from '../lib/constants';
import { formatBRL, MONTH_NAMES_PT } from '../lib/financeStats';
import { findCategoryFromMemory } from '../lib/memoryService';
import { isDateLike } from '../lib/parserService';
import * as XLSX from 'xlsx';

interface TransactionsTableProps {
  transactions: Transaction[];
  onUpdateTransaction: (updated: Transaction) => void;
  onBulkUpdateCategory: (ids: string[], newCategory: string) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: (newTx: Omit<Transaction, 'id'>) => void;
  onCreateRuleFromTx: (tx: Transaction, targetCategory: string) => void;
  onAutoCategorizeAll: () => void;
  onAICategorize: () => Promise<void>;
  isCategorizingAI: boolean;
  selectedYear: number;
  initialMonthFilter?: number | null;
  establishmentMemory?: Record<string, MemorizedEstablishment>;
}

export const TransactionsTable: React.FC<TransactionsTableProps> = ({
  transactions,
  onUpdateTransaction,
  onBulkUpdateCategory,
  onDeleteTransaction,
  onAddTransaction,
  onCreateRuleFromTx,
  onAutoCategorizeAll,
  onAICategorize,
  isCategorizingAI,
  selectedYear,
  initialMonthFilter = null,
  establishmentMemory,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(
    initialMonthFilter !== null ? initialMonthFilter : 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'income' | 'expense'>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'bank_account' | 'credit_card'>('all');

  // Inline edit description state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editingDescValue, setEditingDescValue] = useState('');

  // Multi-row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryChoice, setBulkCategoryChoice] = useState<string>('Alimentação');

  // Manual Add Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<'expense' | 'income'>('expense');
  const [newCategory, setNewCategory] = useState('Alimentação');
  const [newPayment, setNewPayment] = useState<PaymentMethod>('PIX');
  const [memorizedSuggestion, setMemorizedSuggestion] = useState<MemorizedEstablishment | null>(null);

  // Auto-detect category from memory as the user types in Add Transaction modal
  useEffect(() => {
    if (!newDesc.trim() || !establishmentMemory) {
      setMemorizedSuggestion(null);
      return;
    }
    const match = findCategoryFromMemory(newDesc, establishmentMemory);
    if (match) {
      setNewCategory(match.category);
      if (match.paymentMethod) setNewPayment(match.paymentMethod);
      setMemorizedSuggestion(match);
    } else {
      setMemorizedSuggestion(null);
    }
  }, [newDesc, establishmentMemory]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Year filter
      if (t.date && !t.date.startsWith(String(selectedYear))) {
        return false;
      }

      // Month filter
      if (selectedMonth !== 'all' && t.date) {
        const m = parseInt(t.date.slice(5, 7), 10) - 1;
        if (m !== selectedMonth) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && t.category !== selectedCategory) {
        return false;
      }

      // Only uncategorized filter
      if (
        onlyUncategorized &&
        t.category &&
        t.category !== 'Outros' &&
        t.category !== 'Não categorizado'
      ) {
        return false;
      }

      // Payment filter
      if (selectedPayment !== 'all' && t.paymentMethod !== selectedPayment) {
        return false;
      }

      // Type filter (income/earnings vs expenses)
      if (selectedType === 'income' && t.amount <= 0) {
        return false;
      }
      if (selectedType === 'expense' && t.amount >= 0) {
        return false;
      }

      // Source filter (bank account / extract vs credit card)
      const isBank = t.sourceType === 'bank_account' || t.fileType === 'pdf';
      if (selectedSource === 'bank_account' && !isBank) {
        return false;
      }
      if (selectedSource === 'credit_card' && isBank) {
        return false;
      }

      // Search text
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const inDesc = t.description?.toLowerCase().includes(query);
        const inOrig = t.originalDescription?.toLowerCase().includes(query);
        const inCat = t.category?.toLowerCase().includes(query);
        if (!inDesc && !inOrig && !inCat) return false;
      }

      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [
    transactions,
    selectedYear,
    selectedMonth,
    selectedCategory,
    onlyUncategorized,
    selectedPayment,
    selectedType,
    selectedSource,
    searchTerm,
  ]);

  // Compute filtered summary statistics (earnings vs expenses)
  const periodTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let bankCount = 0;
    let cardCount = 0;
    for (const t of filteredTransactions) {
      if (t.amount > 0) {
        income += t.amount;
      } else {
        expense += Math.abs(t.amount);
      }
      if (t.sourceType === 'bank_account' || t.fileType === 'pdf') {
        bankCount++;
      } else {
        cardCount++;
      }
    }
    return {
      income,
      expense,
      net: income - expense,
      bankCount,
      cardCount,
    };
  }, [filteredTransactions]);

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredTransactions.map((t) => t.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleApplyBulkCategory = () => {
    if (selectedIds.size === 0) return;
    onBulkUpdateCategory(Array.from(selectedIds), bulkCategoryChoice);
    setSelectedIds(new Set());
  };

  const handleExportToExcel = () => {
    const exportData = filteredTransactions.map((t) => ({
      Data: t.date,
      Descrição: t.description,
      'Descrição Original (Extrato Itaú)': t.originalDescription,
      Categoria: t.category,
      'Forma de Pagamento': t.paymentMethod,
      'Valor (R$)': t.amount,
      'Arquivo de Origem': t.sourceFile || '',
      'Auto-Categorizado': t.isAutoCategorized ? 'Sim' : 'Não',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico de Transações');
    XLSX.writeFile(wb, `Transacoes_Financeiro_${selectedYear}.xlsx`);
  };

  const handleSaveNewTx = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount === 0) return;

    const finalAmount = newType === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);

    onAddTransaction({
      date: newDate,
      description: newDesc || 'Transação Manual',
      originalDescription: newDesc || 'Transação Manual',
      amount: finalAmount,
      category: newCategory,
      paymentMethod: newPayment,
      sourceFile: 'Manual',
      isAutoCategorized: false,
    });

    setNewDesc('');
    setNewAmount('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Toolbar */}
      <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-transactions-input"
              type="text"
              placeholder="Buscar por descrição, comércio ou termo no extrato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
            />
          </div>

          {/* Quick Automation Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-auto-categorize-rules"
              onClick={onAutoCategorizeAll}
              title="Executa as regras de auto-tagging em todas as transações não categorizadas"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>Aplicar Regras de Tagging</span>
            </button>

            <button
              id="btn-ai-categorize"
              onClick={onAICategorize}
              disabled={isCategorizingAI}
              title="Usa inteligência artificial para sugerir categorias para itens desconhecidos"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isCategorizingAI ? 'animate-spin' : ''}`} />
              <span>{isCategorizingAI ? 'Classificando...' : 'Tagging com IA'}</span>
            </button>

            <button
              id="btn-export-excel"
              onClick={handleExportToExcel}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-700 border border-stone-200 transition-colors cursor-pointer"
              title="Exportar dados filtrados para arquivo Excel (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-stone-500" />
              <span>Exportar</span>
            </button>

            <button
              id="btn-add-transaction"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>

        {/* Filter Badges Row */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
          {/* Month selector */}
          <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-md">
            <Calendar className="w-3 h-3 text-stone-500" />
            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
              }
              className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Ano Inteiro ({selectedYear})</option>
              {MONTH_NAMES_PT.map((m, idx) => (
                <option key={idx} value={idx}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-md">
            <Tag className="w-3 h-3 text-stone-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method filter */}
          <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-md">
            <CreditCard className="w-3 h-3 text-stone-500" />
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Todas Formas Pagamento</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>

          {/* Type filter (Ganhos vs Despesas) */}
          <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-md">
            <TrendingUp className="w-3 h-3 text-emerald-600" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Todos os Lançamentos (+/-)</option>
              <option value="income">Apenas Ganhos / Receitas (+)</option>
              <option value="expense">Apenas Despesas (-)</option>
            </select>
          </div>

          {/* Source filter (Conta Corrente / PDF vs Cartão) */}
          <div className="flex items-center gap-1.5 bg-stone-100 px-2.5 py-1 rounded-md">
            <Landmark className="w-3 h-3 text-emerald-700" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value as any)}
              className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">Todas Origens</option>
              <option value="bank_account">Extratos Conta Corrente (PDF / Ganhos)</option>
              <option value="credit_card">Faturas Cartão de Crédito</option>
            </select>
          </div>

          {/* Only Uncategorized toggle */}
          <button
            onClick={() => setOnlyUncategorized(!onlyUncategorized)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
              onlyUncategorized
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                onlyUncategorized ? 'bg-amber-600' : 'bg-stone-400'
              }`}
            />
            <span>Apenas Não Categorizadas</span>
          </button>

          {/* Result counter */}
          <div className="ml-auto text-stone-400 text-[11px] font-medium">
            Exibindo <span className="text-stone-700 font-semibold">{filteredTransactions.length}</span> de{' '}
            {transactions.length} transações
          </div>
        </div>

        {/* Quick Period Summary Ribbon (Ganhos vs Despesas) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 mt-1 border-t border-stone-100 text-xs bg-stone-50/50 -mx-5 -mb-5 px-5 py-2.5 rounded-b-xl">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Ganhos / Receitas:</span>
              <span className="font-bold text-emerald-700">+{formatBRL(periodTotals.income)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Despesas:</span>
              <span className="font-bold text-rose-700">-{formatBRL(periodTotals.expense)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-stone-500 font-medium">Saldo Líquido:</span>
              <span
                className={`font-bold ${
                  periodTotals.net >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatBRL(periodTotals.net)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-stone-500">
            <span className="flex items-center gap-1">
              <Landmark className="w-3 h-3 text-emerald-600" />
              <span>{periodTotals.bankCount} lançamentos em conta</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-stone-500" />
              <span>{periodTotals.cardCount} no cartão</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{selectedIds.size} transação(ões) selecionada(s)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-emerald-800">Definir categoria:</span>
            <select
              value={bulkCategoryChoice}
              onChange={(e) => setBulkCategoryChoice(e.target.value)}
              className="bg-white border border-emerald-300 text-stone-800 py-1 px-2 rounded-md font-medium text-xs focus:outline-none"
            >
              {DEFAULT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleApplyBulkCategory}
              className="px-3 py-1 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 cursor-pointer shadow-2xs"
            >
              Aplicar em Massa
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-stone-500 hover:text-stone-800 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Main Transactions Table (Tab 2 Equivalent) */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
              <tr>
                <th className="py-3 px-4 w-8 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredTransactions.length > 0 &&
                      selectedIds.size === filteredTransactions.length
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3 font-semibold">Data</th>
                <th className="py-3 px-4 font-semibold">Descrição (Comércio / Item)</th>
                <th className="py-3 px-4 font-semibold">Categoria (Manual / Auto)</th>
                <th className="py-3 px-3 font-semibold">Forma de Pagto</th>
                <th className="py-3 px-4 font-semibold text-right">Valor (R$)</th>
                <th className="py-3 px-3 font-semibold text-center">Origem</th>
                <th className="py-3 px-3 font-semibold text-center w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-400">
                    Nenhuma transação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const isExpense = tx.amount < 0;
                  const isUncat =
                    !tx.category ||
                    tx.category === 'Outros' ||
                    tx.category === 'Não categorizado';
                  const matchedCat = DEFAULT_CATEGORIES.find(
                    (c) => c.name.toLowerCase() === (tx.category || '').toLowerCase()
                  );

                  return (
                    <tr
                      key={tx.id}
                      className={`hover:bg-stone-50/70 transition-colors ${
                        selectedIds.has(tx.id) ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(tx.id)}
                          onChange={() => toggleSelectOne(tx.id)}
                          className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 font-medium text-stone-600 whitespace-nowrap">
                        {tx.date
                          ? tx.date.split('-').reverse().join('/')
                          : '-'}
                      </td>

                      {/* Description & Original statement text with inline edit */}
                      <td className="py-3 px-4 max-w-xs">
                        {(() => {
                          const descIsDate = isDateLike(tx.description) || tx.description === tx.date;
                          const origIsDate = isDateLike(tx.originalDescription) || tx.originalDescription === tx.date;
                          const displayDesc =
                            descIsDate && !origIsDate && tx.originalDescription
                              ? tx.originalDescription
                              : tx.description || 'Transação';
                          const displayOrig =
                            tx.originalDescription && !origIsDate && tx.originalDescription !== displayDesc
                              ? tx.originalDescription
                              : '';

                          if (editingTxId === tx.id) {
                            return (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingDescValue}
                                  onChange={(e) => setEditingDescValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const nextDesc = editingDescValue.trim() || displayDesc;
                                      onUpdateTransaction({ ...tx, description: nextDesc });
                                      setEditingTxId(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingTxId(null);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full text-xs font-semibold px-2 py-1 border border-emerald-500 rounded bg-white focus:outline-none ring-1 ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextDesc = editingDescValue.trim() || displayDesc;
                                    onUpdateTransaction({ ...tx, description: nextDesc });
                                    setEditingTxId(null);
                                  }}
                                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                  title="Salvar descrição"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTxId(null)}
                                  className="p-1 text-stone-400 hover:bg-stone-100 rounded cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          }

                          return (
                            <div className="group relative flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <div
                                  className="font-semibold text-stone-900 truncate"
                                  title={displayDesc}
                                >
                                  {displayDesc}
                                </div>
                                {displayOrig && (
                                  <div
                                    className="text-[10px] text-stone-400 truncate mt-0.5"
                                    title={`Extrato Itaú: ${displayOrig}`}
                                  >
                                    {displayOrig}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTxId(tx.id);
                                  setEditingDescValue(displayDesc);
                                }}
                                title="Editar nome/estabelecimento da transação"
                                className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-opacity cursor-pointer shrink-0"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Category Selection Dropdown (Crucial 2nd Tab Functionality) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: matchedCat?.color || (isUncat ? '#f59e0b' : '#94a3b8'),
                            }}
                          />
                          <select
                            value={tx.category || 'Outros'}
                            onChange={(e) => {
                              onUpdateTransaction({
                                ...tx,
                                category: e.target.value,
                                isAutoCategorized: false,
                              });
                            }}
                            className={`py-1 px-2 text-xs font-semibold rounded-md border focus:outline-none cursor-pointer ${
                              isUncat
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-white text-stone-800 border-stone-200'
                            }`}
                          >
                            {DEFAULT_CATEGORIES.map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>

                          {/* Memorized Indicator Badge */}
                          {(tx.isMemorized || tx.ruleApplied?.includes('Memória')) && (
                            <span
                              title={`Preenchido automaticamente pela sua memória de seleções prévias: ${tx.ruleApplied || 'Memória'}`}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                            >
                              <BookmarkCheck className="w-2.5 h-2.5 text-indigo-600" />
                              Memória
                            </span>
                          )}

                          {/* Quick 'Create Rule' button */}
                          <button
                            onClick={() => onCreateRuleFromTx(tx, tx.category)}
                            title={`Criar regra para sempre categorizar itens parecidos como "${tx.category}"`}
                            className="p-1 rounded text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select
                          value={tx.paymentMethod || 'Outro'}
                          onChange={(e) => {
                            onUpdateTransaction({
                              ...tx,
                              paymentMethod: e.target.value as PaymentMethod,
                            });
                          }}
                          className="py-1 px-2 text-[11px] font-medium rounded-md bg-stone-50 border border-stone-200 text-stone-700 focus:outline-none cursor-pointer"
                        >
                          {PAYMENT_METHODS.map((pm) => (
                            <option key={pm} value={pm}>
                              {pm}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {!isExpense ? (
                          <div className="flex items-center justify-end gap-1.5 font-bold text-emerald-700">
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                              Ganho
                            </span>
                            <span>+{formatBRL(tx.amount)}</span>
                          </div>
                        ) : (
                          <span className="font-bold text-rose-700">
                            {formatBRL(tx.amount)}
                          </span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {tx.sourceType === 'bank_account' || tx.fileType === 'pdf' ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold max-w-[140px] truncate"
                            title={`Extrato Conta Corrente (PDF): ${tx.sourceFile || 'Itaú'}`}
                          >
                            <Landmark className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{tx.sourceFile ? tx.sourceFile.replace(/\.pdf$/i, '') : 'Conta Corrente'}</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 max-w-[140px] truncate"
                            title={`Fatura Cartão: ${tx.sourceFile || 'Itaú'}`}
                          >
                            <CreditCard className="w-3 h-3 text-stone-400 shrink-0" />
                            <span className="truncate">{tx.sourceFile || 'Cartão'}</span>
                          </span>
                        )}
                      </td>

                      {/* Delete action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          title="Remover transação"
                          className="p-1 text-stone-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Manual Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-stone-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-base font-bold text-stone-900">
                Nova Transação Manual
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-700 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveNewTx} className="space-y-3 text-xs">
              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setNewType('expense')}
                  className={`py-1.5 rounded-md font-bold transition-colors ${
                    newType === 'expense'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Despesa (Saída)
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('income')}
                  className={`py-1.5 rounded-md font-bold transition-colors ${
                    newType === 'income'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Receita (Entrada)
                </button>
              </div>

              {/* Date */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                  className="w-full p-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Descrição / Estabelecimento
                </label>
                <input
                  type="text"
                  placeholder="Ex: Almoço Restaurante, Supermercado..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  required
                  className="w-full p-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {memorizedSuggestion && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-indigo-800 bg-indigo-50/80 border border-indigo-200 px-3 py-2 rounded-lg">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>
                      Estabelecimento reconhecido na memória: categoria <strong>{memorizedSuggestion.category}</strong> pré-selecionada automaticamente!
                    </span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 85,50"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  required
                  className="w-full p-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Categoria
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={newPayment}
                  onChange={(e) => setNewPayment(e.target.value as PaymentMethod)}
                  className="w-full p-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-lg font-semibold text-stone-600 hover:bg-stone-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-xs"
                >
                  Salvar Transação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
