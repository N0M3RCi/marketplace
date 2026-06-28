import QRCode from 'qrcode';

const qrCache = new Map<string, string>();

export async function generateQR(text: string): Promise<string> {
  const cached = qrCache.get(text);
  if (cached) return cached;

  try {
    const url = await QRCode.toDataURL(text, {
      width: 200,
      margin: 2,
      color: {
        dark: '#1A1000',
        light: '#FFFFFF',
      },
    });
    qrCache.set(text, url);
    return url;
  } catch {
    return '';
  }
}

export function clearQRCache() {
  qrCache.clear();
}

export const CRYPTO_NETWORKS = [
  { value: 'BTC', label: 'Bitcoin', symbol: '₿' },
  { value: 'USDT-ERC20', label: 'USDT (ERC-20)', symbol: '₮' },
  { value: 'USDT-TRC20', label: 'USDT (TRC-20)', symbol: '₮' },
  { value: 'USDC-ERC20', label: 'USDC (ERC-20)', symbol: '₮' },
  { value: 'ETH', label: 'Ethereum', symbol: 'Ξ' },
  { value: 'SOL', label: 'Solana', symbol: '◎' },
] as const;

export function getNetworkSymbol(network: string): string {
  const found = CRYPTO_NETWORKS.find(n => n.value === network);
  return found?.symbol || '₿';
}