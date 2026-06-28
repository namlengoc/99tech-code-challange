import {
  fetchPrices,
  getToken,
  convertAmount,
  formatDirectRate,
  formatNumber,
  formatInputAmount,
  parseAmountInput,
  getDisplayName,
} from './prices.js';
import {
  loadPortfolio,
  getBalance,
  executeSwap,
  getPortfolioEntries,
} from './portfolio.js';
import { getTheme, toggleTheme, initTheme } from './theme.js';
import { t } from './lang/index.js';

const CHEVRON_SVG = `<svg class="chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SWAP_ARROW_SVG = `<svg class="swap-arrow-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const state = {
  tokens: [],
  portfolio: {},
  spendCurrency: 'USD',
  receiveCurrency: 'WBTC',
  spendAmount: '',
  receiveAmount: '',
  activeInput: 'spend',
  spendError: '',
  isSubmitting: false,
  successMessage: '',
  pickerTarget: null,
  pickerQuery: '',
  portfolioQuery: '',
};

const app = document.getElementById('app');

function themeToggleHtml() {
  const theme = getTheme();
  const icon = theme === 'dark' ? SUN_SVG : MOON_SVG;
  return `
    <button
      type="button"
      class="theme-toggle"
      data-action="toggle-theme"
      aria-label="${t(`theme.switchTo${theme === 'dark' ? 'Light' : 'Dark'}`)}"
    >${icon}</button>
  `;
}

function updateThemeToggle() {
  const btn = document.querySelector('[data-action="toggle-theme"]');
  if (!btn) return;

  const theme = getTheme();
  btn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
  btn.setAttribute('aria-label', t(`theme.switchTo${theme === 'dark' ? 'Light' : 'Dark'}`));
}

function tokenIconHtml(token, className = 'token-icon') {
  if (!token) return `<span class="${className} fallback">?</span>`;
  return `<img class="${className}" src="${token.iconUrl}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${className} fallback',textContent:'${token.displayName.slice(0, 2)}'}))" />`;
}

function resetAmounts() {
  state.spendAmount = '';
  state.receiveAmount = '';
  state.spendError = '';
  state.activeInput = 'spend';
}

function validateRawAmount(raw) {
  const normalized = parseAmountInput(raw);

  if (!normalized) return true;

  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.') {
    state.spendError = t('validation.invalidNumber');
    return false;
  }

  const value = Number(normalized);
  if (normalized && value <= 0) {
    state.spendError = t('validation.amountPositive');
    return false;
  }

  if (value > 1_000_000_000) {
    state.spendError = t('validation.amountTooLarge');
    return false;
  }

  const decimals = normalized.includes('.') ? normalized.split('.')[1].length : 0;
  if (decimals > 8) {
    state.spendError = t('validation.maxDecimals');
    return false;
  }

  return true;
}

function checkBalance(spend) {
  if (state.spendCurrency === state.receiveCurrency) {
    state.spendError = t('validation.differentCurrencies');
    return false;
  }

  const balance = getBalance(state.portfolio, state.spendCurrency);
  if (spend > balance) {
    const label = getDisplayName(state.spendCurrency);
    state.spendError = t('validation.insufficientBalance', {
      label,
      balance: formatNumber(balance),
    });
    return false;
  }

  state.spendError = '';
  return true;
}

function syncFromSpend() {
  const raw = parseAmountInput(state.spendAmount);

  if (!raw) {
    state.receiveAmount = '';
    state.spendError = '';
    return;
  }

  if (!validateRawAmount(state.spendAmount)) {
    state.receiveAmount = '';
    return;
  }

  const spend = Number(raw);
  const converted = convertAmount(spend, state.spendCurrency, state.receiveCurrency);
  state.receiveAmount = formatNumber(converted);
  checkBalance(spend);
}

