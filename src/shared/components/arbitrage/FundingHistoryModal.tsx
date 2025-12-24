'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useFundingData from './useFundingData';

type Point = { time: number; rate: number };

type FundingHistoryModalProps = {
  symbol: string;
  onClose: () => void;
  onApplyAvg: (annualRateDecimal: number) => void;
  onComputedAvg?: (avg24: number | null, avg100: number | null) => void;
};

export default function FundingHistoryModal({
  symbol,
  onClose,
  onApplyAvg,
  onComputedAvg,
}: FundingHistoryModalProps) {
  const { calculateAnnualRate } = useFundingData();
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [count, setCount] = useState<number>(40);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchHistory() {
      setLoading(true);
      try {
        const end = Date.now();
        const start = end - 30 * 24 * 3600 * 1000;
        const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&startTime=${start}&endTime=${end}&limit=1000`;
        const res = await fetch(url);
        const data = await res.json();
        if (!mounted) return;
        const arr = (Array.isArray(data) ? data : []).map((d: any) => ({
          time: Number(d.time || d.fundingTime || d.timestamp || d[0]),
          rate: Number(d.lastFundingRate ?? d.fundingRate ?? d[1] ?? 0),
        }));
        arr.sort((a: any, b: any) => a.time - b.time);
        setPoints(arr);
      } catch (e) {
        console.error('fetch funding history error', e);
        setPoints([]);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  const display = useMemo(() => points.slice(-count), [points, count]);
  const rates = useMemo(() => display.map((p) => p.rate), [display]);
  let min = rates.length ? Math.min(...rates) : 0;
  let max = rates.length ? Math.max(...rates) : 0;
  // Ensure Y axis always includes 0 for better visual baseline
  if (min > 0) min = 0;
  if (max < 0) max = 0;
  const avgLast = (n: number) => {
    const arr = rates.slice(-n);
    if (arr.length === 0) return NaN;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  };
  const avg24 = avgLast(Math.min(24, rates.length));
  const avg100 = avgLast(Math.min(100, rates.length));
  const annual24 = isFinite(avg24) ? calculateAnnualRate(avg24, symbol) : NaN;
  const annual100 = isFinite(avg100) ? calculateAnnualRate(avg100, symbol) : NaN;
  // notify parent of computed averages
  useEffect(() => {
    if (onComputedAvg) onComputedAvg(avg24, avg100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avg24, avg100]);

  // SVG dims
  const W = 860;
  const H = 260;
  const padding = { l: 40, r: 20, t: 24, b: 28 };

  function xForIndex(i: number) {
    return padding.l + (i / Math.max(1, display.length - 1)) * (W - padding.l - padding.r);
  }
  function yForRate(r: number) {
    const range = (max - min) || 1;
    return padding.t + (1 - (r - min) / range) * (H - padding.t - padding.b);
  }

  function handleMouseMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    if (display.length === 0) return;
    // find nearest index by x
    let nearest = 0;
    let bestDist = Infinity;
    display.forEach((_, i) => {
      const xi = xForIndex(i);
      const d = Math.abs(localX - xi);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
    const xi = xForIndex(nearest);
    const yi = yForRate(display[nearest].rate);
    // compute window coordinates for tooltip (fixed positioning)
    const tooltipWidth = 220;
    const windowX = rect.left + xi;
    const windowY = rect.top + yi;
    const clampedX = Math.min(Math.max(windowX - tooltipWidth / 2, 8), window.innerWidth - tooltipWidth - 8);
    const top = Math.max(8, windowY - 48);
    setTooltipPos({ x: clampedX, y: top });
  }

  function handleMouseLeave() {
    setHoverIndex(null);
    setTooltipPos(null);
  }

  const latestRate = display.length ? display[display.length - 1].rate : NaN;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-slate-900 text-white rounded shadow p-6 w-[920px] max-h-[86vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold">资金费率: {isFinite(latestRate) ? `${(latestRate * 100).toFixed(6)}%` : '—'}</h3>
            <div className="text-sm text-slate-400">历史资金费率 — {symbol}（最近 30 天）</div>
          </div>
          <div className="flex items-center gap-2">
            <button className={`px-3 py-1 rounded ${count === 20 ? 'bg-slate-700' : 'bg-slate-800'}`} onClick={() => setCount(20)}>最近 20 次</button>
            <button className={`px-3 py-1 rounded ${count === 40 ? 'bg-slate-700' : 'bg-slate-800'}`} onClick={() => setCount(40)}>最近 40 次</button>
            <button className={`px-3 py-1 rounded ${count === 100 ? 'bg-slate-700' : 'bg-slate-800'}`} onClick={() => setCount(100)}>最近 100 次</button>
            <button className="text-sm px-2 py-1 border rounded" onClick={onClose}>关闭</button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-4 text-sm text-slate-300">
          <div>24 次均值: {isFinite(avg24) ? `${(avg24 * 100).toFixed(6)}%` : '—'}</div>
          <div>100 次均值: {isFinite(avg100) ? `${(avg100 * 100).toFixed(6)}%` : '—'}</div>
          <div>年化（24）: {isFinite(annual24) ? `${(annual24 * 100).toFixed(4)}%` : '—'}</div>
          <div>年化（100）: {isFinite(annual100) ? `${(annual100 * 100).toFixed(4)}%` : '—'}</div>
        </div>

        <div className="mb-4 relative">
          {loading ? <div className="text-slate-400">加载中...</div> : (
            <div className="overflow-auto">
              <svg ref={svgRef} width={W} height={H} className="rounded" style={{ background: '#0b1220' }}>
                {/* grid lines */}
                {[0,0.25,0.5,0.75,1].map((t,i)=> {
                  const y = padding.t + t * (H - padding.t - padding.b);
                  return <line key={i} x1={padding.l} x2={W - padding.r} y1={y} y2={y} stroke="#1f2937" strokeWidth={1} />
                })}
                {/* x axis labels */}
                {display.map((p, i) => {
                  const x = xForIndex(i);
                  if (i % Math.ceil(Math.max(1, display.length / 8)) === 0) {
                    const date = new Date(p.time);
                    const label = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                    return (
                      <text key={i} x={x} y={H - 6} fontSize={11} fill="#94a3b8" textAnchor="middle">
                        {label}
                      </text>
                    );
                  }
                  return null;
                })}
                {/* y axis ticks and labels; ensure 0 shown separately */}
                {(() => {
                  const ticks = 4;
                  const range = (max - min) || 1;
                  const vals = new Array(ticks + 1).fill(0).map((_, ti) => {
                    const t = ti / ticks;
                    return max - t * range;
                  });
                  const approxEqual = (a: number, b: number, eps = Math.max(Math.abs(range) * 1e-6, 1e-12)) =>
                    Math.abs(a - b) <= eps;
                  return vals.map((val, ti) => {
                    // skip tick that's effectively zero; we'll draw zero explicitly
                    if (min <= 0 && max >= 0 && approxEqual(val, 0)) return null;
                    const t = (max - val) / (range || 1);
                    const y = padding.t + t * (H - padding.t - padding.b);
                    return (
                      <g key={ti}>
                        <text x={8} y={y + 4} fontSize={11} fill="#94a3b8">
                          {(val * 100).toFixed(6)}%
                        </text>
                      </g>
                    );
                  });
                })()}
                {/* explicit zero baseline (if within range) */}
                {min <= 0 && max >= 0 ? (() => {
                  const y0 = yForRate(0);
                  return (
                    <g key="zero-line">
                      <line x1={padding.l} x2={W - padding.r} y1={y0} y2={y0} stroke="#334155" strokeWidth={1.5} />
                      <text x={8} y={y0 + 4} fontSize={11} fill="#ffffff">
                        {(0).toFixed(6) + '%'}
                      </text>
                    </g>
                  );
                })() : null}
                {/* polyline with halo to separate from gridlines */}
                <polyline
                  fill="none"
                  stroke="#0b1220"
                  strokeWidth={6}
                  strokeLinecap="round"
                  points={display.map((p, i) => `${xForIndex(i)},${yForRate(p.rate)}`).join(' ')}
                />
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeLinecap="round"
                  points={display.map((p, i) => `${xForIndex(i)},${yForRate(p.rate)}`).join(' ')}
                />
                {/* points */}
                {display.map((p,i)=> (
                  <circle key={i} cx={xForIndex(i)} cy={yForRate(p.rate)} r={4} fill="#f59e0b" stroke="#111827" strokeWidth={1} />
                ))}
                {/* hover vertical line & highlight */}
                {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < display.length && (
                  <>
                    <line x1={xForIndex(hoverIndex)} x2={xForIndex(hoverIndex)} y1={padding.t} y2={H - padding.b} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" />
                    <circle cx={xForIndex(hoverIndex)} cy={yForRate(display[hoverIndex].rate)} r={6} fill="#fff" stroke="#f59e0b" strokeWidth={2} />
                  </>
                )}
                {/* hover overlay */}
                <rect
                  x={0}
                  y={0}
                  width={W}
                  height={H}
                  fill="transparent"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                />
              </svg>
              {/* tooltip */}
              {hoverIndex !== null && tooltipPos && display[hoverIndex] && (
                <div
                  style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y, pointerEvents: 'none', zIndex: 9999 }}
                  className="bg-slate-800 text-white text-xs rounded px-2 py-1 shadow"
                >
                  <div>{new Date(display[hoverIndex].time).toLocaleString()}</div>
                  <div className="text-yellow-300">{(display[hoverIndex].rate * 100).toFixed(6)}%</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            className="px-3 py-2 bg-sky-500 text-white rounded disabled:opacity-50"
            onClick={() => { if (isFinite(annual24)) onApplyAvg(annual24); }}
            disabled={!isFinite(annual24)}
          >
            使用 24 次均值筛选（年化）
          </button>
          <button
            className="px-3 py-2 bg-sky-500 text-white rounded disabled:opacity-50"
            onClick={() => { if (isFinite(annual100)) onApplyAvg(annual100); }}
            disabled={!isFinite(annual100)}
          >
            使用 100 次均值筛选（年化）
          </button>
        </div>
      </div>
    </div>
  );
}


