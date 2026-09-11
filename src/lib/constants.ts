import { Category, CategorizationRule, PaymentMethod } from '../types';

export const DEFAULT_REPO_FOLDER_ID = '1_uZKeMh84075hdBHLrXuohuBySLyEIrp';
export const DEFAULT_ITAU_FOLDER_ID = '1Q50M-c21kcsTW2u5I_xt3wHCH2lo01jU';
export const MAIN_SHEET_NAME = 'Controle Financeiro lindo2.xlsx';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Boleto',
  'Transferência / TED',
  'Dinheiro',
  'Outro',
];

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-salario', name: 'Salário & Receitas', color: '#10b981', type: 'income', icon: 'Wallet' },
  { id: 'cat-alimentacao', name: 'Alimentação', color: '#f59e0b', type: 'expense', icon: 'Utensils' },
  { id: 'cat-moradia', name: 'Moradia & Contas', color: '#3b82f6', type: 'expense', icon: 'Home' },
  { id: 'cat-transporte', name: 'Transporte', color: '#6366f1', type: 'expense', icon: 'Car' },
  { id: 'cat-saude', name: 'Saúde & Farmácia', color: '#ec4899', type: 'expense', icon: 'HeartPulse' },
  { id: 'cat-lazer', name: 'Lazer & Assinaturas', color: '#8b5cf6', type: 'expense', icon: 'Tv' },
  { id: 'cat-compras', name: 'Compras Pessoais', color: '#14b8a6', type: 'expense', icon: 'ShoppingBag' },
  { id: 'cat-educacao', name: 'Educação', color: '#06b6d4', type: 'expense', icon: 'GraduationCap' },
  { id: 'cat-servicos', name: 'Serviços & Tarifas', color: '#64748b', type: 'expense', icon: 'Briefcase' },
  { id: 'cat-fatura', name: 'Fatura de Cartão', color: '#ef4444', type: 'transfer', icon: 'CreditCard' },
  { id: 'cat-invest', name: 'Investimentos', color: '#059669', type: 'investment', icon: 'TrendingUp' },
  { id: 'cat-outros', name: 'Outros', color: '#94a3b8', type: 'expense', icon: 'MoreHorizontal' },
];