function syncFromReceive() {
  const raw = parseAmountInput(state.receiveAmount);

  if (!raw) {
    state.spendAmount = '';
    state.spendError = '';
    return;
  }

  if (!validateRawAmount(state.receiveAmount)) {
    state.spendAmount = '';
    return;
  }

  const receive = Number(raw);
  const converted = convertAmount(receive, state.receiveCurrency, state.spendCurrency);
  state.spendAmount = formatNumber(converted);
  checkBalance(converted);
}

function getTradeAmounts() {
  const spendRaw = parseAmountInput(state.spendAmount);
  const receiveRaw = parseAmountInput(state.receiveAmount);

  if (!spendRaw && !receiveRaw) return null;

  const isValid = (raw) =>
    /^\d*\.?\d+$/.test(raw) && raw !== '.' && Number(raw) > 0 && Number(raw) <= 1_000_000_000;

  if (state.activeInput === 'receive' && receiveRaw && isValid(receiveRaw)) {
    const receive = Number(receiveRaw);
    const spend = convertAmount(receive, state.receiveCurrency, state.spendCurrency);
    return { spend, receive };
  }

  if (spendRaw && isValid(spendRaw)) {
    const spend = Number(spendRaw);
    const receive = convertAmount(spend, state.spendCurrency, state.receiveCurrency);
    return { spend, receive };
  }

  return null;
}

function getSpendableTokens() {
  return getPortfolioEntries(state.portfolio)
    .map(([currency, amount]) => {
      const token = state.tokens.find((t) => t.currency === currency);
      if (!token || amount <= 0) return null;
      return { ...token, balance: amount };
    })
    .filter(Boolean)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function getReceivableTokens() {
  return state.tokens.filter((t) => t.currency !== state.spendCurrency);
}

function getFilteredPickerTokens() {
  const query = state.pickerQuery.trim().toLowerCase();
  const pool =
    state.pickerTarget === 'spend' ? getSpendableTokens() : getReceivableTokens();

  if (!query) return pool;

  return pool.filter((token) => {
    const haystack = `${token.currency} ${token.displayName}`.toLowerCase();
    return haystack.includes(query);
  });
}

function ensureValidCurrencies() {
  const spendable = getSpendableTokens();

  if (!spendable.length) return;

  if (!spendable.some((t) => t.currency === state.spendCurrency)) {
    state.spendCurrency = spendable[0].currency;
  }

  const receivable = getReceivableTokens();
  if (!receivable.some((t) => t.currency === state.receiveCurrency)) {
    state.receiveCurrency = receivable[0]?.currency ?? state.receiveCurrency;
  }
}

function applySwapDefaults() {
  const spendable = getSpendableTokens();

  if (!spendable.length) {
    resetAmounts();
    state.successMessage = '';
    return;
  }

  state.spendCurrency =
    spendable.find((t) => t.currency === 'USD')?.currency ?? spendable[0].currency;

  const receivable = state.tokens.filter((t) => t.currency !== state.spendCurrency);
  state.receiveCurrency =
    receivable.find((t) => t.currency === 'WBTC')?.currency ?? receivable[0]?.currency;

  resetAmounts();
  state.successMessage = '';
}

function isActionDisabled() {
  if (state.isSubmitting) return true;
  if (state.spendError) return true;

  const amounts = getTradeAmounts();
  if (!amounts || amounts.spend <= 0 || amounts.receive <= 0) return true;

  const balance = getBalance(state.portfolio, state.spendCurrency);
  return amounts.spend > balance || state.spendCurrency === state.receiveCurrency;
}

function patchPassiveAmountField() {
  const spendInput = document.getElementById('spend-input');
  const receiveInput = document.getElementById('receive-input');

  if (spendInput && document.activeElement !== spendInput) {
    spendInput.value = state.spendAmount;
  }
  if (receiveInput && document.activeElement !== receiveInput) {
    receiveInput.value = state.receiveAmount;
  }
}

function updateFormUI() {
  const errorEl = document.querySelector('.error-message');
  const submitBtn = document.querySelector('[data-action="submit"]');
  const spendField = document.getElementById('spend-input')?.closest('.amount-field');
  const spendRateEl = document.querySelector('[data-meta="spend-rate"]');
  const rateEl = document.querySelector('[data-meta="receive-rate"]');

  if (errorEl) errorEl.textContent = state.spendError;
  if (submitBtn) submitBtn.disabled = isActionDisabled();
  if (spendField) spendField.classList.toggle('error', Boolean(state.spendError));
  if (spendRateEl) {
    spendRateEl.textContent = formatDirectRate(state.spendCurrency, state.receiveCurrency);
  }
  if (rateEl) {
    rateEl.textContent = formatDirectRate(state.receiveCurrency, state.spendCurrency);
  }
}

function getCursorAfterFormat(formatted, digitsBeforeCursor) {
  if (digitsBeforeCursor <= 0) return 0;

  let digitsSeen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ',') {
      digitsSeen++;
      if (digitsSeen === digitsBeforeCursor) return i + 1;
    }
  }
  return formatted.length;
}

