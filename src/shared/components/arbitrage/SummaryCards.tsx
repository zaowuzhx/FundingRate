'use client';

import React from 'react';

type CardProps = { title: string; value: string };

function Card({ title, value }: CardProps) {
  return (
    <div className="bg-white shadow rounded p-4 min-w-[180px]">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-lg font-medium mt-1">{value}</div>
    </div>
  );
}

type Props = {
  totalPosition?: number;
  totalDaily?: number;
  totalMonthly?: number;
  totalYearly?: number;
  combinedAnnualRate?: number;
};

export default function SummaryCards({
  totalPosition,
  totalDaily,
  totalMonthly,
  totalYearly,
  combinedAnnualRate,
}: Props) {
  const fmt = (n?: number, suffix = '') => {
    if (n === undefined || n === null || isNaN(n)) return `— ${suffix}`.trim();
    if (Math.abs(n) >= 1000) return `${n.toFixed(0)} ${suffix}`.trim();
    return `${n.toFixed(3)} ${suffix}`.trim();
  };

  return (
    <div className="flex gap-4 mb-4">
      <Card title="总持仓金额" value={fmt(totalPosition, 'USDT')} />
      <Card title="日收益总和" value={fmt(totalDaily, 'USD')} />
      <Card title="月收益总和" value={fmt(totalMonthly, 'USD')} />
      <Card title="综合年化收益率" value={combinedAnnualRate != null && !isNaN(combinedAnnualRate) ? `${(combinedAnnualRate * 100).toFixed(4)}%` : '— %'} />
    </div>
  );
}


