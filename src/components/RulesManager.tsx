import React, { useState } from 'react';
import {
  Tags,
  Plus,
  Trash2,
  Check,
  Search,
  Zap,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { CategorizationRule, Category, Transaction, PaymentMethod } from '../types';
import { DEFAULT_CATEGORIES, PAYMENT_METHODS, INITIAL_RULES } from '../lib/constants';
import { matchRule } from '../lib/categorizer';

interface RulesManagerProps {
  rules: CategorizationRule[];
  onAddRule: (rule: Omit<CategorizationRule, 'id'>) => void;
  onToggleRule: (id: string) => void;
  onDeleteRule: (id: string) => void;
  onResetDefaultRules: () => void;
  onApplyRulesNow: () => void;
  transactions: Transaction[];
}

export const RulesManager: React.FC<RulesManagerProps> = ({
  rules,
  onAddRule,
  onToggleRule,
  onDeleteRule,
  onResetDefaultRules,
  onApplyRulesNow,
  transactions,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('Alimentação');
  const [newMatchType, setNewMatchType] = useState<'contains' | 'starts_with' | 'exact'>('contains');
  const [newPayment, setNewPayment] = useState<PaymentMethod | ''>('');
  const [newCleanDesc, setNewCleanDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Filter rules by keyword or category
  const filteredRules = rules.filter(
    (r) =>
      r.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Live tester for the rule being typed
  const testMatchCount = newKeyword.trim()
    ? transactions.filter((t) =>
        matchRule(`${t.originalDescription} ${t.description}`, {
          id: 'test',
          keyword: newKeyword.trim(),
          matchType: newMatchType,
          category: newCategory,
          active: true,
        })
      ).length
    : 0;

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    onAddRule({
      keyword: newKeyword.trim(),
      category: newCategory,
      matchType: newMatchType,
      paymentMethod: newPayment ? (newPayment as PaymentMethod) : undefined,
      cleanDescription: newCleanDesc.trim() || undefined,
      active: true,
    });

    setNewKeyword('');
    setNewCleanDesc('');
    setNewPayment('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining auto-tagging */}
      <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Tags className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <span>Regras de Auto-Tagging & Categorização</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {rules.filter((r) => r.active).length} Ativas
                </span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Substitui a necessidade de categorização manual: sempre que um termo for lido do extrato, o app aplica a categoria automaticamente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onApplyRulesNow}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Executar Regras Agora</span>
            </button>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? 'Fechar Formulário' : 'Nova Regra'}</span>
            </button>
          </div>
        </div>

        {/* Rule Creation Form */}
        {showAddForm && (
          <form onSubmit={handleCreateRule} className="mt-5 p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-4 text-xs">
            <div className="font-bold text-stone-800 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Cadastrar Nova Regra de Categorização</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Keyword */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Termo / Palavra-Chave no Extrato *
                </label>
                <input
                  type="text"
                  placeholder="Ex: uber, ifood, enel, padaria..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  required
                  className="w-full p-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Match Type */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Tipo de Correspondência
                </label>
                <select
                  value={newMatchType}
                  onChange={(e) => setNewMatchType(e.target.value as any)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="contains">Contém o texto (Recomendado)</option>
                  <option value="starts_with">Começa com o texto</option>
                  <option value="exact">Texto exatamente igual</option>
                </select>
              </div>

              {/* Target Category */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Categoria de Destino *
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-stone-800"
                >
                  {DEFAULT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Suggested Payment Method */}
              <div>
                <label className="block text-stone-600 font-semibold mb-1">
                  Forma de Pagamento (Opcional)
                </label>
                <select
                  value={newPayment}
                  onChange={(e) => setNewPayment(e.target.value as any)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Manter forma original</option>
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clean description */}
              <div className="md:col-span-2">
                <label className="block text-stone-600 font-semibold mb-1">
                  Nome Limpo Exibido (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Uber, iFood, Conta de Energia (substitui o texto poluído do extrato)"
                  value={newCleanDesc}
                  onChange={(e) => setNewCleanDesc(e.target.value)}
                  className="w-full p-2 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Live Match Preview */}
            {newKeyword.trim() && (
              <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    Esta regra corresponderá a <strong>{testMatchCount}</strong> transação(ões) no seu histórico atual.
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 border border-stone-300 rounded-lg font-semibold text-stone-600 hover:bg-stone-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-xs"
              >
                Salvar Regra
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Rules List & Filter Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar regras cadastradas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50/50"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onResetDefaultRules}
              className="flex items-center gap-1 px-3 py-1.5 text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg hover:bg-stone-50 cursor-pointer"
              title="Restaura as regras pré-configuradas para extratos Itaú"
            >
              <RotateCcw className="w-3.5 h-3.5 text-stone-400" />
              <span>Restaurar Regras Padrão</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-600 border-b border-stone-200">
              <tr>
                <th className="py-3 px-4 font-semibold w-12 text-center">Ativa</th>
                <th className="py-3 px-4 font-semibold">Termo no Extrato</th>
                <th className="py-3 px-4 font-semibold">Tipo</th>
                <th className="py-3 px-4 font-semibold">Categoria Atribuída</th>
                <th className="py-3 px-4 font-semibold">Forma de Pagto</th>
                <th className="py-3 px-4 font-semibold text-center">Transações Cobertas</th>
                <th className="py-3 px-4 font-semibold text-center w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    Nenhuma regra cadastrada ou encontrada com os termos buscados.
                  </td>
                </tr>
              ) : (
                filteredRules.map((r) => {
                  const matchesCount = transactions.filter((t) =>
                    matchRule(`${t.originalDescription} ${t.description}`, r)
                  ).length;
                  const cat = DEFAULT_CATEGORIES.find((c) => c.name === r.category);

                  return (
                    <tr key={r.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={r.active}
                          onChange={() => onToggleRule(r.id)}
                          className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-stone-900">
                        {r.keyword}
                      </td>

                      <td className="py-3 px-4 text-stone-500">
                        {r.matchType === 'contains'
                          ? 'Contém'
                          : r.matchType === 'starts_with'
                          ? 'Começa com'
                          : 'Exato'}
                      </td>

                      <td className="py-3 px-4 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: cat?.color || '#64748b' }}
                          />
                          <span className="text-stone-800">{r.category}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-stone-600">
                        {r.paymentMethod || <span className="text-stone-400 italic">Original</span>}
                      </td>

                      <td className="py-3 px-4 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] ${
                            matchesCount > 0
                              ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                              : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {matchesCount} tx
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => onDeleteRule(r.id)}
                          title="Excluir regra"
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
    </div>
  );
};
