'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function Calculator() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [openPrice, setOpenPrice] = useState<number | ''>('');
  const [amountUsdt, setAmountUsdt] = useState<number | ''>(500);
  const [openTime, setOpenTime] = useState<string>(''); // ISO-local
  const [closeTime, setCloseTime] = useState<string>(''); // ISO-local (optional)

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    tradingPnl?: number;
    fundingFees?: number;
    totalProfit?: number;
    roi?: number;
    annualized?: number;
    settlements?: number;
  } | null>(null);
  const ARB_LOG_KEY = 'binance_arb_records';
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [closeModal, setCloseModal] = useState<{ idx: number; visible: boolean } | null>(null);
  const [closePriceInput, setClosePriceInput] = useState<string>('');
  const [closeAmountInput, setCloseAmountInput] = useState<string>('');
  const [closeTimeInput, setCloseTimeInput] = useState<string>('');
  const [detailsModal, setDetailsModal] = useState<{ idx: number; visible: boolean; details: any[] } | null>(null);

  const FUNDING_RATE_HISTORY_URL = 'https://fapi.binance.com/fapi/v1/fundingRate';

  const allSymbolsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    async function fetchAllSymbols() {
      try {
        const url = `https://fapi.binance.com/fapi/v1/exchangeInfo`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data && Array.isArray(data.symbols)) {
          const s = new Set<string>();
          data.symbols.forEach((it: any) => {
            if (it && it.symbol) s.add(String(it.symbol).toUpperCase());
          });
          allSymbolsRef.current = s;
        }
      } catch (e) {
        // ignore
      }
    }
    fetchAllSymbols();
    return () => { mounted = false; };
  }, []);

  async function validateSymbolExists(sym: string) {
    const key = String(sym || '').trim().toUpperCase();
    if (!key) return false;
    if (allSymbolsRef.current && allSymbolsRef.current.size > 0) {
      return allSymbolsRef.current.has(key);
    }
    // fallback to single-symbol exchangeInfo query
    try {
      const url = `https://fapi.binance.com/fapi/v1/exchangeInfo?symbol=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      if (!res.ok) return false;
      const data = await res.json();
      if (data && Array.isArray(data.symbols) && data.symbols.length > 0) return true;
      return false;
    } catch (e) {
      console.error('validate symbol error', e);
      return false;
    }
  }

  async function fetchFundingHistory(symbol: string, startTime: number, endTime: number) {
    const limit = 1000;
    let all: any[] = [];
    let currentStart = startTime;
    // simple loop to page through results if necessary
    while (currentStart < endTime) {
      const url = `${FUNDING_RATE_HISTORY_URL}?symbol=${symbol}&startTime=${currentStart}&endTime=${endTime}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      all = all.concat(data);
      if (data.length < limit) break;
      const last = data[data.length - 1];
      const lastTime = Number(last.fundingTime ?? last.time ?? 0);
      if (!lastTime || lastTime <= currentStart) break;
      currentStart = lastTime + 1;
      if (all.length > 5000) break;
    }
    // dedupe by fundingTime and sort asc
    const map = new Map<number, any>();
    all.forEach((d) => {
      const t = Number(d.fundingTime ?? d.time ?? 0);
      if (t) map.set(t, d);
    });
    const arr = Array.from(map.values()).sort((a, b) => (Number(a.fundingTime ?? a.time) - Number(b.fundingTime ?? b.time)));
    return arr;
  }

  async function calc() {
    // allow closeTime to be empty (treat as still open -> compute funding fees until now)
    if (!openPrice || !amountUsdt || !openTime) {
      return;
    }
    // validate symbol exists
    const exists = await validateSymbolExists(symbol);
    if (!exists) {
      alert('交易对不存在，请检查输入的 SYMBOL');
      return;
    }
    setLoading(true);
    try {
      const open = Number(openPrice);
      const close = null;
      const principal = Number(amountUsdt);
      const openTimeMs = new Date(openTime).getTime();
      const closeTimeMs = closeTime ? new Date(closeTime).getTime() : Date.now();

      // trading pnl: quantity = principal / openPrice, pnl = (close - open) * quantity (direction applied)
      const quantity = principal / open;
      // if close price not provided, trading pnl considered 0 (still open)
      const rawPnlPerUnit = close != null ? (direction === 'long' ? close - open : open - close) : 0;
      const tradingPnl = rawPnlPerUnit * quantity;

      // funding fees from history
      let fundingFees = 0;
      let settlements = 0;
      try {
        const history = await fetchFundingHistory(symbol, openTimeMs, closeTimeMs);
        history.forEach((item) => {
          const rate = Number(item.lastFundingRate ?? item.fundingRate ?? 0);
          const markPrice = Number(item.markPrice ?? item.price ?? 0);
          if (!isFinite(rate) || !isFinite(markPrice)) return;
          const currentPositionValue = quantity * markPrice;
          const fee = currentPositionValue * rate;
          const actualFee = direction === 'short' ? fee : -fee;
          fundingFees += actualFee;
          settlements += 1;
        });
      } catch (e) {
        console.error('fetch funding history error', e);
      }

      const totalProfit = tradingPnl + fundingFees;
      const roi = (totalProfit / principal) * 100;
      const holdingDays = Math.max(1 / 24, (closeTimeMs - openTimeMs) / 86400000); // at least small
      const annualized = (totalProfit / principal) * (365 / holdingDays) * 100; // percent

      // create and save record directly (no draft/result panel)
      const rec = {
        id: Date.now(),
        symbol,
        side: direction,
        openPrice: Number(openPrice),
        amount: Number(amountUsdt),
        openTime,
        closePrice: null,
        closeAmount: null,
        closeTime: closeTime ? closeTime : null,
        totalFundingFee: fundingFees,
        settlementCount: settlements,
        currentAnnualRate: annualized ? annualized / 100 : 0,
      };
      const next = [rec, ...savedRecords];
      setSavedRecords(next);
      try {
        localStorage.setItem(ARB_LOG_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('save arb record', e);
      }
    } finally {
      setLoading(false);
    }
  }

  // saved position management
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(ARB_LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setSavedRecords(arr);
    } catch {
      setSavedRecords([]);
    }
  }, []);

  function savePositionFromResult() {
    if (!result) return;
    if (!openPrice || !openTime || !amountUsdt) return;
    const rec = {
      id: Date.now(),
      symbol,
      side: direction,
      openPrice: Number(openPrice),
      amount: Number(amountUsdt),
      openTime,
      closePrice: null,
      closeAmount: null,
      closeTime: null,
      totalFundingFee: result.fundingFees ?? 0,
      settlementCount: result.settlements ?? 0,
      currentAnnualRate: result.annualized ? result.annualized / 100 : 0,
    };
    const next = [rec, ...savedRecords];
    setSavedRecords(next);
    try {
      localStorage.setItem(ARB_LOG_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('save arb record', e);
    }
  }

  async function handleCloseRecord(idx: number) {
    const rec = savedRecords[idx];
    if (!rec) return;
    // use inputs
    const closePrice = parseFloat(closePriceInput);
    const closeAmount = parseFloat(closeAmountInput);
    const closeTimeVal = closeTimeInput;
    if (isNaN(closePrice) || isNaN(closeAmount) || !closeTimeVal) {
      alert('请填写有效的平仓价格、数量和时间');
      return;
    }
    // fetch funding history for this record between openTime and closeTime and compute funding fees
    const openMs = new Date(rec.openTime).getTime();
    const closeMs = new Date(closeTimeVal).getTime();
    const history = await fetchFundingHistory(rec.symbol, openMs, closeMs);
    // compute funding totals from history array
    let totalFee = 0;
    let count = 0;
    const details: any[] = [];
    const quantity = rec.amount / rec.openPrice;
    history.forEach((item) => {
      const rate = Number(item.lastFundingRate ?? item.fundingRate ?? 0);
      const markPrice = Number(item.markPrice ?? item.price ?? 0);
      if (!isFinite(rate) || !isFinite(markPrice)) return;
      const currentPositionValue = quantity * markPrice;
      const fee = currentPositionValue * rate;
      const actualFee = rec.side === 'short' ? fee : -fee;
      totalFee += actualFee;
      count += 1;
      details.push({
        time: Number(item.fundingTime ?? item.time ?? 0),
        rate,
        markPrice,
        profit: actualFee,
      });
    });
    rec.closePrice = closePrice;
    rec.closeAmount = closeAmount;
    rec.closeTime = closeTimeVal;
    rec.totalFundingFee = totalFee;
    rec.settlementCount = count;
    rec.details = details;
    rec.currentAnnualRate = count ? (rec.totalFundingFee / rec.amount) * (365 * 24 / Math.max(1, count)) : 0;
    const next = [...savedRecords];
    next[idx] = rec;
    setSavedRecords(next);
    try {
      localStorage.setItem(ARB_LOG_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('save close', e);
    }
    setCloseModal(null);
  }

  return (
    <section>
      <div className="bg-white border rounded p-4 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-sm">交易对 (SYMBOL)</label>
            <input className="mt-1 border px-2 py-2 w-full" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
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
            <label className="text-sm">开仓时间 (本地)</label>
            <input className="mt-1 border px-2 py-2 w-full" type="datetime-local" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">平仓时间 (本地，可空)</label>
            <input className="mt-1 border px-2 py-2 w-full" type="datetime-local" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">开仓数量 (USDT 值)</label>
            <input className="mt-1 border px-2 py-2 w-full" value={amountUsdt} onChange={(e) => setAmountUsdt(e.target.value ? Number(e.target.value) : '')} />
          </div>

          <div className="flex items-end">
            <button className="bg-emerald-500 text-white px-4 py-2 rounded" onClick={calc} disabled={loading}>
              {loading ? '计算中...' : '计算收益'}
            </button>
          </div>
        </div>
      </div>

      {/* 计算结果面板已移除 — 结果直接保存到记录列表 */}

      {/* saved positions list (table style like screenshot) */}
      <div className="bg-white border rounded p-4 mt-4">
        <h3 className="font-medium">所有持仓记录</h3>

            <div className="mt-3 mb-3 p-3 rounded bg-emerald-50 border">
          <div className="flex justify-between items-center text-sm">
            <div>总资金费收益（所有记录）： <span className="text-green-700 font-semibold">{savedRecords.reduce((s, r) => s + (r.totalFundingFee || 0), 0).toFixed(3)} USDT</span></div>
            <div>当前未平仓总持仓： <span className="font-semibold">{savedRecords.reduce((s, r) => s + ((r.closeTime ? 0 : (r.amount || 0))), 0).toFixed(3)} USDT</span></div>
            <div>未平合约综合年化收益率： <span className="text-orange-600 font-semibold">
              {(() => {
                const openTotal = savedRecords.reduce((s, r) => s + ((r.closeTime ? 0 : (r.amount || 0))), 0);
                if (openTotal <= 0) return '0.00%';
                const weighted = savedRecords.reduce((s, r) => s + ((r.closeTime ? 0 : (r.currentAnnualRate || 0)) * (r.amount || 0)), 0);
                return `${((weighted / openTotal) * 100).toFixed(3)}%`;
              })()}
            </span></div>
          </div>
        </div>

        {savedRecords.length === 0 ? (
          <div className="mt-2 text-slate-500">暂无记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full mt-2">
              <thead className="bg-cyan-500 text-white">
                <tr>
                  <th className="p-3">交易对 / 方向</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">开仓时间</th>
                  <th className="p-3">开仓数量</th>
                  <th className="p-3">开仓价格</th>
                  <th className="p-3">平仓时间</th>
                  <th className="p-3">计算次数</th>
                  <th className="p-3">总资金费收益</th>
                  <th className="p-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {savedRecords.map((r, idx) => (
                  <tr key={r.id}>
                    <td className="p-3">{r.symbol} ({r.side.toUpperCase()})</td>
                    <td className="p-3">{r.closeTime ? '已平仓' : <span style={{color:'#16a34a'}}>未平仓（持续监控）</span>}</td>
                    <td className="p-3">{r.openTime ? new Date(r.openTime).toLocaleString() : '—'}</td>
                    <td className="p-3">{Number(r.amount || 0).toFixed(3)}</td>
                    <td className="p-3">{Number(r.openPrice || 0).toFixed(3)}</td>
                    <td className="p-3">{r.closeTime ? new Date(r.closeTime).toLocaleString() : '—'}</td>
                    <td className="p-3 text-center">{r.settlementCount ?? 0}</td>
                    <td className="p-3 text-right text-green-700">{(r.totalFundingFee ?? 0).toFixed(3)} USDT</td>
                    <td className="p-3">
                      <button className="px-2 py-1 border rounded mr-2 bg-white" onClick={async () => {
                        const openMs2 = new Date(r.openTime).getTime();
                        const endMs2 = r.closeTime ? new Date(r.closeTime).getTime() : Date.now();
                        const history = await fetchFundingHistory(r.symbol, openMs2, endMs2);
                        const qty2 = r.amount / r.openPrice;
                        const details2: any[] = [];
                        history.forEach(item => {
                          const rate = Number(item.lastFundingRate ?? item.fundingRate ?? 0);
                          const markPrice = Number(item.markPrice ?? item.price ?? 0);
                          if (!isFinite(rate) || !isFinite(markPrice)) return;
                          const currentPositionValue = qty2 * markPrice;
                          const fee = currentPositionValue * rate;
                          const actualFee = r.side === 'short' ? fee : -fee;
                          details2.push({ time: Number(item.fundingTime ?? item.time ?? 0), rate, markPrice, profit: actualFee });
                        });
                        setDetailsModal({ idx, visible: true, details: details2 });
                      }}>详情</button>
                      {!r.closeTime ? <button className="px-2 py-1 bg-amber-500 text-white rounded mr-2" onClick={() => { setCloseModal({ idx, visible: true }); setClosePriceInput(''); setCloseAmountInput(''); setCloseTimeInput(new Date().toISOString().slice(0,16)); }}>平仓</button> : null}
                      <button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => {
                        const next = savedRecords.filter((_, i) => i !== idx);
                        setSavedRecords(next);
                        try { localStorage.setItem(ARB_LOG_KEY, JSON.stringify(next)); } catch {}
                      }}>删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* close modal */}
      {closeModal && closeModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setCloseModal(null)} />
          <div className="relative bg-white rounded shadow p-6 w-[480px]">
            <h3 className="font-medium mb-2">平仓记录</h3>
            <div className="grid grid-cols-1 gap-2">
              <label>平仓价格</label>
              <input className="border px-2 py-1" value={closePriceInput} onChange={(e) => setClosePriceInput(e.target.value)} />
              <label>平仓数量 (USDT)</label>
              <input className="border px-2 py-1" value={closeAmountInput} onChange={(e) => setCloseAmountInput(e.target.value)} />
              <label>平仓时间</label>
              <input type="datetime-local" className="border px-2 py-1" value={closeTimeInput} onChange={(e) => setCloseTimeInput(e.target.value)} />
              <div className="flex gap-2 mt-3">
                <button className="px-3 py-2 bg-emerald-500 text-white rounded" onClick={() => handleCloseRecord(closeModal.idx)}>
                  确认平仓
                </button>
                <button className="px-3 py-2 bg-slate-200 rounded" onClick={() => setCloseModal(null)}>
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* details modal */}
      {detailsModal && detailsModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setDetailsModal(null)} />
          <div className="relative bg-white rounded shadow p-6 w-[720px] max-h-[80vh] overflow-auto">
            <h3 className="font-medium mb-2">结算详情</h3>
            {detailsModal.details.length === 0 ? (
              <div className="text-slate-500">暂无结算数据</div>
            ) : (
              <table className="min-w-full">
                <thead className="bg-cyan-500 text-white">
                  <tr>
                    <th className="p-2">时间</th>
                    <th className="p-2">费率</th>
                    <th className="p-2">标记价格</th>
                    <th className="p-2">本次收益 (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsModal.details.map((d, i) => (
                    <tr key={i}>
                      <td className="p-2">{new Date(d.time).toLocaleString()}</td>
                      <td className="p-2">{(d.rate * 100).toFixed(3)}%</td>
                      <td className="p-2">{d.markPrice.toFixed(3)}</td>
                      <td className="p-2" style={{ color: d.profit >= 0 ? 'green' : 'red' }}>{d.profit.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-4 text-right">
              <button className="px-3 py-2 bg-slate-200 rounded" onClick={() => setDetailsModal(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



