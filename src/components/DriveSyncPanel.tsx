import React, { useState } from 'react';
import {
  FolderSync,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Upload,
  Clock,
  HardDrive,
  Settings,
  ShieldCheck,
  Landmark,
  Coins,
  FileCheck,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { DriveFileInfo } from '../types';

interface DriveSyncPanelProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  isSyncing: boolean;
  onSyncNow: () => void;
  lastSyncTime?: string;
  driveFiles: DriveFileInfo[];
  itauFolderId: string;
  setItauFolderId: (id: string) => void;
  repoFolderId: string;
  setRepoFolderId: (id: string) => void;
  extractFolderId?: string;
  setExtractFolderId?: (id: string) => void;
  syncIntervalMinutes: number;
  setSyncIntervalMinutes: (mins: number) => void;
  onUploadLocalFile: (file: File) => void;
  syncLog: { timestamp: string; message: string; type: 'info' | 'success' | 'warning' | 'error' }[];
  currentSyncProgress?: string;
}

export const DriveSyncPanel: React.FC<DriveSyncPanelProps> = ({
  user,
  onLogin,
  onLogout,
  isSyncing,
  onSyncNow,
  lastSyncTime,
  driveFiles,
  itauFolderId,
  setItauFolderId,
  repoFolderId,
  setRepoFolderId,
  extractFolderId = '',
  setExtractFolderId,
  syncIntervalMinutes,
  setSyncIntervalMinutes,
  onUploadLocalFile,
  syncLog,
  currentSyncProgress,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [fileFilter, setFileFilter] = useState<'all' | 'pdf' | 'spreadsheet'>('all');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onUploadLocalFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadLocalFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Account & Drive Integration Status */}
      <div className="bg-white rounded-xl p-6 border border-stone-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FolderSync className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900 tracking-tight">
                  Integração Google Drive & Sincronização Itaú
                </h3>
                {user && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Conectado
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Leitura contínua dos extratos mensais depositados na pasta do Google Drive
              </p>
            </div>
          </div>

          <div>
            {user ? (
              <button
                id="btn-sync-now-main"
                onClick={onSyncNow}
                disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando Extratos...' : 'Sincronizar Agora'}</span>
              </button>
            ) : (
              <button
                id="btn-connect-drive-primary"
                onClick={onLogin}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Conectar Conta Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Live sync progress alert */}
        {isSyncing && currentSyncProgress && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            <span className="font-semibold">{currentSyncProgress}</span>
          </div>
        )}

        {/* Google Drive Configuration & Folders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Itaú Extratos Directory */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
                Faturas Cartão (Itaú)
              </span>
              <a
                href={`https://drive.google.com/drive/folders/${itauFolderId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-semibold"
              >
                <span>Abrir</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-[11px] text-stone-500">
              Caminho: <code className="text-stone-700 font-mono">...itau/</code>
            </div>
            <div className="text-[10px] text-stone-400 font-mono break-all">
              ID: {itauFolderId}
            </div>
          </div>

          {/* Itaú Extrato Conta Corrente (PDFs & Earnings) */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-emerald-700" />
                Extratos Conta & Ganhos (PDF)
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                2026 + Anos Anteriores
              </span>
            </div>
            <div className="text-[11px] text-stone-600">
              Caminho: <code className="text-emerald-900 font-mono font-semibold">...itau/extract/</code>
            </div>
            <div className="text-[10px] text-stone-500 leading-relaxed">
              Vasculha subpastas como <span className="font-semibold text-stone-700">extract/2026/</span> lendo extratos PDF, identificando salários e ganhos (+).
            </div>
          </div>

          {/* Repo & Planilha Principal */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                Planilha Principal & Repo
              </span>
              <a
                href={`https://drive.google.com/drive/folders/${repoFolderId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-semibold"
              >
                <span>Abrir</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="text-[11px] text-stone-500">
              Planilha: <strong className="text-stone-700">Controle Financeiro lindo2.xlsx</strong>
            </div>
            <div className="text-[10px] text-stone-400 font-mono break-all">
              ID: {repoFolderId}
            </div>
          </div>
        </div>

        {/* Sync Frequency Controls */}
        <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-stone-400" />
            <span className="text-stone-600 font-semibold">Frequência de Leitura Automática:</span>
            <select
              value={syncIntervalMinutes}
              onChange={(e) => setSyncIntervalMinutes(parseInt(e.target.value, 10))}
              className="p-1.5 border border-stone-200 rounded-md bg-white text-stone-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value={5}>A cada 5 minutos (Muito frequente)</option>
              <option value={15}>A cada 15 minutos (Recomendado)</option>
              <option value={30}>A cada 30 minutos</option>
              <option value={60}>A cada 1 hora</option>
              <option value={0}>Manual (Apenas ao clicar)</option>
            </select>
          </div>

          <div className="text-stone-400 text-[11px]">
            {lastSyncTime ? (
              <span>Última sincronização: <strong className="text-stone-700">{lastSyncTime}</strong></span>
            ) : (
              <span>Nenhuma sincronização realizada nesta sessão</span>
            )}
          </div>
        </div>
      </div>

      {/* Two Columns: Detected Statements on Drive & Drag-and-Drop Local Extratos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detected Files List */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-stone-100">
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <FolderSync className="w-4 h-4 text-emerald-600" />
                <span>Arquivos Detectados ({driveFiles.length})</span>
              </h4>
              
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 text-[11px] bg-stone-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFileFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    fileFilter === 'all'
                      ? 'bg-white text-stone-900 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Todos ({driveFiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFileFilter('pdf')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer flex items-center gap-1 ${
                    fileFilter === 'pdf'
                      ? 'bg-white text-rose-700 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <FileText className="w-3 h-3 text-rose-600" />
                  <span>PDFs Conta ({driveFiles.filter(f => f.fileType === 'pdf' || f.name.toLowerCase().endsWith('.pdf')).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFileFilter('spreadsheet')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer flex items-center gap-1 ${
                    fileFilter === 'spreadsheet'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                  <span>Planilhas ({driveFiles.filter(f => f.fileType !== 'pdf' && !f.name.toLowerCase().endsWith('.pdf')).length})</span>
                </button>
              </div>
            </div>

            {driveFiles.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-xs space-y-2">
                <p>Nenhum extrato processado ainda da pasta Itaú.</p>
                <p className="text-[11px] text-stone-400">
                  Ao clicar em <strong>Sincronizar Agora</strong>, o app lerá faturas em planilha (.xlsx, .xls, .csv) e extratos de conta em PDF (.pdf de ...itau/extract/2026).
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {driveFiles
                  .filter((file) => {
                    const isPdf = file.fileType === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
                    if (fileFilter === 'pdf') return isPdf;
                    if (fileFilter === 'spreadsheet') return !isPdf;
                    return true;
                  })
                  .map((file) => {
                    const isPdf = file.fileType === 'pdf' || file.name.toLowerCase().endsWith('.pdf');
                    return (
                      <div
                        key={file.id}
                        className="p-3 rounded-lg border border-stone-100 bg-stone-50/50 flex items-center justify-between text-xs hover:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          {isPdf ? (
                            <div className="w-7 h-7 rounded-md bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                              <FileSpreadsheet className="w-4 h-4" />
                            </div>
                          )}
                          <div className="truncate">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-stone-800 truncate" title={file.name}>
                                {file.name}
                              </span>
                              {isPdf ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                  Extrato CC & Ganhos
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 shrink-0">
                                  Fatura Cartão
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400 mt-0.5">
                              {file.folderPath && <span className="font-mono text-stone-500 mr-2">{file.folderPath}</span>}
                              {file.size || 'Tamanho n/d'} • Modificado em {new Date(file.modifiedTime).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {file.status === 'processed' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {file.transactionCount !== undefined ? `${file.transactionCount} tx` : 'Lido'}
                            </span>
                          ) : file.status === 'error' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Erro
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600">
                              Pendente
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100 text-[11px] text-stone-500 flex items-center justify-between">
            <span>Você pode colar extratos PDF na pasta <code className="text-emerald-800 font-bold">itau/extract/2026/</code></span>
            <button
              onClick={onSyncNow}
              disabled={isSyncing || !user}
              className="text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer disabled:opacity-50"
            >
              Sincronizar Agora
            </button>
          </div>
        </div>

        {/* Local Statement Dropzone (Instant manual test & import) */}
        <div className="bg-white rounded-xl p-5 border border-stone-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="mb-3 pb-2 border-b border-stone-100">
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Importação Rápida / Teste Manual</span>
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Arraste um extrato bancário em PDF (.pdf) com ganhos ou planilhas (.xlsx, .xls, .csv)
              </p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-stone-200 hover:border-emerald-400 bg-stone-50/30'
              }`}
              onClick={() => document.getElementById('manual-file-upload')?.click()}
            >
              <input
                id="manual-file-upload"
                type="file"
                accept=".pdf,.xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-bold text-stone-800">
                Clique para selecionar ou arraste o arquivo aqui
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                Suporta Extratos de Conta Corrente em PDF (.pdf) com ganhos e planilhas Itaú (.xlsx, .xls, .csv)
              </p>
            </div>
          </div>

          {/* Sync Activity Log */}
          <div className="mt-4 pt-3 border-t border-stone-100">
            <h5 className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
              Histórico de Atividade da Sincronização
            </h5>
            <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[10px] text-stone-600">
              {syncLog.length === 0 ? (
                <div className="text-stone-400 italic">Nenhum evento registrado ainda.</div>
              ) : (
                syncLog.slice(0, 5).map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-stone-400 shrink-0">[{entry.timestamp}]</span>
                    <span
                      className={
                        entry.type === 'error'
                          ? 'text-rose-600 font-semibold'
                          : entry.type === 'success'
                          ? 'text-emerald-700 font-semibold'
                          : entry.type === 'warning'
                          ? 'text-amber-600'
                          : 'text-stone-600'
                      }
                    >
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
