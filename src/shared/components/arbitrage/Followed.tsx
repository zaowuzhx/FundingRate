'use client';

import React, { useEffect, useMemo, useState } from 'react';
import SummaryCards from './SummaryCards';
import useFundingData from './useFundingData';

const WATCHLIST_KEY = 'binance_watched_symbols';

export default function Followed() {
  const { allContractData, loading, formatValue } = useFundingData();
  const [symbolInput, setSymbolInput] = useState('');
  const [watched, setWatched] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (stored) {
      try {
        setWatched(JSON.parse(stored));
      } catch {
        setWatched([]);
      }
    }
    function onWatchedUpdated() {
      const fresh = localStorage.getItem(WATCHLIST_KEY);
      if (fresh) {
        try {
          setWatched(JSON.parse(fresh));
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('watched-updated', onWatchedUpdated);
    return () => {
      window.removeEventListener('watched-updated', onWatchedUpdated);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watched));
  }, [watched]);

  function addWatched() {
    const s = symbolInput.trim().toUpperCase();
    if (!s) return;
    if (!watched.includes(s)) {
      setWatched((w) => [s, ...w]);
      setSymbolInput('');
    }
  }

  function removeWatched(s: string) {
    setWatched((w) => w.filter((x) => x !== s));
  }

  const watchedData = useMemo(() => {
    return watched
      .map((s) => allContractData.find((c) => c.symbol === s) || { symbol: s, rate: null, annualRate: null, spotVolume24h: null, openInterestValue: null, dataSourceType: 'N/A', deliveryDateFormatted: '-' })
      .filter(Boolean);
  }, [watched, allContractData]);

  function updatePosition(symbol: string, value: string) {
    const n = Number(value);
    setPositions((p) => ({ ...p, [symbol]: isNaN(n) ? 0 : n }));
  }

  return (
    <section>
      <div className="bg-white border rounded p-4 mb-4">
        <div className="flex gap-2 items-center">
          <input
            className="border px-3 py-2 w-72"
            placeholder="输入交易对 (如 BTCUSDT)"
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
          />
          <button className="bg-sky-500 text-white px-4 py-2 rounded" onClick={addWatched}>
            + 关注
          </button>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          {watched.map((s) => (
            <span key={s} className="bg-slate-100 px-3 py-1 rounded flex items-center gap-2">
              {s}
              <button className="text-red-500" onClick={() => removeWatched(s)}>
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <SummaryCards />

      <div className="overflow-x-auto bg-white border rounded">
        <table className="min-w-full">
          <thead className="bg-cyan-500 text-white">
            <tr>
              <th className="p-3 text-left">交易对 / 持仓金额 (USDT)</th>
              <th className="p-3">年化费率</th>
              <th className="p-3">24h 成交额</th>
              <th className="p-3">日收益 (USD)</th>
              <th className="p-3">月收益 (USD)</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={6}>
                  数据加载中...
                </td>
              </tr>
            ) : watchedData.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={6}>
                  你的关注列表中暂无合约。
                </td>
              </tr>
            ) : (
              watchedData.map((c: any) => {
                const pos = positions[c.symbol] ?? 500;
                const annual = c.annualRate ?? 0;
                const daily = (annual * pos).toFixed(3);
                const monthly = (annual * pos / 12).toFixed(2);
                const spotVolume = formatValue(c.spotVolume24h, 'M');
                return (
                  <tr key={c.symbol} className="odd:bg-white even:bg-rose-50">
                    <td className="p-3">
                      <div className="font-medium">{c.symbol}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        <input
                          aria-label={`position-${c.symbol}`}
                          className="border px-2 py-1 w-20"
                          value={pos}
                          onChange={(e) => updatePosition(c.symbol, e.target.value)}
                        />{' '}
                        USDT
                      </div>
                    </td>
                    <td className="p-3 text-center">{c.annualRate ? `${(c.annualRate * 100).toFixed(2)}%` : '-'}</td>
                    <td className="p-3 text-center">{spotVolume}</td>
                    <td className="p-3 text-right text-green-600">{daily}</td>
                    <td className="p-3 text-right text-green-600">{monthly}</td>
                    <td className="p-3">
                      <button className="bg-amber-500 text-white px-3 py-1 rounded mr-2">编辑</button>
                      <button className="bg-red-100 px-3 py-1 rounded" onClick={() => removeWatched(c.symbol)}>
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}