function handleAmountInput(input, field) {
  const cursor = input.selectionStart ?? 0;
  const digitsBefore = parseAmountInput(input.value.slice(0, cursor)).length;
  const formatted = formatInputAmount(input.value);

  if (field === 'spend') {
    state.spendAmount = formatted;
    state.activeInput = 'spend';
  } else {
    state.receiveAmount = formatted;
    state.activeInput = 'receive';
  }

  state.successMessage = '';
  document.querySelector('.success-banner')?.remove();

  input.value = formatted;
  const newCursor = getCursorAfterFormat(formatted, digitsBefore);
  input.setSelectionRange(newCursor, newCursor);

  if (field === 'spend') syncFromSpend();
  else syncFromReceive();

  patchPassiveAmountField();
  updateFormUI();
}

function blockInvalidAmountKeys(event) {
  if (event.key === '-' || event.key === '+' || event.key === 'e' || event.key === 'E') {
    event.preventDefault();
  }
}

function bindInputHandlers() {
  const spendInput = document.getElementById('spend-input');
  const receiveInput = document.getElementById('receive-input');
  const spendField = spendInput?.closest('.amount-field');
  const receiveField = receiveInput?.closest('.amount-field');

  spendInput?.addEventListener('keydown', blockInvalidAmountKeys);
  receiveInput?.addEventListener('keydown', blockInvalidAmountKeys);

  spendInput?.addEventListener('input', (event) => {
    handleAmountInput(event.target, 'spend');
  });

  receiveInput?.addEventListener('input', (event) => {
    handleAmountInput(event.target, 'receive');
  });

  spendInput?.addEventListener('focus', () => {
    spendField?.classList.add('focused');
    receiveField?.classList.remove('focused');
  });

  receiveInput?.addEventListener('focus', () => {
    receiveField?.classList.add('focused');
    spendField?.classList.remove('focused');
  });

  spendInput?.addEventListener('blur', () => spendField?.classList.remove('focused'));
  receiveInput?.addEventListener('blur', () => receiveField?.classList.remove('focused'));
}

function bindPortfolioSearch() {
  const searchInput = document.querySelector('[data-action="portfolio-search"]');
  searchInput?.addEventListener('input', (event) => {
    const input = event.target;
    const cursor = input.selectionStart ?? 0;
    state.portfolioQuery = input.value;
    patchPortfolioList();
    input.focus();
    input.setSelectionRange(cursor, cursor);
  });
}

function sortPortfolioEntries(entries) {
  return [...entries].sort(([currencyA], [currencyB]) => {
    const labelA = getDisplayName(currencyA);
    const labelB = getDisplayName(currencyB);
    return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
  });
}

function getFilteredPortfolioEntries() {
  const entries = sortPortfolioEntries(getPortfolioEntries(state.portfolio));
  const query = state.portfolioQuery.trim().toLowerCase();

  if (!query) return entries;

  return entries.filter(([currency]) => {
    const token = getToken(currency);
    const haystack = `${currency} ${token?.displayName ?? ''}`.toLowerCase();
    return haystack.includes(query);
  });
}

