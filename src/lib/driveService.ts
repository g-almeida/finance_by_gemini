import { DriveFileInfo, Transaction } from '../types';
import { parseStatementBuffer } from './parserService';

export class DriveApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'DriveApiError';
    this.status = status;
  }
}

export async function listFolderFiles(
  folderId: string,
  accessToken: string
): Promise<DriveFileInfo[]> {
  try {
    const query = `'${folderId}' in parents and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      throw new DriveApiError('Sessão expirada. Por favor, faça login novamente.', 401);
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new DriveApiError(
        err.error?.message || `Erro ao acessar o Google Drive (status ${response.status})`,
        response.status
      );
    }

    const data = await response.json();
    const files: any[] = data.files || [];

    return files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      size: f.size ? formatFileSize(parseInt(f.size, 10)) : undefined,
      status: 'pending',
    }));
  } catch (error: any) {
    console.error('Error listing Drive files:', error);
    throw error;
  }
}

export async function downloadFileAsArrayBuffer(
  fileId: string,
  accessToken: string
): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new DriveApiError('Sessão expirada. Por favor, faça login novamente.', 401);
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new DriveApiError(
      err.error?.message || `Erro ao baixar arquivo do Drive (${response.status})`,
      response.status
    );
  }

  return await response.arrayBuffer();
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function parsePdfStatementBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  folderPath: string = '...itau/extract/2026',
  defaultYear: number = 2026
): Promise<{ transactions: Transaction[]; year: number; source: string }> {
  const base64 = arrayBufferToBase64(buffer);
  const response = await fetch('/api/parse-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64: base64,
      fileName,
      folderPath,
      defaultYear,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao processar PDF (${response.status})`);
  }

  const data = await response.json();
  return {
    transactions: data.transactions || [],
    year: data.year || defaultYear,
    source: data.source || 'algorithmic',
  };
}

/**
 * Recursively crawls a folder to discover statements (both credit card sheets and bank extract PDFs)
 */
export async function crawlFolderForStatements(
  rootFolderId: string,
  accessToken: string,
  rootPathName: string = '...itau',
  maxDepth: number = 3
): Promise<DriveFileInfo[]> {
  const discovered: DriveFileInfo[] = [];
  const queue: { folderId: string; currentPath: string; depth: number }[] = [
    { folderId: rootFolderId, currentPath: rootPathName, depth: 0 },
  ];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const item = queue.shift()!;
    if (visited.has(item.folderId)) continue;
    visited.add(item.folderId);

    try {
      const query = `'${item.folderId}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&fields=files(id,name,mimeType,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=100`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 401) {
        throw new DriveApiError('Sessão expirada. Por favor, faça login novamente.', 401);
      }
      if (!response.ok) continue;

      const data = await response.json();
      const files: any[] = data.files || [];

      for (const f of files) {
        const isFolder = f.mimeType === 'application/vnd.google-apps.folder';

        if (isFolder) {
          if (item.depth < maxDepth) {
            queue.push({
              folderId: f.id,
              currentPath: `${item.currentPath}/${f.name}`,
              depth: item.depth + 1,
            });
          }
          continue;
        }

        const lowerName = f.name.toLowerCase();
        const isSpreadsheet =
          lowerName.endsWith('.xlsx') ||
          lowerName.endsWith('.xls') ||
          lowerName.endsWith('.csv') ||
          f.mimeType.includes('spreadsheet') ||
          f.mimeType.includes('excel') ||
          f.mimeType.includes('csv');

        const isPdf = lowerName.endsWith('.pdf') || f.mimeType === 'application/pdf';

        if (isSpreadsheet || isPdf) {
          // Detect year if mentioned in file or path (e.g. 2026, 2025)
          const yearMatch = `${item.currentPath}/${f.name}`.match(/\b(202\d)\b/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : 2026;

          // Determine if bank extract (pdf or in extract folder) vs credit card
          const isExtractPath =
            item.currentPath.toLowerCase().includes('extract') ||
            item.currentPath.toLowerCase().includes('extrato') ||
            isPdf;

          discovered.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime,
            size: f.size ? formatFileSize(parseInt(f.size, 10)) : undefined,
            status: 'pending',
            folderPath: item.currentPath,
            fileType: isPdf ? 'pdf' : 'spreadsheet',
            sourceType: isExtractPath ? 'bank_account' : 'credit_card',
            isBankExtract: isExtractPath,
            year,
          });
        }
      }
    } catch (err) {
      console.warn(`Error crawling folder ${item.currentPath}:`, err);
    }
  }

  return discovered;
}

