# 99Tech Code Challenge

Solutions for Problems 1–3.

---

# Problem 1

## Solution: [sum_to_n.js](src/problem1/sum_to_n.js)

Example:

```
sum_to_n_a(100) // 5050
sum_to_n_b(100) // 5050
sum_to_n_c(100) // 5050
```

---

# Problem 2

## Solution: [problem2](src/problem2)

## Try it out: [code-challenge.meetutor.com](https://code-challenge.meetutor.com/)

## Tech Stack

* Vite
* Vanilla JavaScript
* CSS (dark / light theme)

## Features

* Crypto swap UI (Spend / Receive) with live rates from [Switcheo prices API](https://interview.switcheo.com/prices.json)
* Bidirectional amount conversion
* Portfolio stored in `localStorage` with search and scroll
* Token picker modal
* Dark / light theme toggle
* i18n via [lang/en.js](src/problem2/lang/en.js)

## Run locally

```bash
cd src/problem2
npm install
npm run dev
```

Build for production:

```bash
npm run build
# output: dist/
```

---

# Problem 3

## Solution: [explain.md](src/problem3/explain.md)

## Code: [refactored.tsx](src/problem3/refactored.tsx)

Fixes bugs in the original `WalletPage` component:

1. Missing `blockchain` in interface
2. Undefined variable `lhsPriority`
3. Inverted filter (`amount <= 0` instead of `> 0`)
4. Incomplete sort comparator (missing `return 0`)
5. Wrong `useMemo` deps (`prices` unused in first memo)
6. Mapped wrong array (`sortedBalances` vs `formattedBalances`)

Also fixes unstable React `key` (`index` → `blockchain-currency`) and refactors for performance (`getPriority` hoisted, single filter→sort→format pipeline, correct memo deps).
