'use client';

import React, { useMemo, useState } from 'react';
import Filters from './Filters';
import SummaryCards from './SummaryCards';
import useFundingData from './useFundingData';
import FundingHistoryModal from './FundingHistoryModal';

type PositionMap = Record<string, number>;

export default function HighRates() {
  const { loading, allContractData, lastUpdated, formatDeliveryDate, formatValue, computeAveragesForSymbol, getIntervalHours, error, reload } = useFundingData();
  const [minAnnualPercent, setMinAnnualPercent] = useState<number | ''>(5);
  const [minVolumeM, setMinVolumeM] = useState<number | ''>(1);
  const [dataType, setDataType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [positions, setPositions] = useState<PositionMap>({});
  // thresholdPercent is percentage, default 0.005 (%)
  const [thresholdPercent, setThresholdPercent] = useState<number | ''>(0.005);
  const THRESHOLD = thresholdPercent === '' ? 0 : thresholdPercent / 100;
  // saved filter key
  const SAVED_FILTER_KEY = 'arb_saved_filters';
  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; payload: any }>>([]);
  // batch fill custom amount
  const [batchAmount, setBatchAmount] = useState<number>(500);
  // user-entered Binance spot ratio per symbol (persisted)
  const SPOT_RATIO_KEY = 'binance_spot_ratio_map';
  const [spotRatioMap, setSpotRatioMap] = useState<Record<string, number | ''>>({});

  const [sortKey, setSortKey] = useState<'rate' | 'annualRate' | 'spotVolume24h' | 'avg24' | 'avg100'>('rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);

  const toggleSort = (key: 'rate' | 'annualRate' | 'spotVolume24h' | 'avg24' | 'avg100') => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const [showAvgs, setShowAvgs] = useState<boolean>(false);
  const [avgMap, setAvgMap] = useState<Record<string, { avg24: number | null; avg100: number | null }>>({});

  async function loadAvgsForFiltered() {
    const symbols = filtered.map((c) => c.symbol);
    const concurrency = 6;
    const results: Record<string, { avg24: number | null; avg100: number | null }> = {};
    let idx = 0;
    const workers = new Array(concurrency).fill(null).map(async () => {
      while (idx < symbols.length) {
        const i = idx++;
        const s = symbols[i];
        try {
          const { avg24, avg100 } = await computeAveragesForSymbol(s);
          results[s] = { avg24, avg100 };
        } catch {
          results[s] = { avg24: null, avg100: null };
        }
      }
    });
    await Promise.all(workers);
    setAvgMap(results);
  }

  const filtered = useMemo(() => {
    const minAnnual = (minAnnualPercent === '' ? 0 : Number(minAnnualPercent)) / 100;
    const minVolume = (minVolumeM === '' ? 0 : Number(minVolumeM)) * 1000000;
    return allContractData
      .filter((c) => {
        if (!c) return false;
        if (c.annualRate === null || isNaN(Number(c.annualRate))) {
          if (minAnnual > 0) return false;
        } else if (c.annualRate < minAnnual) return false;
        if (c.spotVolume24h === null || isNaN(Number(c.spotVolume24h))) {
          if (minVolume > 0) return false;
        } else if ((c.spotVolume24h || 0) < minVolume) return false;
        if (dataType !== 'all' && c.dataSourceType !== dataType) return false;
        if (search && !c.symbol.includes(search)) return false;
        return true;
      })
      .sort((a, b) => {
        const get = (x: any) => {
          if (sortKey === 'rate') return x.rate ?? -Infinity;
          if (sortKey === 'annualRate') return x.annualRate ?? -Infinity;
          if (sortKey === 'spotVolume24h') return x.spotVolume24h ?? -Infinity;
          if (sortKey === 'avg24') return avgMap[x.symbol]?.avg24 ?? x.avg24 ?? -Infinity;
          if (sortKey === 'avg100') return avgMap[x.symbol]?.avg100 ?? x.avg100 ?? -Infinity;
          return x.rate ?? -Infinity;
        };
        const av = get(a);
        const bv = get(b);
        if (av === bv) return 0;
        if (sortDir === 'asc') return av - bv;
        return bv - av;
      });
  }, [allContractData, minAnnualPercent, minVolumeM, dataType, search, sortKey, sortDir]);

  // compute totals for summary
  const totals = useMemo(() => {
    let totalPosition = 0;
    let totalDaily = 0;
    let totalMonthly = 0;
    let totalYearly = 0;
    filtered.forEach((c) => {
      const pos = positions[c.symbol] ?? 0;
      const ann = Number(c.annualRate ?? 0);
      if (pos > 0 && isFinite(ann)) {
        const y = ann * pos;
        totalYearly += y;
        totalMonthly += y / 12;
        totalDaily += y / 365;
        totalPosition += pos;
      }
    });
    const combinedAnnualRate = totalPosition > 0 ? totalYearly / totalPosition : NaN;
    return { totalPosition, totalDaily, totalMonthly, totalYearly, combinedAnnualRate };
  }, [filtered, positions]);

  function updatePosition(symbol: string, value: string) {
    const num = Number(value);
    setPositions((p) => ({ ...p, [symbol]: isNaN(num) ? 0 : num }));
  }

  function fillAllPositions(amount: number) {
    const newPos: PositionMap = {};
    filtered.forEach((c) => {
      newPos[c.symbol] = amount;
    });
    setPositions((p) => ({ ...p, ...newPos }));
  }

  function fillCustomAmount() {
    fillAllPositions(batchAmount);
  }

  function saveFilter(name: string) {
    if (!name || !name.trim()) {
      return;
    }
    const payload = {
      minAnnualPercent,
      minVolumeM,
      dataType,
      search,
      thresholdPercent,
    };
    try {
      const raw = localStorage.getItem(SAVED_FILTER_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      // replace if same name
      const existingIndex = arr.findIndex((f: any) => f.name === name);
      if (existingIndex >= 0) {
        arr[existingIndex] = { name, payload };
      } else {
        arr.unshift({ name, payload });
      }
      localStorage.setItem(SAVED_FILTER_KEY, JSON.stringify(arr));
      setSavedFilters(arr);
    } catch (e) {
      console.error('save filter error', e);
    }
  }

  function applySavedFilter() {
    try {
      const raw = localStorage.getItem(SAVED_FILTER_KEY);
      if (!raw) {
        alert('没有已保存的筛选条件');
        return;
      }
      const arr = JSON.parse(raw);
      setSavedFilters(arr);
      if (arr.length > 0) {
        const obj = arr[0].payload;
        setMinAnnualPercent(obj.minAnnualPercent ?? 5);
        setMinVolumeM(obj.minVolumeM ?? 0);
        setDataType(obj.dataType ?? 'all');
        setSearch(obj.search ?? '');
        setThresholdPercent(obj.thresholdPercent ?? 0.005);
      } else {
        alert('没有已保存的筛选条件');
      }
    } catch (e) {
      console.error('apply saved filter error', e);
    }
  }

  // load saved filters on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_FILTER_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setSavedFilters(arr);
    } catch {
      setSavedFilters([]);
    }
    // load spot ratio map
    try {
      const raw = localStorage.getItem(SPOT_RATIO_KEY);
      const map = raw ? JSON.parse(raw) : {};
      setSpotRatioMap(map);
    } catch {
      setSpotRatioMap({});
    }
  }, []);

  function applySavedByName(name: string) {
    const f = savedFilters.find((s) => s.name === name);
    if (!f) return;
    const obj = f.payload;
    setMinAnnualPercent(obj.minAnnualPercent ?? 5);
    setMinVolumeM(obj.minVolumeM ?? 0);
    setDataType(obj.dataType ?? 'all');
    setSearch(obj.search ?? '');
    setThresholdPercent(obj.thresholdPercent ?? 0.005);
  }

  function removeSavedFilter(name: string) {
    try {
      const raw = localStorage.getItem(SAVED_FILTER_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const filteredArr = arr.filter((s: any) => s.name !== name);
      localStorage.setItem(SAVED_FILTER_KEY, JSON.stringify(filteredArr));
      setSavedFilters(filteredArr);
    } catch (e) {
      console.error('remove saved filter', e);
    }
  }

  function updateSpotRatio(symbol: string, value: string) {
    const parsed = value === '' ? '' : Number(value);
    setSpotRatioMap((m) => {
      const next: Record<string, number | ''> = { ...m, [symbol]: parsed };
      try {
        localStorage.setItem(SPOT_RATIO_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('save spot ratio error', e);
      }
      return next;
    });
  }

  return (
    <section>
      <Filters
        minAnnualPercent={minAnnualPercent}
        setMinAnnualPercent={setMinAnnualPercent}
        minVolumeM={minVolumeM}
        setMinVolumeM={setMinVolumeM}
        dataType={dataType}
        setDataType={setDataType}
        search={search}
        setSearch={setSearch}
        thresholdPercent={thresholdPercent}
        setThresholdPercent={setThresholdPercent}
        onSaveFilter={saveFilter}
        onApplySavedFilter={applySavedFilter}
      />
      {savedFilters.length > 0 && (
        <div className="mb-3 flex gap-2 items-center">
          <div className="text-sm text-slate-600 mr-2">已保存筛选：</div>
          {savedFilters.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <button
                className="bg-white border px-3 py-1 rounded"
                onClick={() => applySavedByName(s.name)}
              >
                {s.name}
              </button>
              <button
                className="text-xs text-red-500"
                onClick={() => removeSavedFilter(s.name)}
                title="删除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mb-3">
        <button
          className={`px-3 py-2 rounded mr-2 ${showAvgs ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}
          onClick={async () => {
            if (!showAvgs) {
              setShowAvgs(true);
              await loadAvgsForFiltered();
            } else {
              setShowAvgs(false);
              setAvgMap({});
            }
          }}
        >
          {showAvgs ? '隐藏均值' : '显示均值'}
        </button>
      </div>

      <div className="mb-2 text-sm text-slate-500">
        {loading ? '数据加载中...' : `上次更新时间: ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}`}
      </div>

      {error ? (
        <div className="mb-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-800">
          数据加载失败：{error}。可能是网络或 CORS 限制，<button className="underline" onClick={() => { try { reload(); } catch {} }}>重试</button> 或查看控制台(Network)获取详细错误。
        </div>
      ) : null}

      <SummaryCards
        totalPosition={totals.totalPosition}
        totalDaily={totals.totalDaily}
        totalMonthly={totals.totalMonthly}
        totalYearly={totals.totalYearly}
        combinedAnnualRate={totals.combinedAnnualRate}
      />

      <div className="mb-3">
        <button className="px-3 py-2 bg-sky-500 text-white rounded mr-2" onClick={() => fillAllPositions(500)}>
          批量填充 500
        </button>
        <button className="px-3 py-2 bg-sky-500 text-white rounded mr-2" onClick={() => fillAllPositions(1000)}>
          批量填充 1000
        </button>
        <div className="inline-flex items-center ml-4 gap-2">
          <input
            className="border px-2 py-1 w-28"
            type="number"
            value={batchAmount}
            onChange={(e) => setBatchAmount(Number(e.target.value))}
          />
          <button className="px-3 py-2 bg-emerald-500 text-white rounded" onClick={fillCustomAmount}>
            批量填充自定义
          </button>
        </div>
      </div>
      <div className="mb-2 text-sm text-slate-500">列表合约数量：{filtered.length} 个</div>

      <div className="overflow-x-auto bg-white border rounded">
        <table className="min-w-full">
          <thead className="bg-cyan-500 text-white">
            <tr>
              <th className="p-3 text-left">交易对 / 持仓金额 (USDT)</th>
                    <th className="p-3">费率结算周期 (H)</th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('rate')}>
                      资金费率 {sortKey === 'rate' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('annualRate')}>
                      年化费率 {sortKey === 'annualRate' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('spotVolume24h')}>
                      24h 成交额 (M) {sortKey === 'spotVolume24h' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('avg24')}>
                      24 次均值 {sortKey === 'avg24' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('avg100')}>
                      100 次均值 {sortKey === 'avg100' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="p-3">未平仓价值 (M)</th>
                    <th className="p-3">币安现货占比</th>
              <th className="p-3">类型</th>
              <th className="p-3">下架日期</th>
              <th className="p-3">日收益 (USD)</th>
              <th className="p-3">月收益 (USD)</th>
              <th className="p-3">年收益 (USD)</th>
              <th className="p-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-3" colSpan={12}>
                  数据加载中，请稍候...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td className="p-3" colSpan={12}>
                  没有符合筛选条件的合约。
                </td>
              </tr>
            ) : (
              filtered.map((c, i) => {
                const position = positions[c.symbol] ?? 500;
                const intervalHours = getIntervalHours ? getIntervalHours(c.symbol) : 8;
                const rate = Number(c.rate ?? 0);
                const annualRate = Number(c.annualRate ?? 0);
                const formattedRate = `${(rate * 100).toFixed(4)}%`;
                const formattedAnnual = `${(annualRate * 100).toFixed(2)}%`;
                const spotVolume = formatValue(c.spotVolume24h, 'M');
                const openInterestValue = formatValue(c.openInterestValue, 'M');
                // compute profits: yearly = principal * annualRate, monthly = yearly/12, daily = yearly/365
                const yearlyNum = annualRate * position;
                const monthlyNum = yearlyNum / 12;
                const dailyNum = yearlyNum / 365;
                const daily = isFinite(dailyNum) ? dailyNum.toFixed(3) : '-';
                const monthly = isFinite(monthlyNum) ? monthlyNum.toFixed(2) : '-';
                const yearly = isFinite(yearlyNum) ? yearlyNum.toFixed(2) : '-';

                const isHigh = rate > THRESHOLD;
                const rowClass = isHigh ? 'bg-rose-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50';

                return (
                  <tr key={c.symbol} className={rowClass}>
                <td className="p-3">
                      <div className="font-medium">{c.symbol}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        <input
                          className="border px-2 py-1 w-20"
                          value={position}
                          onChange={(e) => updatePosition(c.symbol, e.target.value)}
                        />{' '}
                        USDT
                      </div>
                    </td>
                    <td className="p-3 text-center">{intervalHours}</td>
                    <td className="p-3 text-center">{formattedRate}</td>
                    <td className="p-3 text-center">{formattedAnnual}</td>
                    <td className="p-3 text-center">{spotVolume}</td>
                    <td className="p-3 text-center">{(avgMap[c.symbol]?.avg24 != null ? `${(avgMap[c.symbol].avg24! * 100).toFixed(6)}%` : (c.avg24 != null ? `${(c.avg24 * 100).toFixed(6)}%` : '-'))}</td>
                    <td className="p-3 text-center">{(avgMap[c.symbol]?.avg100 != null ? `${(avgMap[c.symbol].avg100! * 100).toFixed(6)}%` : (c.avg100 != null ? `${(c.avg100 * 100).toFixed(6)}%` : '-'))}</td>
                    <td className="p-3 text-center">{openInterestValue}</td>
                    <td className="p-3 text-center">
                      <input
                        aria-label={`spot-ratio-${c.symbol}`}
                        className="border px-2 py-1 w-24 text-center"
                        value={spotRatioMap[c.symbol] === undefined ? '' : spotRatioMap[c.symbol]}
                        onChange={(e) => updateSpotRatio(c.symbol, e.target.value)}
                        placeholder="%"
                      />
                    </td>
                    <td className="p-3 text-center">{c.dataSourceType || '-'}</td>
                    <td className="p-3 text-center">{c.deliveryDateFormatted || '-'}</td>
                    <td className="p-3 text-right text-green-600">{daily}</td>
                    <td className="p-3 text-right text-green-600">{monthly}</td>
                    <td className="p-3 text-right text-green-600">{yearly}</td>
                    <td className="p-3">
                      <button
                        className="bg-emerald-500 text-white px-3 py-1 rounded mr-2"
                        onClick={() => {
                          try {
                            const key = 'binance_watched_symbols';
                            const stored = localStorage.getItem(key);
                            const arr = stored ? JSON.parse(stored) : [];
                            if (!arr.includes(c.symbol)) {
                              arr.unshift(c.symbol);
                              localStorage.setItem(key, JSON.stringify(arr));
                              window.dispatchEvent(new CustomEvent('watched-updated', { detail: { symbol: c.symbol } }));
                            }
                          } catch (err) {
                            console.error('add to watched error', err);
                          }
                        }}
                      >
                        关注
                      </button>
                      <button
                        className="bg-white border px-3 py-1 rounded"
                        onClick={() => {
                          setHistorySymbol(c.symbol);
                        }}
                      >
                        查看历史
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {historySymbol ? (
        <FundingHistoryModal
          symbol={historySymbol}
          onClose={() => setHistorySymbol(null)}
          onApplyAvg={(annual) => {
            // annual is decimal (e.g., 0.15 for 15%)
            setMinAnnualPercent((annual * 100) || 0);
            setHistorySymbol(null);
          }}
        />
      ) : null}
    </section>
  );
}


