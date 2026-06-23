import { create } from 'zustand';
import { formatCurrency as formatCurrencyUtil } from '@/lib/utils';

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

interface CurrencyState {
  displayCurrency: CurrencyCode;
  rates: Record<string, number>;
  ratesLoaded: boolean;
  setDisplayCurrency: (code: CurrencyCode) => void;
  loadRates: () => Promise<void>;
  convert: (amount: number, from?: string) => number;
  formatConverted: (amount: number, from?: string) => string;
}

function getInitialCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem('preferred_currency');
    if (saved && SUPPORTED_CURRENCIES.some(c => c.code === saved)) return saved as CurrencyCode;
  } catch {}
  return 'USD';
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, AUD: 1.54, CAD: 1.36, JPY: 149.50, CNY: 7.24, INR: 83.50, BRL: 5.05,
};

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  displayCurrency: getInitialCurrency(),
  rates: {},
  ratesLoaded: false,

  setDisplayCurrency: (code: CurrencyCode) => {
    localStorage.setItem('preferred_currency', code);
    set({ displayCurrency: code });
  },

  loadRates: async () => {
    try {
      const { currency } = await import('./client');
      const data = await currency.rates();
      set({ rates: data.rates, ratesLoaded: true });
    } catch {
      set({ rates: FALLBACK_RATES, ratesLoaded: true });
    }
  },

  convert: (amount: number, from = 'USD') => {
    const { displayCurrency, rates } = get();
    const rateFrom = from === 'USD' ? 1 : rates[from];
    const rateTo = displayCurrency === 'USD' ? 1 : rates[displayCurrency];
    if (!rateFrom || !rateTo) return amount;
    return Math.round((amount / rateFrom) * rateTo * 100) / 100;
  },

  formatConverted: (amount: number, from = 'USD') => {
    const { displayCurrency, rates } = get();
    const rateFrom = from === 'USD' ? 1 : rates[from];
    const rateTo = displayCurrency === 'USD' ? 1 : rates[displayCurrency];
    if (!rateFrom || !rateTo) return formatCurrencyUtil(amount, displayCurrency);
    const converted = Math.round((amount / rateFrom) * rateTo * 100) / 100;
    return formatCurrencyUtil(converted, displayCurrency);
  },
}));