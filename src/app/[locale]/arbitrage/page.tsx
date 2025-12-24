import ArbitrageApp from '@/shared/components/arbitrage/ArbitrageApp';

export const metadata = {
  title: 'Funding-rate Arbitrage',
};

export default function Page({ params }: { params: { locale: string } }) {
  // params.locale available for localization if needed
  return <ArbitrageApp />;
}