export async function syncFolderTransactions(
  folderId: string,
  accessToken: string,
  onFileProgress?: (fileName: string, index: number, total: number) => void,
  extractFolderId?: string
): Promise<{
  transactions: Transaction[];
  processedFiles: DriveFileInfo[];
  errors: string[];
}> {
  // Discover all files across folder and subfolders (...itau, ...itau/extract, 2026, etc.)
  let eligibleFiles = await crawlFolderForStatements(folderId, accessToken, '...itau');

  // If a separate extractFolderId was specified and different, also crawl it
  if (extractFolderId && extractFolderId.trim() && extractFolderId !== folderId) {
    try {
      const extractFiles = await crawlFolderForStatements(
        extractFolderId.trim(),
        accessToken,
        '...itau/extract'
      );
      const existingIds = new Set(eligibleFiles.map((f) => f.id));
      for (const ef of extractFiles) {
        if (!existingIds.has(ef.id)) {
          eligibleFiles.push(ef);
        }
      }
    } catch (extractErr) {
      console.warn('Could not crawl secondary extract folder:', extractErr);
    }
  }

  const allTransactions: Transaction[] = [];
  const processedFiles: DriveFileInfo[] = [];
  const errors: string[] = [];

  for (let i = 0; i < eligibleFiles.length; i++) {
    const file = eligibleFiles[i];
    if (onFileProgress) {
      onFileProgress(file.name, i + 1, eligibleFiles.length);
    }

    try {
      const buffer = await downloadFileAsArrayBuffer(file.id, accessToken);

      if (file.fileType === 'pdf') {
        // Parse PDF bank extract (including earnings & debits)
        const pdfResult = await parsePdfStatementBuffer(
          buffer,
          file.name,
          file.folderPath || '...itau/extract/2026',
          file.year || 2026
        );

        processedFiles.push({
          ...file,
          status: 'processed',
          transactionCount: pdfResult.transactions.length,
        });

        allTransactions.push(...pdfResult.transactions);
      } else {
        // Parse spreadsheet statement
        const parseResult = parseStatementBuffer(buffer, file.name);

        processedFiles.push({
          ...file,
          status: 'processed',
          transactionCount: parseResult.transactions.length,
        });

        allTransactions.push(...parseResult.transactions);
      }
    } catch (err: any) {
      console.warn(`Could not parse file ${file.name}:`, err);
      processedFiles.push({
        ...file,
        status: 'error',
      });
      errors.push(`Arquivo "${file.name}": ${err.message || 'Erro ao processar'}`);
    }
  }

  return {
    transactions: allTransactions,
    processedFiles,
    errors,
  };
}

// Search for the user's main control workbook in the repo folder or drive
export async function findMainControlFile(
  repoFolderId: string,
  accessToken: string
): Promise<DriveFileInfo | null> {
  try {
    const files = await listFolderFiles(repoFolderId, accessToken);
    const mainFile = files.find(
      (f) =>
        f.name.toLowerCase().includes('controle financeiro lindo2') ||
        f.name.toLowerCase().includes('controle financeiro')
    );
    return mainFile || null;
  } catch (err) {
    console.warn('Could not find main control file in folder:', err);
    return null;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