export const INITIAL_RULES: CategorizationRule[] = [
  // Alimentação
  { id: 'r1', keyword: 'ifood', matchType: 'contains', category: 'Alimentação', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r2', keyword: 'rappi', matchType: 'contains', category: 'Alimentação', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r3', keyword: 'pao de acucar', matchType: 'contains', category: 'Alimentação', paymentMethod: 'Cartão de Débito', active: true },
  { id: 'r4', keyword: 'carrefour', matchType: 'contains', category: 'Alimentação', paymentMethod: 'Cartão de Débito', active: true },
  { id: 'r5', keyword: 'supermercado', matchType: 'contains', category: 'Alimentação', paymentMethod: 'Cartão de Débito', active: true },
  { id: 'r6', keyword: 'mercado', matchType: 'contains', category: 'Alimentação', active: true },
  { id: 'r7', keyword: 'padaria', matchType: 'contains', category: 'Alimentação', active: true },
  { id: 'r8', keyword: 'restaurante', matchType: 'contains', category: 'Alimentação', active: true },
  { id: 'r9', keyword: 'mcdonald', matchType: 'contains', category: 'Alimentação', active: true },
  { id: 'r10', keyword: 'outback', matchType: 'contains', category: 'Alimentação', active: true },
  { id: 'r11', keyword: 'habibs', matchType: 'contains', category: 'Alimentação', active: true },
  { id: 'r12', keyword: 'acougue', matchType: 'contains', category: 'Alimentação', active: true },

  // Transporte
  { id: 'r13', keyword: 'uber', matchType: 'contains', category: 'Transporte', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r14', keyword: '99 app', matchType: 'contains', category: 'Transporte', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r15', keyword: 'posto', matchType: 'contains', category: 'Transporte', paymentMethod: 'Cartão de Débito', active: true },
  { id: 'r16', keyword: 'shell', matchType: 'contains', category: 'Transporte', active: true },
  { id: 'r17', keyword: 'ipiranga', matchType: 'contains', category: 'Transporte', active: true },
  { id: 'r18', keyword: 'combustivel', matchType: 'contains', category: 'Transporte', active: true },
  { id: 'r19', keyword: 'estapar', matchType: 'contains', category: 'Transporte', active: true },
  { id: 'r20', keyword: 'sem parar', matchType: 'contains', category: 'Transporte', active: true },
  { id: 'r21', keyword: 'veloe', matchType: 'contains', category: 'Transporte', active: true },

  // Moradia & Contas
  { id: 'r22', keyword: 'aluguel', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Transferência / TED', active: true },
  { id: 'r23', keyword: 'condominio', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },
  { id: 'r24', keyword: 'enel', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },
  { id: 'r25', keyword: 'sabesp', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },
  { id: 'r26', keyword: 'cpfl', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },
  { id: 'r27', keyword: 'comgas', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },
  { id: 'r28', keyword: 'vivo', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },
  { id: 'r29', keyword: 'claro', matchType: 'contains', category: 'Moradia & Contas', paymentMethod: 'Boleto', active: true },

  // Saúde & Farmácia
  { id: 'r30', keyword: 'droga raia', matchType: 'contains', category: 'Saúde & Farmácia', active: true },
  { id: 'r31', keyword: 'drogasil', matchType: 'contains', category: 'Saúde & Farmácia', active: true },
  { id: 'r32', keyword: 'farmacia', matchType: 'contains', category: 'Saúde & Farmácia', active: true },
  { id: 'r33', keyword: 'drogaria', matchType: 'contains', category: 'Saúde & Farmácia', active: true },
  { id: 'r34', keyword: 'laboratorio', matchType: 'contains', category: 'Saúde & Farmácia', active: true },
  { id: 'r35', keyword: 'consulta', matchType: 'contains', category: 'Saúde & Farmácia', active: true },

  // Lazer & Assinaturas
  { id: 'r36', keyword: 'netflix', matchType: 'contains', category: 'Lazer & Assinaturas', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r37', keyword: 'spotify', matchType: 'contains', category: 'Lazer & Assinaturas', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r38', keyword: 'amazon prime', matchType: 'contains', category: 'Lazer & Assinaturas', paymentMethod: 'Cartão de Crédito', active: true },
  { id: 'r39', keyword: 'cinema', matchType: 'contains', category: 'Lazer & Assinaturas', active: true },
  { id: 'r40', keyword: 'steam', matchType: 'contains', category: 'Lazer & Assinaturas', active: true },
  { id: 'r41', keyword: 'playstation', matchType: 'contains', category: 'Lazer & Assinaturas', active: true },

  // Salário & Receitas
  { id: 'r42', keyword: 'salario', matchType: 'contains', category: 'Salário & Receitas', paymentMethod: 'Transferência / TED', active: true },
  { id: 'r43', keyword: 'remuneracao', matchType: 'contains', category: 'Salário & Receitas', paymentMethod: 'Transferência / TED', active: true },
  { id: 'r44', keyword: 'ted recebida', matchType: 'contains', category: 'Salário & Receitas', paymentMethod: 'Transferência / TED', active: true },
  { id: 'r45', keyword: 'rend pago aplic', matchType: 'contains', category: 'Salário & Receitas', active: true },
  { id: 'r46', keyword: 'dividendos', matchType: 'contains', category: 'Salário & Receitas', active: true },

  // Fatura de Cartão
  { id: 'r47', keyword: 'fatura', matchType: 'contains', category: 'Fatura de Cartão', paymentMethod: 'Boleto', active: true },
  { id: 'r48', keyword: 'itaucard', matchType: 'contains', category: 'Fatura de Cartão', active: true },
  { id: 'r49', keyword: 'pgto fatura', matchType: 'contains', category: 'Fatura de Cartão', active: true },

  // Investimentos
  { id: 'r50', keyword: 'tesouro', matchType: 'contains', category: 'Investimentos', active: true },
  { id: 'r51', keyword: 'aplicacao', matchType: 'contains', category: 'Investimentos', active: true },
  { id: 'r52', keyword: 'cdb', matchType: 'contains', category: 'Investimentos', active: true },
];