function renderPortfolioRows(entries) {
  return entries
    .map(([currency, amount]) => {
      const token = getToken(currency);
      const usdValue = token ? amount * token.price : 0;

      return `
        <div class="portfolio-row">
          ${tokenIconHtml(token)}
          <div class="portfolio-meta">
            <div class="portfolio-name">${token?.displayName ?? currency}</div>
            <div class="portfolio-balance">${formatNumber(amount)} ${token?.displayName ?? currency}</div>
          </div>
          <div class="portfolio-value">${t('portfolio.valueApprox', { value: formatNumber(usdValue, 2) })}</div>
        </div>
      `;
    })
    .join('');
}

function patchPortfolioList() {
  const list = document.querySelector('.portfolio-list');
  const emptyEl = document.querySelector('[data-portfolio-empty]');
  if (!list) return;

  const entries = getFilteredPortfolioEntries();
  const hasAssets = getPortfolioEntries(state.portfolio).length > 0;

  if (!hasAssets) return;

  if (!entries.length) {
    list.innerHTML = '';
    if (emptyEl) {
      emptyEl.textContent = t('portfolio.noMatch');
      emptyEl.hidden = false;
    }
    return;
  }

  list.innerHTML = renderPortfolioRows(entries);
  if (emptyEl) emptyEl.hidden = true;
}

function renderPortfolio() {
  const entries = getPortfolioEntries(state.portfolio);

  if (!entries.length) {
    return `
      <div class="portfolio-card">
        <div class="portfolio-header">
          <h3 class="portfolio-title">${t('portfolio.title')}</h3>
        </div>
        <p class="portfolio-empty">${t('portfolio.empty')}</p>
      </div>
    `;
  }

  const filtered = getFilteredPortfolioEntries();

  return `
    <div class="portfolio-card">
      <div class="portfolio-header">
        <h3 class="portfolio-title">${t('portfolio.title')}</h3>
        <input
          type="search"
          class="portfolio-search"
          placeholder="${t('portfolio.searchPlaceholder')}"
          value="${state.portfolioQuery}"
          data-action="portfolio-search"
          aria-label="${t('portfolio.searchAriaLabel')}"
        />
      </div>
      <p class="portfolio-empty" data-portfolio-empty ${filtered.length ? 'hidden' : ''}>${t('portfolio.noMatch')}</p>
      <div class="portfolio-list">${renderPortfolioRows(filtered)}</div>
    </div>
  `;
}

function renderTokenPicker() {
  if (!state.pickerTarget) return '';

  const selected =
    state.pickerTarget === 'spend' ? state.spendCurrency : state.receiveCurrency;
  const filtered = getFilteredPickerTokens();
  const emptyMessage =
    state.pickerTarget === 'spend'
      ? t('picker.noPortfolioAssets')
      : t('picker.noTokens');

  return `
    <div class="modal-overlay" data-action="close-picker">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${t('picker.ariaLabel')}">
        <div class="modal-header">
          <h3>${state.pickerTarget === 'spend' ? t('picker.spendTitle') : t('picker.receiveTitle')}</h3>
          <button type="button" class="modal-close" data-action="close-picker" aria-label="${t('common.close')}">&times;</button>
        </div>
        <div class="modal-search">
          <input
            type="search"
            placeholder="${t('picker.searchPlaceholder')}"
            value="${state.pickerQuery}"
            data-action="picker-search"
            autofocus
          />
        </div>
        <div class="token-list">
          ${
            filtered.length
              ? filtered
                  .map(
                    (token) => `
              <button
                type="button"
                class="token-option ${token.currency === selected ? 'selected' : ''}"
                data-action="pick-token"
                data-currency="${token.currency}"
              >
                ${tokenIconHtml(token)}
                <span class="token-meta">
                  <div class="token-name">${token.displayName}</div>
                  <div class="token-price">${
                    state.pickerTarget === 'spend' && token.balance != null
                      ? t('picker.balanceAvailable', { amount: formatNumber(token.balance) })
                      : `$${formatNumber(token.price, 4)}`
                  }</div>
                </span>
              </button>
            `,
                  )
                  .join('')
              : `<p style="padding:16px;color:var(--text-secondary);text-align:center;">${emptyMessage}</p>`
          }
        </div>
      </div>
    </div>
  `;
}

