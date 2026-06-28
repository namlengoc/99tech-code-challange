# Problem 3 — WalletPage Explained

This file explains what was wrong in the original code, how we fixed it, and what we improved in `refactored.tsx`.

### 1. Missing `blockchain`

**Bug:** The code used `balance.blockchain` in filter/sort, but the interface did not include it.

**Fix:** Add `blockchain: string` to the interface.

---

### 2. Wrong variable `lhsPriority`

**Bug:** The filter used `lhsPriority`, but that variable was never defined.

**Fix:** Use the correct variable instead: `balancePriority = getPriority(balance.blockchain)`.

---

### 3. Filter condition

**Bug:** The code kept balances where `amount <= 0` and removed positive balances.

**Fix:** Keep only wallets with a **positive** balance: `balance.amount > 0`.

---

### 4. Incomplete sort

**Bug:** When two blockchains had the same priority, the comparator did not return `0`.

```ts
.sort((lhs: WalletBalance, rhs: WalletBalance) => {
  const leftPriority = getPriority(lhs.blockchain);
  const rightPriority = getPriority(rhs.blockchain);
  if (leftPriority > rightPriority) {
    return -1;
  } else if (rightPriority > leftPriority) {
    return 1;
  }
})
```

**Fix:**

```ts
getPriority(rhs.blockchain) - getPriority(lhs.blockchain)
```

This also returns `0` when priorities are equal.

---

### 5. Wrong `useMemo` dependency array

**Bug:** `useMemo` used `[balances, prices]`, but `prices` was not used inside that memo. The list was recalculated every time prices changed for no reason.

**Fix:** Use `[balances]` only for the filter/sort/format step.

---

### 6. Mapping the wrong array

**Bug:** JSX mapped over `sortedBalances`, which had no `formatted` field. The formatted data was stored in another array that was never rendered.

**Fix:** Map over `formattedBalances` (after filter → sort → map to add `formatted`).

```ts
const formattedBalances = useMemo(() => {
  return balances
    .filter((balance: WalletBalance) => {
      const priority = getPriority(balance.blockchain);
      return priority > -99 && balance.amount > 0;
    })
    .sort((lhs: WalletBalance, rhs: WalletBalance) => {
      return getPriority(rhs.blockchain) - getPriority(lhs.blockchain);
    })
    .map((balance: WalletBalance): FormattedWalletBalance => ({
      ...balance,
      formatted: balance.amount.toFixed(2),
    }));
}, [balances]);
```

---

## Additional fix: unstable React `key`

**Bug (original):** `key={index}` can cause wrong row updates when the list order changes.

**Fix:** Use a stable key instead:

```ts
key={`${balance.blockchain}-${balance.currency}`}
```

---

## Refactoring in `refactored.tsx`

| Area | Original / buggy | Refactored |
|------|------------------|------------|
| `getPriority` | Defined inside component (recreated every render) | Moved **outside** component |
| Priority lookup | `switch/case` inside render scope | `Record<string, number>` + `?? -99` |
| Pipeline | Split across multiple steps with wrong array mapped | Single `useMemo`: filter → sort → map |
| Filter | Nested `if` returning true/false | One boolean expression |
| Types | `any`, duplicated interface fields | Explicit `string` / `number`, `extends WalletBalance` |
| React `key` | `index` | `blockchain-currency` |
| Row rendering | Rebuilt every render | Wrapped in second `useMemo([formattedBalances, prices])` |

---

## Performance optimizations

### 1. Moved `getPriority` to outside. it just created once time 

### 2. Only run when `balances` changes

```ts
const formattedBalances = useMemo(() => {
  return balances
    .filter(...)
    .sort(...)
    .map(...);
}, [balances]);
```

### 3. Correct dependency arrays

- **First memo:** `[balances]` — `prices` is not used here.
- **Second memo:** `[formattedBalances, prices]` — USD value depends on live prices.

### 4. Avoids rebuild all `WalletRow`  when nothing changed.

```ts
const rows = useMemo(() => formattedBalances.map(...), [formattedBalances, prices]);
```


