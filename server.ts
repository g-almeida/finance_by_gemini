import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
// @ts-ignore
import * as pdfParseModule from 'pdf-parse';
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;
import { parseItauBankExtractText } from './src/lib/pdfStatementParser';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '30mb' }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Bank Statement PDF Parsing Endpoint (Extracts Itaú earnings and expenses)
  app.post('/api/parse-pdf', async (req, res) => {
    try {
      const { pdfBase64, fileName = 'extrato.pdf', folderPath = '...itau/extract/2026', defaultYear = 2026 } = req.body;
      if (!pdfBase64) {
        return res.status(400).json({ error: 'pdfBase64 is required' });
      }

      const buffer = Buffer.from(pdfBase64, 'base64');
      const ai = getGenAI();

      // 1. Try Gemini 3.8 Flash multimodal PDF extraction if available
      if (ai) {
        try {
          const prompt = `You are a Brazilian banking assistant specialized in parsing Banco Itaú bank account statements (Extrato de Conta Corrente / Extrato Mensal).
Extract ALL financial transactions (both EARNINGS/INCOME and EXPENSES/OUTFLOWS) from this PDF statement.
The statement belongs to folder path: "${folderPath}" and file: "${fileName}". The reference year is ${defaultYear} (or whatever year is specified in the statement).

CRITICAL INSTRUCTIONS:
1. EARNINGS / INCOMES / CRÉDITOS:
   - Examples: 'REND PAGO APLIC AUT MAIS', 'SALARIO', 'SALÁRIO', 'TED RECEBIDA', 'PIX RECEBIDO', 'ESTORNO', 'RESGATE DE INVESTIMENTOS', 'PRO-LABORE'.
   - The "amount" MUST BE POSITIVE (e.g. 8500.00, 15.30).
   - "category" should be 'Salário & Receitas' or 'Investimentos' or 'Transferências & PIX'.
   - "isEarning" must be true.

2. EXPENSES / DEBITS / SAÍDAS:
   - Examples: 'PIX ENVIADO', 'PAG BOLETO', 'COMPRA CARTAO DÉBITO', 'TARIFA CONTA CORRENTE', 'IOF', 'DEBITO AUTOMATICO'.
   - The "amount" MUST BE NEGATIVE (e.g. -150.00, -45.90).
   - "category" should match the expense (e.g. 'Moradia', 'Alimentação', 'Transporte', 'Impostos & Taxas', 'Serviços & Assinaturas', 'Outros').
   - "isEarning" must be false.

3. EXCLUDE SUMMARY / BALANCE ROWS:
   - DO NOT extract 'SALDO ANTERIOR', 'SALDO DO DIA', 'SALDO TOTAL DISPONIVEL', 'SDO CTA/APL', 'TOTAL ENTRADAS', 'TOTAL SAÍDAS', 'LIMITE DE CHEQUE ESPECIAL'. These are account balances, NOT transactions.

4. DATE:
   - Format: "YYYY-MM-DD". If the statement shows "02/01", use year ${defaultYear} -> "2026-01-02".

Return ONLY a valid JSON array:
[
  {
    "date": "YYYY-MM-DD",
    "description": "Clean human friendly merchant / entry",
    "originalDescription": "Raw entry name from PDF",
    "amount": 1234.56,
    "category": "Salário & Receitas",
    "paymentMethod": "PIX",
    "isEarning": true
  }
]`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                inlineData: {
                  data: pdfBase64,
                  mimeType: 'application/pdf',
                },
              },
              prompt,
            ],
            config: {
              responseMimeType: 'application/json',
            },
          });

          const responseText = response.text || '[]';
          const items: any[] = JSON.parse(responseText);

          if (Array.isArray(items) && items.length > 0) {
            const formatted = items.map((item, idx) => ({
              id: `itau-pdf-${item.date || defaultYear}-${idx}-${Math.abs(Math.round(item.amount * 100))}`,
              date: item.date || `${defaultYear}-01-01`,
              description: item.description || item.originalDescription || 'Transação Itaú',
              originalDescription: item.originalDescription || item.description || '',
              amount: Number(item.amount) || 0,
              category: item.category || (item.amount > 0 ? 'Salário & Receitas' : 'Outros'),
              paymentMethod: item.paymentMethod || (item.amount > 0 ? 'Transferência / TED' : 'Outro'),
              sourceFile: fileName,
              sourceFolder: folderPath,
              sourceType: 'bank_account' as const,
              fileType: 'pdf' as const,
              isEarning: item.amount > 0,
              isAutoCategorized: true,
              ruleApplied: `Itaú Extrato Conta Corrente (Gemini AI: ${item.amount > 0 ? 'Ganho' : 'Débito'})`,
            }));

            return res.json({
              transactions: formatted,
              source: 'gemini',
              count: formatted.length,
            });
          }
        } catch (geminiErr) {
          console.warn('Gemini PDF parse failed, falling back to algorithmic extraction:', geminiErr);
        }
      }

      // 2. Fallback: Parse PDF text using pdf-parse & Itaú algorithmic extractor
      const pdfData = await pdfParse(buffer);
      const parsed = parseItauBankExtractText(pdfData.text, fileName, folderPath, defaultYear);

      return res.json({
        transactions: parsed.transactions,
        year: parsed.year,
        source: 'algorithmic',
        count: parsed.transactions.length,
        rawTextLength: parsed.rawTextLength,
      });
    } catch (err: any) {
      console.error('Error parsing PDF statement:', err);
      return res.status(500).json({ error: err.message || 'Erro ao processar extrato em PDF' });
    }
  });

  // AI Categorization Endpoint
  app.post('/api/categorize', async (req, res) => {
    try {
      const { transactions, categories } = req.body;
      if (!Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: 'transactions must be a non-empty array' });
      }

      const ai = getGenAI();
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key not configured. Using rule-based categorization.',
        });
      }

      const prompt = `You are a Brazilian personal finance assistant specialized in parsing and categorizing bank statements (such as Banco Itaú, Nubank, Bradesco).
Here is the available list of categories:
${JSON.stringify(categories || [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer & Entretenimento',
  'Educação',
  'Compras Pessoais',
  'Serviços & Assinaturas',
  'Investimentos',
  'Salário & Receitas',
  'Transferências & PIX',
  'Cartão de Crédito',
  'Impostos & Taxas',
  'Outros'
])}

Categorize each of the following bank transaction descriptions. For each one, pick the best category from the list above and provide a cleaned, human-friendly merchant or description name.
Transactions to categorize:
${JSON.stringify(
  transactions.map((t: any) => ({
    id: t.id,
    description: t.description || t.descricao || '',
    amount: t.amount,
  }))
)}

Return ONLY a JSON array with objects matching:
[
  {
    "id": "original id",
    "category": "Matched category name exactly from the list",
    "cleanDescription": "Short human friendly name, e.g. 'Uber', 'Pão de Açúcar'",
    "paymentMethod": "Suggested payment method if identifiable (PIX, Cartão de Crédito, Débito, Boleto, etc.)"
  }
]
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '[]';
      const parsed = JSON.parse(responseText);
      return res.json({ results: parsed });
    } catch (err: any) {
      console.error('Categorization error:', err);
      return res.status(500).json({ error: err.message || 'Failed to categorize' });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