function render() {
  const spendToken = getToken(state.spendCurrency);
  const receiveToken = getToken(state.receiveCurrency);

  app.innerHTML = `
    <div class="swap-card">
      <div class="swap-header">
        <h2 class="swap-title">${t('swap.title')}</h2>
        ${themeToggleHtml()}
      </div>

      <div class="swap-body">
        <div class="amount-field ${state.spendError ? 'error' : ''}">
          <div class="amount-header">
            <label class="amount-label" for="spend-input">${t('swap.spend')}</label>
            <span class="amount-meta" data-meta="spend-rate">${formatDirectRate(state.spendCurrency, state.receiveCurrency)}</span>
          </div>
          <div class="amount-row">
            <input
              id="spend-input"
              class="amount-input"
              type="text"
              inputmode="decimal"
              placeholder="${t('swap.enterAmount')}"
              value="${state.spendAmount}"
              autocomplete="off"
            />
            <button type="button" class="token-select" data-action="open-picker" data-target="spend">
              ${tokenIconHtml(spendToken)}
              <span>${spendToken?.displayName ?? t('swap.emptyToken')}</span>
              ${CHEVRON_SVG}
            </button>
          </div>
        </div>

        <div class="swap-arrow" aria-hidden="true">
          ${SWAP_ARROW_SVG}
        </div>

        <div class="amount-field">
          <div class="amount-header">
            <label class="amount-label" for="receive-input">${t('swap.receive')}</label>
            <span class="amount-meta" data-meta="receive-rate">${formatDirectRate(state.receiveCurrency, state.spendCurrency)}</span>
          </div>
          <div class="amount-row">
            <input
              id="receive-input"
              class="amount-input"
              type="text"
              inputmode="decimal"
              placeholder="${t('swap.enterAmount')}"
              value="${state.receiveAmount}"
              autocomplete="off"
            />
            <button type="button" class="token-select" data-action="open-picker" data-target="receive">
              ${tokenIconHtml(receiveToken)}
              <span>${receiveToken?.displayName ?? t('swap.emptyToken')}</span>
              ${CHEVRON_SVG}
            </button>
          </div>
        </div>

        <p class="error-message" role="alert">${state.spendError}</p>

        <button
          type="button"
          class="swap-action ${state.isSubmitting ? 'loading' : ''}"
          ${isActionDisabled() ? 'disabled' : ''}
          data-action="submit"
        >${t('swap.submit')}</button>

        ${
          state.successMessage
            ? `<div class="success-banner" role="status">${state.successMessage}</div>`
            : ''
        }
      </div>
    </div>
    ${renderPortfolio()}
    ${renderTokenPicker()}
  `;

  bindInputHandlers();
  bindPortfolioSearch();

  const pickerSearch = document.querySelector('[data-action="picker-search"]');
  pickerSearch?.addEventListener('input', (event) => {
    const input = event.target;
    const cursor = input.selectionStart;
    state.pickerQuery = input.value;
    const modal = input.closest('.modal');
    const listHtml = renderTokenPickerList();
    const list = modal?.querySelector('.token-list');
    if (list) list.innerHTML = listHtml;
    input.focus();
    input.setSelectionRange(cursor, cursor);
  });
}

