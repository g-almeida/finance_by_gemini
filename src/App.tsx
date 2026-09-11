/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  logout,
} from './lib/firebaseAuth';
import {
  DEFAULT_ITAU_FOLDER_ID,
  DEFAULT_REPO_FOLDER_ID,
  INITIAL_RULES,
} from './lib/constants';
import { SAMPLE_TRANSACTIONS } from './lib/sampleData';
import {
  Transaction,
  CategorizationRule,
  DriveFileInfo,
  YearlyStats,
  MemorizedEstablishment,
} from './types';
import {
  computeYearlyStats,
  getAvailableYears,
} from './lib/financeStats';
import {
  batchCategorizeTransactions,
  requestAICategorization,
  cleanTransactionDescription,
} from './lib/categorizer';
import {
  syncFolderTransactions,
  findMainControlFile,
  downloadFileAsArrayBuffer,
  parsePdfStatementBuffer,
} from './lib/driveService';
import { parseStatementBuffer, isDateLike } from './lib/parserService';
import {
  loadEstablishmentMemory,
  recordEstablishmentCategory,
  recordBulkEstablishmentCategories,
  findCategoryFromMemory,
} from './lib/memoryService';

import { Header } from './components/Header';
import { YearlyDashboard } from './components/YearlyDashboard';
import { TransactionsTable } from './components/TransactionsTable';
import { DriveSyncPanel } from './components/DriveSyncPanel';
import { RulesManager } from './components/RulesManager';
import { ConfirmationModal } from './components/ConfirmationModal';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);

  // Active Tab & View Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'drive' | 'rules'>('dashboard');
  const [initialMonthFilter, setInitialMonthFilter] = useState<number | null>(null);

  // Core Data
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('fc_transactions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read transactions from localStorage', e);
    }
    return SAMPLE_TRANSACTIONS;
  });

  const [rules, setRules] = useState<CategorizationRule[]>(() => {
    try {
      const saved = localStorage.getItem('fc_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Could not read rules from localStorage', e);
    }
    return INITIAL_RULES;
  });

  // Establishment Memory: remembers manual selections for establishments
  const [establishmentMemory, setEstablishmentMemory] = useState<Record<string, MemorizedEstablishment>>(() => {
    return loadEstablishmentMemory();
  });

  // Self-healing migration for previously imported transactions where description was stored as date
  useEffect(() => {
    setTransactions((prev) => {
      let healed = false;
      const updated = prev.map((t) => {
        const descIsDate = isDateLike(t.description) || t.description === t.date;
        const origIsDate = isDateLike(t.originalDescription) || t.originalDescription === t.date;
        if (descIsDate && !origIsDate && t.originalDescription) {
          healed = true;
          const cleaned = cleanTransactionDescription(t.originalDescription);
          return {
            ...t,
            description: cleaned || t.originalDescription,
          };
        }
        return t;
      });
      return healed ? updated : prev;
    });
  }, []);

  // Google Drive Settings & State
  const [itauFolderId, setItauFolderId] = useState(DEFAULT_ITAU_FOLDER_ID);
  const [repoFolderId, setRepoFolderId] = useState(DEFAULT_REPO_FOLDER_ID);
  const [extractFolderId, setExtractFolderId] = useState<string>(() => {
    return localStorage.getItem('fc_extract_folder_id') || '';
  });
  const handleSetExtractFolderId = (id: string) => {
    setExtractFolderId(id);
    localStorage.setItem('fc_extract_folder_id', id);
  };
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(15);
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSyncProgress, setCurrentSyncProgress] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>(() => {
    return localStorage.getItem('fc_last_sync') || undefined;
  });

  // Sync Activity Log
  const [syncLog, setSyncLog] = useState<{
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }[]>([]);

  // AI Categorization loading
  const [isCategorizingAI, setIsCategorizingAI] = useState(false);

  // Notification Banner
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Confirmation Modal state for sensitive or destructive operations
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    setSyncLog((prev) => [{ timestamp, message, type }, ...prev.slice(0, 49)]);
  }, []);

  // Save to localStorage when transactions or rules change
  useEffect(() => {
    try {
      localStorage.setItem('fc_transactions', JSON.stringify(transactions));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem('fc_rules', JSON.stringify(rules));
    } catch (e) {
      console.warn('LocalStorage rules save failed', e);
    }
  }, [rules]);

  // Year Selection
  const availableYears = useMemo(() => getAvailableYears(transactions), [transactions]);
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears[0] || new Date().getFullYear();
  });

  // Compute stats for the selected year
  const yearlyStats: YearlyStats = useMemo(() => {
    return computeYearlyStats(transactions, selectedYear);
  }, [transactions, selectedYear]);

  // Initialize Firebase Auth listener on startup
  useEffect(() => {
    const unsubscribe = initAuth(
      (authUser) => {
        setUser(authUser);
        addLog(`Sessão conectada: ${authUser.email}`, 'info');
      },
      () => {
        setUser(null);
      }
    );
    return () => unsubscribe();
  }, [addLog]);

  // Handle Google Sign-in
  const handleLogin = async () => {
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        showToast(`Conectado como ${result.user.displayName || result.user.email}!`, 'success');
        addLog(`Login efetuado com sucesso via Google Workspace`, 'success');
        // Trigger sync automatically upon login
        handleSyncDrive();
      }
    } catch (err: any) {
      console.error('Login error:', err);
      showToast(err.message || 'Erro ao conectar conta Google', 'error');
      addLog(`Falha na autenticação: ${err.message}`, 'error');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      showToast('Desconectado com sucesso.', 'info');
      addLog('Usuário desconectado', 'info');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  // Google Drive Sync Engine
  const handleSyncDrive = useCallback(async () => {
    let token = await getAccessToken();
    if (!token) {
      if (!user) {
        showToast('Conecte sua conta Google para ler a pasta do Drive.', 'info');
        setActiveTab('drive');
        return;
      }
      try {
        const res = await googleSignIn();
        token = res?.accessToken || null;
      } catch (err) {
        showToast('Autorização necessária para acessar o Google Drive.', 'error');
        return;
      }
    }

    if (!token) return;

    setIsSyncing(true);
    setCurrentSyncProgress('Acessando pasta Itaú e subpastas de extratos no Google Drive...');
    addLog(`Iniciando leitura da pasta Itaú (${itauFolderId}) e extratos bancários...`, 'info');

    try {
      // 1. Sync statement files in the Itaú directory and subfolder ...itau/extract
      const itauResult = await syncFolderTransactions(
        itauFolderId,
        token,
        (fileName, idx, total) => {
          setCurrentSyncProgress(`Lendo extrato ${idx} de ${total}: ${fileName}`);
          addLog(`Processando "${fileName}" (${idx}/${total})...`, 'info');
        },
        extractFolderId
      );

      setDriveFiles(itauResult.processedFiles);

      // Count earnings (receitas) vs expenses (despesas) from the synced data
      const syncEarnings = itauResult.transactions.filter((t) => t.amount > 0).length;
      const syncExpenses = itauResult.transactions.filter((t) => t.amount < 0).length;

      // 2. Also check if 'Controle Financeiro lindo2.xlsx' is in repo folder
      setCurrentSyncProgress('Verificando planilha principal no repositório...');
      const mainFile = await findMainControlFile(repoFolderId, token);
      let mainSheetTransactions: Transaction[] = [];

      if (mainFile) {
        addLog(`Planilha principal localizada: "${mainFile.name}". Baixando dados...`, 'info');
        try {
          const mainBuffer = await downloadFileAsArrayBuffer(mainFile.id, token);
          const parsedMain = parseStatementBuffer(mainBuffer, mainFile.name);
          mainSheetTransactions = parsedMain.transactions;
          addLog(
            `Planilha principal lida com sucesso: ${mainSheetTransactions.length} transações extraídas.`,
            'success'
          );
        } catch (err: any) {
          console.warn('Failed to parse main sheet file:', err);
          addLog(`Aviso ao ler planilha principal: ${err.message}`, 'warning');
        }
      }

      // 3. Deduplicate and merge transactions
      const incoming = [...mainSheetTransactions, ...itauResult.transactions];
      let newCount = 0;

      setTransactions((prev) => {
        const existingMap = new Map<string, Transaction>();
        for (const t of prev) {
          existingMap.set(t.id, t);
        }

        for (const inTx of incoming) {
          if (!existingMap.has(inTx.id)) {
            existingMap.set(inTx.id, inTx);
            newCount++;
          }
        }

        const merged = Array.from(existingMap.values());
        // Run auto-categorization rules and establishment memory on newly added uncategorized items
        const { transactions: autoCategorized } = batchCategorizeTransactions(merged, rules, false, establishmentMemory);
        return autoCategorized;
      });

      const nowStr = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setLastSyncTime(nowStr);
      localStorage.setItem('fc_last_sync', nowStr);

      addLog(
        `Sincronização concluída! ${itauResult.processedFiles.length} arquivos processados (${syncEarnings} ganhos/receitas, ${syncExpenses} despesas). ${newCount} novas transações adicionadas.`,
        'success'
      );
      showToast(
        `Sincronização concluída! ${newCount} nova(s) transação(ões) incorporadas (${syncEarnings} receitas/ganhos detectados).`,
        'success'
      );
    } catch (err: any) {
      console.error('Sync error:', err);
      const msg = err.message || 'Erro ao sincronizar com Google Drive';
      addLog(`Erro na sincronização: ${msg}`, 'error');
      showToast(msg, 'error');
    } finally {
      setIsSyncing(false);
      setCurrentSyncProgress('');
    }
  }, [user, itauFolderId, repoFolderId, extractFolderId, rules, addLog, showToast]);

  // Frequent automatic background sync timer (as requested: "it should sync very often")
  useEffect(() => {
    if (!user || syncIntervalMinutes <= 0) return;

    const intervalMs = syncIntervalMinutes * 60 * 1000;
    addLog(
      `Agendamento de sincronização automática ativado: a cada ${syncIntervalMinutes} minutos`,
      'info'
    );

    const intervalId = setInterval(() => {
      handleSyncDrive();
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [user, syncIntervalMinutes, handleSyncDrive, addLog]);

  // Manual Local Statement Upload handler (supports both PDF bank account extracts and spreadsheets)
  const handleUploadLocalFile = async (file: File) => {
    try {
      addLog(`Processando upload manual: "${file.name}"...`, 'info');
      const buffer = await file.arrayBuffer();
      const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

      let incomingTransactions: Transaction[] = [];

      if (isPdf) {
        addLog(`Extraindo dados bancários e ganhos do PDF "${file.name}"...`, 'info');
        const pdfResult = await parsePdfStatementBuffer(
          buffer,
          file.name,
          '...itau/extract/2026',
          2026
        );
        incomingTransactions = pdfResult.transactions;
      } else {
        const parseResult = parseStatementBuffer(buffer, file.name);
        incomingTransactions = parseResult.transactions;
      }

      if (incomingTransactions.length === 0) {
        showToast('Nenhuma transação foi detectada neste arquivo.', 'error');
        addLog(`Nenhuma transação encontrada em "${file.name}"`, 'warning');
        return;
      }

      const earningsCount = incomingTransactions.filter((t) => t.amount > 0).length;
      const expensesCount = incomingTransactions.filter((t) => t.amount < 0).length;

      let addedCount = 0;
      setTransactions((prev) => {
        const map = new Map<string, Transaction>();
        for (const t of prev) map.set(t.id, t);
        for (const t of incomingTransactions) {
          if (!map.has(t.id)) {
            map.set(t.id, t);
            addedCount++;
          }
        }
        const merged = Array.from(map.values());
        const { transactions: categorized } = batchCategorizeTransactions(
          merged,
          rules,
          false,
          establishmentMemory
        );
        return categorized;
      });

      // Add to local files preview
      setDriveFiles((prev) => [
        {
          id: `local_${Date.now()}`,
          name: file.name,
          mimeType: file.type || (isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
          modifiedTime: new Date().toISOString(),
          size: `${(file.size / 1024).toFixed(1)} KB`,
          status: 'processed',
          transactionCount: incomingTransactions.length,
          fileType: isPdf ? 'pdf' : 'spreadsheet',
          sourceType: isPdf ? 'bank_account' : 'credit_card',
          folderPath: isPdf ? '...itau/extract/2026' : '...itau',
          isBankExtract: isPdf,
        },
        ...prev,
      ]);

      const successMsg = isPdf
        ? `Extrato PDF "${file.name}" processado! ${incomingTransactions.length} lançamentos (${earningsCount} receitas/ganhos, ${expensesCount} despesas).`
        : `Planilha "${file.name}" processada! ${incomingTransactions.length} transações lidas (${addedCount} novas).`;

      showToast(successMsg, 'success');
      addLog(successMsg, 'success');
    } catch (err: any) {
      console.error('File parse error:', err);
      showToast(`Falha ao ler arquivo: ${err.message}`, 'error');
      addLog(`Erro ao ler arquivo manual: ${err.message}`, 'error');
    }
  };

  // Transaction Actions
  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

    // If category is assigned and not "Outros", record in establishment memory
    if (updated.category && updated.category !== 'Outros') {
      const memoryTarget = updated.description || updated.originalDescription;
      const { memory: newMemory } = recordEstablishmentCategory(
        memoryTarget,
        updated.category,
        updated.paymentMethod,
        establishmentMemory
      );
      setEstablishmentMemory({ ...newMemory });

      // Automatically apply this memorized category to other transactions with the same establishment
      setTransactions((prev) => {
        let recatCount = 0;
        const refreshed = prev.map((t) => {
          if (t.id === updated.id) return updated;
          if (!t.category || t.category === 'Outros') {
            const match =
              findCategoryFromMemory(t.description, newMemory) ||
              findCategoryFromMemory(t.originalDescription, newMemory);
            if (match) {
              recatCount++;
              return {
                ...t,
                category: match.category,
                isAutoCategorized: true,
                isMemorized: true,
                ruleApplied: `Memória de seleção prévia: "${match.pattern}" -> ${match.category}`,
              };
            }
          }
          return t;
        });

        if (recatCount > 0) {
          showToast(
            `Categoria memorizada! ${recatCount} outra(s) transação(ões) de "${memoryTarget}" foram categorizadas automaticamente.`,
            'success'
          );
          addLog(
            `Memória prévia aplicada para ${recatCount} transações de "${memoryTarget}" -> ${updated.category}`,
            'success'
          );
        }
        return refreshed;
      });
    }
  };

  const handleBulkUpdateCategory = (ids: string[], newCategory: string) => {
    const idSet = new Set(ids);
    const affectedTxs = transactions.filter((t) => idSet.has(t.id));
    const descriptions = affectedTxs.map((t) => t.description || t.originalDescription);
    const updatedMemory = recordBulkEstablishmentCategories(descriptions, newCategory);
    setEstablishmentMemory({ ...updatedMemory });

    setTransactions((prev) =>
      prev.map((t) =>
        idSet.has(t.id) ? { ...t, category: newCategory, isAutoCategorized: false } : t
      )
    );
    showToast(
      `${ids.length} transações atualizadas para "${newCategory}" e estabelecimentos memorizados!`,
      'success'
    );
    addLog(
      `${ids.length} transações atualizadas e estabelecimentos gravados na memória`,
      'info'
    );
  };

  const handleDeleteTransaction = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Transação',
      message: 'Tem certeza que deseja remover esta transação do histórico local?',
      confirmLabel: 'Excluir',
      isDestructive: true,
      onConfirm: () => {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        showToast('Transação removida.', 'info');
      },
    });
  };

  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const id = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const created: Transaction = {
      ...newTx,
      id,
    };
    setTransactions((prev) => [created, ...prev]);

    // Also record into establishment memory if category is not Outros
    if (newTx.category && newTx.category !== 'Outros' && newTx.description) {
      const { memory: newMemory } = recordEstablishmentCategory(
        newTx.description,
        newTx.category,
        newTx.paymentMethod,
        establishmentMemory
      );
      setEstablishmentMemory({ ...newMemory });
    }

    showToast('Transação registrada com sucesso!', 'success');
  };

  // Auto-Categorization Actions
  const handleAutoCategorizeAll = () => {
    const { transactions: updated, categorizedCount } = batchCategorizeTransactions(
      transactions,
      rules,
      false,
      establishmentMemory
    );
    setTransactions(updated);
    showToast(
      categorizedCount > 0
        ? `${categorizedCount} transações foram categorizadas automaticamente com sua memória e regras!`
        : 'Todas as transações elegíveis já estão categorizadas pela memória e regras.',
      'success'
    );
    addLog(
      `Categorização automática executada: ${categorizedCount} transações atualizadas`,
      'info'
    );
  };

  const handleCreateRuleFromTx = (tx: Transaction, targetCategory: string) => {
    // Extract a smart keyword from the description (e.g. "iFood *Restaurante" -> "ifood")
    const cleanWord = tx.originalDescription || tx.description;
    const words = cleanWord.split(/[\s*]+/);
    const candidateKeyword = words[0]?.length > 2 ? words[0].toLowerCase() : cleanWord.toLowerCase();

    const newRule: CategorizationRule = {
      id: `rule_${Date.now()}`,
      keyword: candidateKeyword,
      matchType: 'contains',
      category: targetCategory,
      paymentMethod: tx.paymentMethod,
      active: true,
    };

    setRules((prev) => [newRule, ...prev]);

    // Immediately run on existing transactions
    const { transactions: updated, categorizedCount } = batchCategorizeTransactions(
      transactions,
      [newRule, ...rules],
      false,
      establishmentMemory
    );
    setTransactions(updated);

    showToast(
      `Nova regra criada: "${candidateKeyword}" -> ${targetCategory}. ${categorizedCount} transações foram atualizadas!`,
      'success'
    );
    addLog(`Nova regra cadastrada para termo "${candidateKeyword}"`, 'success');
  };

  // AI Categorization Action
  const handleAICategorize = async () => {
    const uncategorized = transactions.filter(
      (t) => !t.category || t.category === 'Outros' || t.category === 'Não categorizado'
    );

    if (uncategorized.length === 0) {
      showToast('Não há transações pendentes de categorização!', 'info');
      return;
    }

    setIsCategorizingAI(true);
    addLog(`Iniciando auto-tagging com IA para ${uncategorized.length} transações...`, 'info');

    try {
      const batchToProcess = uncategorized.slice(0, 40); // Process batch
      const categories = [
        'Alimentação',
        'Moradia & Contas',
        'Transporte',
        'Saúde & Farmácia',
        'Lazer & Assinaturas',
        'Educação',
        'Compras Pessoais',
        'Serviços & Tarifas',
        'Investimentos',
        'Salário & Receitas',
        'Cartão de Crédito',
        'Outros',
      ];

      const results = await requestAICategorization(batchToProcess, categories);

      if (results && results.length > 0) {
        const resultMap = new Map<string, { category: string; cleanDescription?: string; paymentMethod?: any }>();
        for (const r of results) {
          resultMap.set(r.id, r);
        }

        let updatedCount = 0;
        setTransactions((prev) =>
          prev.map((tx) => {
            const match = resultMap.get(tx.id);
            if (match) {
              updatedCount++;
              return {
                ...tx,
                category: match.category || tx.category,
                description: match.cleanDescription || tx.description,
                paymentMethod: match.paymentMethod || tx.paymentMethod,
                isAutoCategorized: true,
                ruleApplied: 'Inteligência Artificial (Gemini)',
              };
            }
            return tx;
          })
        );

        showToast(`${updatedCount} transações foram classificadas com IA!`, 'success');
        addLog(`IA concluiu a classificação de ${updatedCount} transações com sucesso`, 'success');
      } else {
        // Fallback to rule engine
        handleAutoCategorizeAll();
      }
    } catch (err: any) {
      console.warn('AI categorization fallback to rules:', err);
      handleAutoCategorizeAll();
      showToast('Aplicadas regras automáticas padrão para as transações.', 'info');
    } finally {
      setIsCategorizingAI(false);
    }
  };

  // Rules Manager Actions
  const handleAddRule = (newRule: Omit<CategorizationRule, 'id'>) => {
    const rule: CategorizationRule = {
      ...newRule,
      id: `rule_${Date.now()}`,
    };
    setRules((prev) => [rule, ...prev]);
    showToast(`Regra "${rule.keyword}" cadastrada!`, 'success');
    addLog(`Regra criada: "${rule.keyword}" -> ${rule.category}`, 'info');

    // Run rule on current transactions
    const { transactions: updated, categorizedCount } = batchCategorizeTransactions(
      transactions,
      [rule, ...rules],
      false,
      establishmentMemory
    );
    if (categorizedCount > 0) {
      setTransactions(updated);
      showToast(`${categorizedCount} transações atualizadas com a nova regra!`, 'success');
    }
  };

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  const handleDeleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    showToast('Regra excluída.', 'info');
  };

  const handleResetDefaultRules = () => {
    setRules(INITIAL_RULES);
    showToast('Regras padrão restauradas.', 'success');
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-900 text-white border-rose-800'
                : 'bg-stone-900 text-white border-stone-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-stone-300 shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-stone-400 hover:text-white leading-none text-base"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'transactions') {
            setInitialMonthFilter(null);
          }
        }}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        availableYears={availableYears}
        user={user}
        isSyncing={isSyncing}
        onSync={handleSyncDrive}
        onLogin={handleLogin}
        onLogout={handleLogout}
        uncategorizedCount={yearlyStats.uncategorizedCount}
        lastSyncTime={lastSyncTime}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <YearlyDashboard
            stats={yearlyStats}
            selectedYear={selectedYear}
            onSelectMonth={(monthIdx) => {
              setInitialMonthFilter(monthIdx);
              setActiveTab('transactions');
            }}
            onGoToCategorization={() => {
              setActiveTab('transactions');
            }}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsTable
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
            onBulkUpdateCategory={handleBulkUpdateCategory}
            onDeleteTransaction={handleDeleteTransaction}
            onAddTransaction={handleAddTransaction}
            onCreateRuleFromTx={handleCreateRuleFromTx}
            onAutoCategorizeAll={handleAutoCategorizeAll}
            onAICategorize={handleAICategorize}
            isCategorizingAI={isCategorizingAI}
            selectedYear={selectedYear}
            initialMonthFilter={initialMonthFilter}
            establishmentMemory={establishmentMemory}
          />
        )}

        {activeTab === 'drive' && (
          <DriveSyncPanel
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
            isSyncing={isSyncing}
            onSyncNow={handleSyncDrive}
            lastSyncTime={lastSyncTime}
            driveFiles={driveFiles}
            itauFolderId={itauFolderId}
            setItauFolderId={setItauFolderId}
            repoFolderId={repoFolderId}
            setRepoFolderId={setRepoFolderId}
            extractFolderId={extractFolderId}
            setExtractFolderId={handleSetExtractFolderId}
            syncIntervalMinutes={syncIntervalMinutes}
            setSyncIntervalMinutes={setSyncIntervalMinutes}
            onUploadLocalFile={handleUploadLocalFile}
            syncLog={syncLog}
            currentSyncProgress={currentSyncProgress}
          />
        )}

        {activeTab === 'rules' && (
          <RulesManager
            rules={rules}
            onAddRule={handleAddRule}
            onToggleRule={handleToggleRule}
            onDeleteRule={handleDeleteRule}
            onResetDefaultRules={handleResetDefaultRules}
            onApplyRulesNow={handleAutoCategorizeAll}
            transactions={transactions}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-4 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Controle Financeiro • Sincronizado com Itaú & Google Drive
          </div>
          <div className="flex items-center gap-4 text-stone-400">
            <span>Controle Financeiro lindo2.xlsx</span>
            <span>•</span>
            <span>Total de {transactions.length} transações indexadas</span>
          </div>
        </div>
      </footer>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        isDestructive={confirmModal.isDestructive}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
