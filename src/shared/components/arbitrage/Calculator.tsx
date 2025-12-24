'use client';

import React, { useState } from 'react';

export default function Calculator() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [openPrice, setOpenPrice] = useState<number | ''>('');
  const [closePrice, setClosePrice] = useState<number | ''>('');
  const [amountUsdt, setAmountUsdt] = useState<number | ''>(500);

  const [result, setResult] = useState<{ profit?: number; roi?: number; annual?: number } | null>(null);

  function calc() {
    if (!openPrice || !closePrice || !amountUsdt) return;
    const open = Number(openPrice);
    const close = Number(closePrice);
    const principal = Number(amountUsdt);
    const pnlPerUnit = direction === 'long' ? close - open : open - close;
    const profit = pnlPerUnit * (principal / open);
    const roi = (profit / principal) * 100;
    // naive annualization assuming 30 days holding for demo
    const annual = roi * (365 / 30);
    setResult({ profit, roi, annual });
  }

  return (
    <section>
      <div className="bg-white border rounded p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm">交易对 (SYMBOL)</label>
            <input className="mt-1 border px-2 py-2 w-full" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">开仓方向</label>
            <select className="mt-1 border px-2 py-2 w-full" value={direction} onChange={(e) => setDirection(e.target.value as any)}>
              <option value="long">多头 (Long)</option>
              <option value="short">空头 (Short)</option>
            </select>
          </div>
          <div>
            <label className="text-sm">开仓价格 (USD)</label>
            <input className="mt-1 border px-2 py-2 w-full" value={openPrice} onChange={(e) => setOpenPrice(e.target.value ? Number(e.target.value) : '')} />
          </div>

          <div>
            <label className="text-sm">平仓价格 (USD)</label>
            <input className="mt-1 border px-2 py-2 w-full" value={closePrice} onChange={(e) => setClosePrice(e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div>
            <label className="text-sm">开仓数量 (USDT 值)</label>
            <input className="mt-1 border px-2 py-2 w-full" value={amountUsdt} onChange={(e) => setAmountUsdt(e.target.value ? Number(e.target.value) : '')} />
          </div>

          <div className="flex items-end">
            <button className="bg-emerald-500 text-white px-4 py-2 rounded" onClick={calc}>
              计算收益
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded p-4">
        <h3 className="font-medium">计算结果</h3>
        {result ? (
          <div className="mt-3">
            <div>收益 (USD)：<span className="text-green-600 font-semibold">{result.profit?.toFixed(4)}</span></div>
            <div>收益率 (%)：<span className="text-green-600 font-semibold">{result.roi?.toFixed(2)}</span></div>
            <div>年化（估算）：<span className="text-green-600 font-semibold">{result.annual?.toFixed(2)}%</span></div>
          </div>
        ) : (
          <div className="mt-3 text-slate-500">请填写开仓 & 平仓信息后点击“计算收益”</div>
        )}
      </div>
    </section>
  );
}