function renderTokenPickerList() {
  const selected =
    state.pickerTarget === 'spend' ? state.spendCurrency : state.receiveCurrency;
  const filtered = getFilteredPickerTokens();
  const emptyMessage =
    state.pickerTarget === 'spend'
      ? t('picker.noPortfolioAssets')
      : t('picker.noTokens');

  if (!filtered.length) {
    return `<p style="padding:16px;color:var(--text-secondary);text-align:center;">${emptyMessage}</p>`;
  }

  return filtered
    .map(
      (token) => `
        <button
          type="button"
          class="token-option ${token.currency === selected ? 'selected' : ''}"
          data-action="pick-token"
          data-currency="${token.currency}"
        >
          ${tokenIconHtml(token)}
          <span class="token-meta">
            <div class="token-name">${token.displayName}</div>
            <div class="token-price">${
              state.pickerTarget === 'spend' && token.balance != null
                ? t('picker.balanceAvailable', { amount: formatNumber(token.balance) })
                : `$${formatNumber(token.price, 4)}`
            }</div>
          </span>
        </button>
      `,
    )
    .join('');
}

function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  if (action === 'toggle-theme') {
    toggleTheme();
    updateThemeToggle();
    return;
  }

  if (action === 'open-picker') {
    state.pickerTarget = target.dataset.target;
    state.pickerQuery = '';
    render();
    return;
  }

  if (action === 'close-picker') {
    if (event.target === target || target.dataset.action === 'close-picker') {
      state.pickerTarget = null;
      state.pickerQuery = '';
      render();
    }
    return;
  }

  if (action === 'pick-token') {
    const currency = target.dataset.currency;
    const previousSpend = state.spendCurrency;
    const previousReceive = state.receiveCurrency;

    if (state.pickerTarget === 'spend') {
      state.spendCurrency = currency;
      if (state.spendCurrency === state.receiveCurrency) {
        const alternative = getReceivableTokens().find((t) => t.currency !== currency);
        if (alternative) state.receiveCurrency = alternative.currency;
      }
    } else {
      state.receiveCurrency = currency;
      if (state.receiveCurrency === state.spendCurrency) {
        const alternative = getSpendableTokens().find((t) => t.currency !== currency);
        if (alternative) state.spendCurrency = alternative.currency;
      }
    }

    if (
      state.spendCurrency !== previousSpend ||
      state.receiveCurrency !== previousReceive
    ) {
      resetAmounts();
    }

    state.pickerTarget = null;
    state.pickerQuery = '';
    render();
    return;
  }

  if (action === 'submit') {
    const amounts = getTradeAmounts();
    if (!amounts || !checkBalance(amounts.spend)) {
      updateFormUI();
      return;
    }

    const { spend: spendValue, receive: receiveValue } = amounts;

    state.isSubmitting = true;
    state.successMessage = '';
    render();

    window.setTimeout(() => {
      state.portfolio = executeSwap(
        state.portfolio,
        state.spendCurrency,
        spendValue,
        state.receiveCurrency,
        receiveValue,
      );

      const spendLabel = getDisplayName(state.spendCurrency);
      const receiveLabel = getDisplayName(state.receiveCurrency);
      state.isSubmitting = false;
      resetAmounts();
      ensureValidCurrencies();
      state.successMessage = t('success.swapped', {
        spendAmount: formatNumber(spendValue),
        spendLabel,
        receiveAmount: formatNumber(receiveValue),
        receiveLabel,
      });
      render();
    }, 1200);
    return;
  }
}

async function init() {
  initTheme();
  document.title = t('app.title');

  app.innerHTML = `
    <div class="swap-card loading-screen">
      <div class="spinner" aria-hidden="true"></div>
      <p>${t('loading.prices')}</p>
    </div>
  `;

  try {
    state.tokens = await fetchPrices();

    const hasUsd = state.tokens.some((t) => t.currency === 'USD');
    const hasBtc = state.tokens.some((t) => t.currency === 'WBTC');
    if (!hasUsd || !hasBtc) {
      throw new Error('Required tokens missing');
    }

    state.portfolio = loadPortfolio();
    applySwapDefaults();
    ensureValidCurrencies();
    render();
    app.addEventListener('click', handleClick);
  } catch {
    app.innerHTML = `
      <div class="swap-card loading-screen">
        <p>${t('loading.error')}</p>
      </div>
    `;
  }
}

init();
