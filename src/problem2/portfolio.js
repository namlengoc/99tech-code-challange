const STORAGE_KEY = 'problem2_portfolio';
const DEFAULT_BALANCE = { USD: 100000 };

function roundAmount(value) {
  return Math.round(value * 1e8) / 1e8;
}

export function loadPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = { ...DEFAULT_BALANCE };
      savePortfolio(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid portfolio');
    }
    return parsed;
  } catch {
    const initial = { ...DEFAULT_BALANCE };
    savePortfolio(initial);
    return initial;
  }
}

export function savePortfolio(portfolio) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
}

export function getBalance(portfolio, currency) {
  return portfolio[currency] ?? 0;
}

export function executeSwap(portfolio, spendCurrency, spendAmount, receiveCurrency, receiveAmount) {
  const next = { ...portfolio };

  next[spendCurrency] = roundAmount(getBalance(next, spendCurrency) - spendAmount);
  next[receiveCurrency] = roundAmount(getBalance(next, receiveCurrency) + receiveAmount);

  for (const key of Object.keys(next)) {
    if (next[key] <= 0) delete next[key];
  }

  savePortfolio(next);
  return next;
}

export function getPortfolioEntries(portfolio) {
  return Object.entries(portfolio)
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => a.localeCompare(b));
}
