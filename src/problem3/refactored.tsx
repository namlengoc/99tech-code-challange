import React, { useMemo } from 'react';

interface WalletBalance {
  blockchain: string;
  currency: string;
  amount: number;
}

interface FormattedWalletBalance extends WalletBalance {
  formatted: string;
}

interface Props extends BoxProps {}

// Provided by the original template (design system):
// BoxProps, useWalletBalances, usePrices, WalletRow, classes

// Moved outside the component to avoid re-creating on every render
const BLOCKCHAIN_PRIORITIES: Record<string, number> = {
  Osmosis: 100,
  Ethereum: 50,
  Arbitrum: 30,
  Zilliqa: 20,
  Neo: 20,
};

const getPriority = (blockchain: string): number => {
  return BLOCKCHAIN_PRIORITIES[blockchain] ?? -99;
};

const WalletPage: React.FC<Props> = (props: Props) => {
  const { children, ...rest } = props;
  const balances = useWalletBalances();
  const prices = usePrices();

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

  const rows = useMemo(() => {
    return formattedBalances.map((balance: FormattedWalletBalance) => {
      const usdPrice = prices[balance.currency] ?? 0;
      const usdValue = usdPrice * balance.amount;

      return (
        <WalletRow
          className={classes.row}
          key={`${balance.blockchain}-${balance.currency}`}
          amount={balance.amount}
          usdValue={usdValue}
          formattedAmount={balance.formatted}
        />
      );
    });
  }, [formattedBalances, prices]);

  return (
    <div {...rest}>
      {rows}
      {children}
    </div>
  );
};

export default WalletPage;