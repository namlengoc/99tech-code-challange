import { t } from './lang/index.js';

const PRICES_URL = 'https://interview.switcheo.com/prices.json';
const ICON_BASE =
  'https://raw.githubusercontent.com/Switcheo/token-icons/main/tokens';

const ICON_ALIASES = {
  USD: 'USDC',
  WBTC: 'BTC',
  bNEO: 'NEO',
  rSWTH: 'SWTH',
  ampLUNA: 'LUNA',
  STLUNA: 'LUNA',
  STATOM: 'ATOM',
  STEVMOS: 'EVMOS',
  wstETH: 'ETH',
  axlUSDC: 'USDC',
  YieldUSD: 'USDC',
  BUSD: 'USDC',
  USC: 'USDC',
};

const DISPLAY_NAMES = {
  WBTC: 'BTC',
};

/** @type {Map<string, { currency: string, price: number, date: string }>} */
let priceMap = new Map();

export function getTokenIconUrl(currency) {
  const iconName = ICON_ALIASES[currency] ?? currency;
  return `${ICON_BASE}/${iconName}.svg`;
}

export function getDisplayName(currency) {
  return DISPLAY_NAMES[currency] ?? currency;
}

export async function fetchPrices() {
  const response = await fetch(PRICES_URL);
  if (!response.ok) {
    throw new Error('Failed to load prices');
  }

  const entries = await response.json();
  priceMap = new Map();

  for (const entry of entries) {
    const existing = priceMap.get(entry.currency);
    if (!existing || new Date(entry.date) > new Date(existing.date)) {
      priceMap.set(entry.currency, {
        currency: entry.currency,
        price: entry.price,
        date: entry.date,
      });
    }
  }

  return getTokens();
}

export function getTokens() {
  return [...priceMap.values()]
    .map((token) => ({
      ...token,
      displayName: getDisplayName(token.currency),
      iconUrl: getTokenIconUrl(token.currency),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getToken(currency) {
  const token = priceMap.get(currency);
  if (!token) return null;
  return {
    ...token,
    displayName: getDisplayName(token.currency),
    iconUrl: getTokenIconUrl(token.currency),
  };
}

/** Convert token amount to USD (all API prices are USD-denominated per unit). */
export function toUsd(amount, currency) {
  const token = priceMap.get(currency);
  if (!token || !amount) return 0;
  return amount * token.price;
}

/** Convert USD value to token amount. */
export function fromUsd(usdAmount, currency) {
  const token = priceMap.get(currency);
  if (!token || !usdAmount) return 0;
  return usdAmount / token.price;
}

/**
 * Cross-rate via USD: from → USD → to
 * e.g. ETH→ATOM: (eth × ethPrice) ÷ atomPrice
 */
export function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;
  const usdValue = toUsd(amount, fromCurrency);
  return fromUsd(usdValue, toCurrency);
}

export function formatDirectRate(fromCurrency, toCurrency) {
  const from = priceMap.get(fromCurrency);
  const to = priceMap.get(toCurrency);
  if (!from || !to) return '';

  const rate = convertAmount(1, fromCurrency, toCurrency);
  const fromLabel = getDisplayName(fromCurrency);
  const toLabel = getDisplayName(toCurrency);

  return t('rate.direct', {
    from: fromLabel,
    rate: formatNumber(rate, 8),
    to: toLabel,
  });
}

export function formatRate(fromCurrency, toCurrency) {
  return formatDirectRate(fromCurrency, toCurrency);
}

export function parseAmountInput(value) {
  if (!value) return '';

  let normalized = String(value).replace(/,/g, '').trim();
  normalized = normalized.replace(/[^\d.]/g, '');

  const dotIndex = normalized.indexOf('.');
  if (dotIndex !== -1) {
    normalized =
      normalized.slice(0, dotIndex + 1) + normalized.slice(dotIndex + 1).replace(/\./g, '');
  }

  return normalized;
}

/** Format amount while typing (thousand separators, preserves decimals). */
export function formatInputAmount(value) {
  const normalized = parseAmountInput(value);
  if (!normalized) return '';

  const match = normalized.match(/^(\d*)(\.\d*)?$/);
  if (!match) return normalized;

  const [, intPart, decPart = ''] = match;
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formattedInt + decPart;
}

export function formatNumber(value, maxDecimals = 8) {
  if (!Number.isFinite(value) || value === 0) return '0';

  const abs = Math.abs(value);
  let decimals = maxDecimals;
  if (abs >= 1000) decimals = 2;
  else if (abs >= 1) decimals = 6;
  else if (abs >= 0.01) decimals = 8;
  else decimals = 10;

  return value
    .toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    })
    .replace(/\.?0+$/, (match) => (match.startsWith('.') ? '' : match));
}
