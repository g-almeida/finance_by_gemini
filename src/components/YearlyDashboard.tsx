import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  AlertCircle,
  Receipt,
  Calendar,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import { YearlyStats } from '../types';
import { formatBRL, formatCompactBRL, MONTH_NAMES_SHORT } from '../lib/financeStats';

interface YearlyDashboardProps {
  stats: YearlyStats;
  selectedYear: number;
  onSelectMonth: (monthIndex: number) => void;
  onGoToCategorization: () => void;
}

export const YearlyDashboard: React.FC<YearlyDashboardProps> = ({
  stats,
  selectedYear,
  onSelectMonth,
  onGoToCategorization,
}) => {
  const [chartMode, setChartMode] = useState<'monthly' | 'accumulated'>('monthly');
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  // Maximum value for chart scaling
  const maxMonthValue = Math.max(
    ...stats.months.map((m) => Math.max(m.income, m.expenses)),
    1000
  );

  const maxAccumulated = Math.max(
    ...stats.months.map((m) => Math.abs(m.accumulatedBalance)),
    1000
  );

  return (
    <div className="space-y-6">
      {/* Notice for uncategorized transactions */}
      {stats.uncategorizedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                {stats.uncategorizedCount} transação(ões) pendente(s) de categorização em {selectedYear}
              </h4>
              <p className="text-xs text-amber-700">
                Categorizar suas transações garante que os gráficos e totais por categoria fiquem 100% precisos.
              </p>
            </div>
          </div>
          <button
            id="btn-categorize-pending"
            onClick={onGoToCategorization}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors whitespace-nowrap cursor-pointer"
          >
            Categorizar Agora
          </button>
        </div>
      )}

      {/* Primary KPI Hero Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas Totais */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Receitas do Ano
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-stone-900 tracking-tight">
              {formatBRL(stats.totalIncome)}
            </span>
          </div>
          <div className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
            <span className="font-semibold">Entradas confirmadas</span>
            <span className="text-stone-400">•</span>
            <span>Ano {selectedYear}</span>
          </div>
        </div>

        {/* Despesas Totais */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Despesas do Ano
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-stone-900 tracking-tight">
              {formatBRL(stats.totalExpenses)}
            </span>
          </div>
          <div className="mt-2 text-xs text-stone-500 flex items-center gap-1">
            <span>Média de</span>
            <span className="font-semibold text-stone-700">
              {formatBRL(stats.avgMonthlyExpense)}/mês
            </span>
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Saldo Líquido Anual
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                stats.netBalance >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {stats.netBalance >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`text-2xl font-bold tracking-tight ${
                stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatBRL(stats.netBalance)}
            </span>
          </div>
          <div className="mt-2 text-xs text-stone-500 flex items-center gap-1">
            <span>Taxa de Poupança:</span>
            <span
              className={`font-bold ${
                stats.savingsRate >= 20 ? 'text-emerald-700' : 'text-stone-700'
              }`}
            >
              {stats.savingsRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Taxa de Poupança / Investimento */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
              Economia & Poupança
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-stone-900 tracking-tight">
              {stats.savingsRate.toFixed(1)}%
            </span>
          </div>
          <div className="mt-2 text-xs text-stone-500">
            {stats.savingsRate > 20 ? (
              <span className="text-emerald-600 font-medium">Meta saudável (&gt;20% de sobra)</span>
            ) : stats.savingsRate > 0 ? (
              <span className="text-amber-600 font-medium">Saldo positivo moderado</span>
            ) : (
              <span className="text-rose-600 font-medium">Despesas superaram receitas</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Chart: Monthly Status Along the Year */}
      <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Status Mensal ao Longo de {selectedYear}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Evolução das receitas, despesas e saldo mês a mês
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-stone-100 p-1 rounded-lg text-xs font-semibold">
              <button
                id="btn-chart-monthly"
                onClick={() => setChartMode('monthly')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  chartMode === 'monthly'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Receitas x Despesas
              </button>
              <button
                id="btn-chart-accumulated"
                onClick={() => setChartMode('accumulated')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  chartMode === 'accumulated'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Saldo Acumulado
              </button>
            </div>
          </div>
        </div>

        {/* Chart Legend */}
        <div className="flex items-center gap-5 my-4 text-xs text-stone-600 font-medium">
          {chartMode === 'monthly' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                <span>Receitas (Entradas)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" />
                <span>Despesas (Saídas)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                <span>Saldo Líquido</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
              <span>Patrimônio / Saldo Acumulado no Ano</span>
            </div>
          )}
        </div>

        {/* Visual Bar Chart (Responsive Canvas/SVG container) */}
        <div className="relative pt-4 pb-2">
          {/* Chart Bars */}
          <div className="grid grid-cols-12 gap-1.5 sm:gap-3 items-end h-64 border-b border-stone-200">
            {stats.months.map((m, idx) => {
              const incomeHeight = maxMonthValue > 0 ? (m.income / maxMonthValue) * 100 : 0;
              const expenseHeight = maxMonthValue > 0 ? (m.expenses / maxMonthValue) * 100 : 0;
              const accumulatedRatio = maxAccumulated > 0 ? (m.accumulatedBalance / maxAccumulated) * 100 : 0;

              const isHovered = hoveredMonth === idx;
              const hasData = m.transactionCount > 0 || m.income > 0 || m.expenses > 0;

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center h-full justify-end group relative cursor-pointer"
                  onMouseEnter={() => setHoveredMonth(idx)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  onClick={() => onSelectMonth(idx)}
                  title={`Clique para ver transações de ${m.monthName}`}
                >
                  {/* Tooltip on hover */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-2 z-20 w-44 bg-stone-900 text-white rounded-lg p-2.5 text-xs shadow-lg pointer-events-none transform -translate-x-1/2 left-1/2">
                      <div className="font-bold border-b border-stone-700 pb-1 mb-1">
                        {m.monthName} / {selectedYear}
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>Receitas:</span>
                        <span className="font-semibold">{formatBRL(m.income)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400 mt-0.5">
                        <span>Despesas:</span>
                        <span className="font-semibold">{formatBRL(m.expenses)}</span>
                      </div>
                      <div className="flex justify-between text-stone-200 mt-1 pt-1 border-t border-stone-700">
                        <span>Saldo:</span>
                        <span className={`font-bold ${m.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatBRL(m.balance)}
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-400 mt-1 text-center">
                        {m.transactionCount} transações • Clique para ver
                      </div>
                    </div>
                  )}

                  {/* Bars */}
                  {chartMode === 'monthly' ? (
                    <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1.5 h-full pb-1">
                      {/* Income Bar */}
                      <div
                        style={{ height: `${Math.max(incomeHeight, hasData ? 3 : 0)}%` }}
                        className={`w-1/2 rounded-t-sm transition-all duration-300 ${
                          isHovered ? 'bg-emerald-600' : 'bg-emerald-500'
                        } ${!hasData ? 'opacity-20' : ''}`}
                      />
                      {/* Expense Bar */}
                      <div
                        style={{ height: `${Math.max(expenseHeight, hasData ? 3 : 0)}%` }}
                        className={`w-1/2 rounded-t-sm transition-all duration-300 ${
                          isHovered ? 'bg-rose-600' : 'bg-rose-500'
                        } ${!hasData ? 'opacity-20' : ''}`}
                      />
                    </div>
                  ) : (
                    /* Accumulated line/bar */
                    <div className="w-full flex items-end justify-center h-full pb-1">
                      <div
                        style={{
                          height: `${Math.max(Math.abs(accumulatedRatio), hasData ? 3 : 0)}%`,
                        }}
                        className={`w-3/4 rounded-t-sm transition-all duration-300 ${
                          m.accumulatedBalance >= 0 ? 'bg-blue-600' : 'bg-rose-500'
                        } ${isHovered ? 'opacity-90' : 'opacity-75'}`}
                      />
                    </div>
                  )}

                  {/* Month Label */}
                  <span
                    className={`mt-2 text-[11px] font-semibold transition-colors ${
                      isHovered ? 'text-emerald-700 font-bold' : 'text-stone-500'
                    }`}
                  >
                    {MONTH_NAMES_SHORT[idx]}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center text-[10px] text-stone-400 mt-2 px-1">
            <span>Valores em Reais (R$)</span>
            <span>Dica: passe o mouse ou clique em um mês para inspecionar</span>
          </div>
        </div>
      </div>

      {/* Two-Column Detail: Top Expense Categories & Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Expense Categories (Corresponds to 1st tab category tracking) */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-stone-900 tracking-tight">
                Despesas por Categoria ({selectedYear})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Distribuição e percentual dos seus maiores gastos
              </p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-stone-100 text-stone-700">
              {stats.topExpenseCategories.length} categorias
            </span>
          </div>

          {stats.topExpenseCategories.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs">
              Nenhuma despesa registrada para o ano {selectedYear}.
            </div>
          ) : (
            <div className="space-y-3.5">
              {stats.topExpenseCategories.slice(0, 7).map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-semibold text-stone-800">{cat.category}</span>
                      <span className="text-stone-400 text-[11px]">
                        ({cat.count} tx)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-stone-500 text-[11px]">
                        {cat.percentage.toFixed(1)}%
                      </span>
                      <span className="font-bold text-stone-900">
                        {formatBRL(cat.amount)}
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(cat.percentage, 100)}%`,
                        backgroundColor: cat.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods Breakdown (PIX, Cartão, etc.) */}
        <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 tracking-tight">
                  Formas de Pagamento
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Organização por meio de liquidação
                </p>
              </div>
              <CreditCard className="w-4 h-4 text-stone-400" />
            </div>

            <div className="space-y-3 mt-2">
              {stats.paymentMethods.map((pm, idx) => {
                const totalPmAmount = stats.paymentMethods.reduce((acc, curr) => acc + curr.amount, 0);
                const pct = totalPmAmount > 0 ? (pm.amount / totalPmAmount) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg border border-stone-100 bg-stone-50/60 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-stone-800">
                        {pm.method}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {pm.count} transação(ões) • {pct.toFixed(0)}%
                      </div>
                    </div>
                    <div className="text-xs font-bold text-stone-900">
                      {formatBRL(pm.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Extraído dos extratos Itaú</span>
            <span className="font-semibold text-emerald-700">100% Sincronizado</span>
          </div>
        </div>
      </div>

      {/* Complete Month-by-Month Table (Direct 1st Tab equivalent from 'Controle Financeiro lindo2.xlsx') */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900 tracking-tight">
              Tabela de Desempenho Anual (Mês a Mês)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Consolidado idêntico à 1ª aba da sua planilha
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Mês</th>
                <th className="py-3 px-4 font-semibold text-right">Receitas</th>
                <th className="py-3 px-4 font-semibold text-right">Despesas</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo do Mês</th>
                <th className="py-3 px-4 font-semibold text-right">Saldo Acumulado</th>
                <th className="py-3 px-4 font-semibold text-center">Tx. Poupança</th>
                <th className="py-3 px-4 font-semibold text-center">Transações</th>
                <th className="py-3 px-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {stats.months.map((m) => {
                const monthSavingsRate = m.income > 0 ? (m.balance / m.income) * 100 : 0;
                return (
                  <tr key={m.month} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-stone-800">
                      {m.monthName}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-700">
                      {m.income > 0 ? formatBRL(m.income) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-rose-700">
                      {m.expenses > 0 ? formatBRL(m.expenses) : '-'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold ${
                        m.balance > 0
                          ? 'text-emerald-700'
                          : m.balance < 0
                          ? 'text-rose-700'
                          : 'text-stone-500'
                      }`}
                    >
                      {m.income > 0 || m.expenses > 0 ? formatBRL(m.balance) : '-'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-semibold ${
                        m.accumulatedBalance >= 0 ? 'text-blue-700' : 'text-rose-700'
                      }`}
                    >
                      {m.income > 0 || m.expenses > 0 ? formatBRL(m.accumulatedBalance) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {m.income > 0 ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            monthSavingsRate >= 20
                              ? 'bg-emerald-50 text-emerald-700'
                              : monthSavingsRate > 0
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {monthSavingsRate.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-stone-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-stone-600 font-medium">
                      {m.transactionCount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectMonth(m.month)}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-semibold hover:underline cursor-pointer"
                      >
                        Filtrar Mês
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-stone-100/70 border-t border-stone-200 font-bold text-stone-900">
              <tr>
                <td className="py-3 px-4">Total Geral ({selectedYear})</td>
                <td className="py-3 px-4 text-right text-emerald-700">
                  {formatBRL(stats.totalIncome)}
                </td>
                <td className="py-3 px-4 text-right text-rose-700">
                  {formatBRL(stats.totalExpenses)}
                </td>
                <td
                  className={`py-3 px-4 text-right ${
                    stats.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatBRL(stats.netBalance)}
                </td>
                <td className="py-3 px-4 text-right text-blue-700">
                  {formatBRL(stats.netBalance)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-stone-200 text-stone-800">
                    {stats.savingsRate.toFixed(1)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  {stats.months.reduce((acc, m) => acc + m.transactionCount, 0)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="text-stone-400">-</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
