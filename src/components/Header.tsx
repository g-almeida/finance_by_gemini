import React from 'react';
import {
  RefreshCw,
  FolderSync,
  LayoutDashboard,
  ReceiptText,
  Tags,
  LogOut,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface HeaderProps {
  activeTab: 'dashboard' | 'transactions' | 'drive' | 'rules';
  setActiveTab: (tab: 'dashboard' | 'transactions' | 'drive' | 'rules') => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  availableYears: number[];
  user: User | null;
  isSyncing: boolean;
  onSync: () => void;
  onLogin: () => void;
  onLogout: () => void;
  uncategorizedCount: number;
  lastSyncTime?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  selectedYear,
  setSelectedYear,
  availableYears,
  user,
  isSyncing,
  onSync,
  onLogin,
  onLogout,
  uncategorizedCount,
  lastSyncTime,
}) => {
  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and App Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs font-semibold text-lg tracking-tight">
              FC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-stone-900 tracking-tight leading-none">
                  Controle Financeiro
                </h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                  Itaú Sync
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 hidden sm:block">
                Dashboard Anual & Leitura Automática Google Drive
              </p>
            </div>
          </div>

          {/* Year selector & Sync actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Year Selector */}
            <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-stone-500 ml-2" />
              <select
                id="year-selector"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-transparent text-stone-800 font-semibold py-1.5 px-2 text-xs focus:outline-none cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Ano {yr}
                  </option>
                ))}
              </select>
            </div>

            {/* Google Drive Status & Sync Button */}
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  id="sync-drive-button"
                  onClick={onSync}
                  disabled={isSyncing}
                  title={lastSyncTime ? `Última sincronização: ${lastSyncTime}` : 'Sincronizar arquivos do Drive'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden md:inline">
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Drive'}
                  </span>
                </button>

                <div className="relative group hidden lg:flex items-center gap-2 pl-2 border-l border-stone-200">
                  <div className="w-7 h-7 rounded-full bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-bold uppercase overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      user.email?.charAt(0) || 'U'
                    )}
                  </div>
                  <span className="text-xs text-stone-600 max-w-[120px] truncate" title={user.email || ''}>
                    {user.displayName?.split(' ')[0] || user.email?.split('@')[0]}
                  </span>
                  <button
                    id="user-logout-button"
                    onClick={onLogout}
                    title="Desconectar do Google"
                    className="p-1 rounded text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                id="sign-in-google-header"
                onClick={onLogin}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white text-stone-700 border border-stone-300 hover:bg-stone-50 shadow-2xs transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Conectar Drive</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-t border-stone-100 pt-1 pb-1 overflow-x-auto scrollbar-none">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard Anual</span>
          </button>

          <button
            id="tab-transactions"
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            <span>Transações & Categorias</span>
            {uncategorizedCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-800">
                {uncategorizedCount}
              </span>
            )}
          </button>

          <button
            id="tab-drive"
            onClick={() => setActiveTab('drive')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'drive'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <FolderSync className="w-4 h-4" />
            <span>Google Drive & Itaú</span>
            {user && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Conectado ao Google Drive" />
            )}
          </button>

          <button
            id="tab-rules"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
            }`}
          >
            <Tags className="w-4 h-4" />
            <span>Regras de Auto-Tagging</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              Auto
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
