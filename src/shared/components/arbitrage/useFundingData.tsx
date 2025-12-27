'use client';

import { useEffect, useRef, useState } from 'react';

type ContractData = {
  symbol: string;
  rate: number | null;
  annualRate: number | null;
  nextFundingTime?: number;
  openInterestValue?: number | null;
  spotVolume24h?: number | null;
  spotSpread?: number | null;
  spotBidDepth?: number | null;
  dataSourceType?: string;
  avg24?: number | null;
  avg100?: number | null;
  deliveryDate?: number | null;
  deliveryDateFormatted?: string;
};

const EXCHANGE_INFO_URL = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
const PREMIUM_INDEX_URL = 'https://fapi.binance.com/fapi/v1/premiumIndex';
const FUNDING_INFO_URL = 'https://fapi.binance.com/fapi/v1/fundingInfo';
const FUNDING_RATE_HISTORY_URL = 'https://fapi.binance.com/fapi/v1/fundingRate';
const SPOT_24HR_TICKER_URL = 'https://api.binance.com/api/v3/ticker/24hr';
const CONTRACT_OPEN_INTEREST_URL_ALL = 'https://fapi.binance.com/fapi/v1/openInterest';
const ALPHA_TOKEN_LIST_URL = 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';
const ALPHA_TICKER_BASE_URL = 'https://www.binance.com/bapi/defi/v1/public/alpha-trade/ticker';

const TEN_MINUTES = 600000;

function formatDeliveryDate(timestamp: number | null | undefined) {
  if (timestamp === null || timestamp === undefined || isNaN(Number(timestamp))) return '-';
  if (timestamp > 4000000000000) return '永不下架';
  try {
    const date = new Date(Number(timestamp));
    return date.toISOString().split('T')[0];
  } catch {
    return '-';
  }
}

function formatValue(value: number | null | undefined, unit = 'M') {
  if (value === null || value === undefined || isNaN(Number(value))) return '-';
  const num = Number(value);
  if (unit === 'M') {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num > 0) return num.toFixed(1);
    if (num === 0) return '0.0';
    return '-';
  }
  if (unit === 'K') return (num / 1000).toFixed(2) + 'K';
  return num.toFixed(2);
}

export default function useFundingData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allContractData, setAllContractData] = useState<ContractData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const allValidSymbolsRef = useRef<Set<string>>(new Set());
  const currentRateDataMapRef = useRef<Map<string, ContractData>>(new Map());
  const intervalMapRef = useRef<Map<string, number>>(new Map());
  const contractExchangeInfoMapRef = useRef<Map<string, { deliveryDate?: number }>>(new Map());
  const timerRef = useRef<number | null>(null);

  async function fetchExchangeInfo() {
    try {
      const res = await fetch(EXCHANGE_INFO_URL);
      if (!res.ok) {
        throw new Error(`exchangeInfo fetch failed: ${res.status}`);
      }
      const data = await res.json();
      const symbols = data.symbols || [];
      const set = new Set<string>();
      const infoMap = new Map<string, { deliveryDate?: number }>();
      symbols
        .filter((s: any) => s.status === 'TRADING' && s.contractType === 'PERPETUAL')
        .forEach((s: any) => {
          set.add(s.symbol);
          infoMap.set(s.symbol, { deliveryDate: s.deliveryDate });
        });
      allValidSymbolsRef.current = set;
      contractExchangeInfoMapRef.current = infoMap;
      setError(null);
    } catch (e: any) {
      console.error('fetchExchangeInfo error', e);
      setError(typeof e === 'string' ? e : e?.message ?? 'fetchExchangeInfo failed');
      // keep previous symbols if any, but rethrow to allow init to handle
      throw e;
    }
  }

  async function fetchFundingIntervals() {
    try {
      const res = await fetch(FUNDING_INFO_URL);
      if (!res.ok) return;
      const data = await res.json();
      const m = new Map<string, number>();
      data.forEach((item: any) => {
        const hours = parseInt(item.fundingIntervalHours);
        if (!isNaN(hours) && item.symbol) m.set(item.symbol, hours);
      });
      intervalMapRef.current = m;
    } catch (e) {
      // ignore
    }
  }

  async function fetchFundingRates() {
    try {
      const res = await fetch(PREMIUM_INDEX_URL);
      if (!res.ok) return [] as any[];
      const data = await res.json();
      return data as any[];
    } catch (e) {
      console.error('fetchFundingRates error', e);
      return [];
    }
  }

  async function fetchSpot24hrData() {
    const map = new Map<string, any>();
    try {
      const res = await fetch(SPOT_24HR_TICKER_URL);
      if (!res.ok) return map;
      const data = await res.json();
      data.forEach((item: any) => {
        if (allValidSymbolsRef.current.has(item.symbol)) {
          const bidPrice = parseFloat(item.bidPrice);
          const askPrice = parseFloat(item.askPrice);
          const bidQty = parseFloat(item.bidQty);
          const quoteVolume = parseFloat(item.quoteVolume);
          let spreadPercent = null;
          if (bidPrice > 0 && askPrice > bidPrice) spreadPercent = ((askPrice - bidPrice) / bidPrice) * 100;
          let bidDepth = null;
          if (bidPrice > 0 && bidQty > 0) bidDepth = bidPrice * bidQty;
          map.set(item.symbol, {
            spotVolume24h: quoteVolume,
            spotSpread: spreadPercent,
            spotBidDepth: bidDepth,
            dataSourceType: '现货',
          });
        }
      });
    } catch (e) {
      // ignore
    }
    return map;
  }

  async function fetchAlphaData() {
    const alphaMap = new Map<string, any>();
    try {
      const listRes = await fetch(ALPHA_TOKEN_LIST_URL);
      if (!listRes.ok) return alphaMap;
      const listData = await listRes.json();
      const alphaTokens = listData.data || [];
      const alphaTickerMap = new Map();
      alphaTokens.forEach((token: any) => {
        const tokenSymbol = token.symbol;
        const alphaId = token.alphaId;
        if (tokenSymbol && alphaId) {
          const standardSymbol = tokenSymbol + 'USDT';
          if (allValidSymbolsRef.current.has(standardSymbol)) alphaTickerMap.set(alphaId, standardSymbol);
        }
      });
      const promises: Promise<void>[] = [];
      for (const [alphaId, standardSymbol] of alphaTickerMap.entries()) {
        const tickerSymbol = alphaId + 'USDT';
        const url = `${ALPHA_TICKER_BASE_URL}?symbol=${tickerSymbol}`;
        const p = fetch(url)
          .then((r) => r.json())
          .then((data) => {
            const item = data.data || data;
            if (item && item.quoteVolume) {
              const bidPrice = parseFloat(item.bidPrice);
              const askPrice = parseFloat(item.askPrice);
              const quoteVolume = parseFloat(item.quoteVolume);
              let spreadPercent = null;
              if (bidPrice > 0 && askPrice > bidPrice) spreadPercent = ((askPrice - bidPrice) / bidPrice) * 100;
              alphaMap.set(standardSymbol, {
                spotVolume24h: quoteVolume,
                spotSpread: spreadPercent,
                spotBidDepth: null,
                dataSourceType: 'Alpha',
              });
            }
          })
          .catch(() => {});
        promises.push(p);
      }
      await Promise.all(promises);
    } catch (e) {
      // ignore
    }
    return alphaMap;
  }

  async function fetchSpotTicker(symbol: string) {
    try {
      const url = `${SPOT_24HR_TICKER_URL}?symbol=${symbol}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const item = await res.json();
      if (item && item.symbol) {
        const bidPrice = parseFloat(item.bidPrice);
        const askPrice = parseFloat(item.askPrice);
        const bidQty = parseFloat(item.bidQty);
        const quoteVolume = parseFloat(item.quoteVolume);
        let spreadPercent = null;
        if (bidPrice > 0 && askPrice > bidPrice) spreadPercent = ((askPrice - bidPrice) / bidPrice) * 100;
        let bidDepth = null;
        if (bidPrice > 0 && bidQty > 0) bidDepth = bidPrice * bidQty;
        return {
          spotVolume24h: quoteVolume,
          spotSpread: spreadPercent,
          spotBidDepth: bidDepth,
          dataSourceType: '现货',
        };
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  async function fetchOpenInterestData() {
    const map = new Map<string, any>();
    try {
      const res = await fetch(CONTRACT_OPEN_INTEREST_URL_ALL);
      if (!res.ok) return map;
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((item: any) => {
          if (allValidSymbolsRef.current.has(item.symbol)) {
            map.set(item.symbol, { openInterestValue: parseFloat(item.openInterestValue) });
          }
        });
      }
    } catch (e) {
      // ignore
    }
    return map;
  }

  async function fetchFundingRateHistoryForSymbol(symbol: string, limit = 100) {
    try {
      const url = `${FUNDING_RATE_HISTORY_URL}?symbol=${symbol}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  function calculateAnnualRate(rate: number, symbol: string) {
    const intervalHours = intervalMapRef.current.get(symbol) || 8;
    const settlementsPerYear = (365 * 24) / intervalHours;
    return rate * settlementsPerYear;
  }

  async function fetchAndAggregate() {
    setLoading(true);
    try {
      setError(null);
      const [fundingRatesRaw, spotMap, alphaMap, openInterestMap] = await Promise.all([
        fetchFundingRates(),
        fetchSpot24hrData(),
        fetchAlphaData(),
        fetchOpenInterestData(),
      ]);

      currentRateDataMapRef.current.clear();
      const all: ContractData[] = [];

      // To reduce race conditions, iterate with for..of so we can await per-symbol checks
      for (const rate of fundingRatesRaw) {
        const currentRate = parseFloat(rate.lastFundingRate);
        const annualRate = calculateAnnualRate(currentRate, rate.symbol);
        const symbol = rate.symbol;
        const exchangeInfo = contractExchangeInfoMapRef.current.get(symbol);
        const deliveryDate = exchangeInfo ? exchangeInfo.deliveryDate : null;
        const spotData = spotMap.get(symbol);
        const alphaData = alphaMap.get(symbol);
        // If spotData missing but alphaData exists, attempt per-symbol spot check to avoid mis-classification
        let finalSpotData = spotData;
        let finalAlphaData = alphaData;
        if (!finalSpotData && finalAlphaData) {
          try {
            // fetch per-symbol spot ticker (lightweight) to verify spot presence
            // eslint-disable-next-line no-await-in-loop
            const spotTicker = await fetchSpotTicker(symbol);
            if (spotTicker) {
              finalSpotData = spotTicker;
              finalAlphaData = null; // prefer spot if found
            }
          } catch {
            // ignore
          }
        }
        let spotVolume24h = null,
          spotSpread = null,
          spotBidDepth = null,
          dataSourceType = '  ';
        if (finalSpotData) {
          spotVolume24h = finalSpotData.spotVolume24h;
          spotSpread = finalSpotData.spotSpread;
          spotBidDepth = finalSpotData.spotBidDepth;
          dataSourceType = finalSpotData.dataSourceType;
        } else if (finalAlphaData) {
          spotVolume24h = finalAlphaData.spotVolume24h;
          spotSpread = finalAlphaData.spotSpread;
          spotBidDepth = finalAlphaData.spotBidDepth;
          dataSourceType = finalAlphaData.dataSourceType;
        }
        const openInterest = openInterestMap.get(symbol);
        const openInterestValue = openInterest ? openInterest.openInterestValue : null;
        // avg values will be loaded on demand to reduce initial load
        const avg24: number | null = null;
        const avg100: number | null = null;

        const full: ContractData = {
          symbol,
          rate: isNaN(currentRate) ? null : currentRate,
          annualRate: isNaN(annualRate) ? null : annualRate,
          nextFundingTime: rate.nextFundingTime,
          openInterestValue,
          spotVolume24h,
          spotSpread,
          spotBidDepth,
          dataSourceType,
          avg24,
          avg100,
          deliveryDate,
          deliveryDateFormatted: formatDeliveryDate(deliveryDate),
        };
        currentRateDataMapRef.current.set(symbol, full);
        all.push(full);
      }

      setAllContractData(all);
      setLastUpdated(Date.now());
    } catch (e) {
      console.error('fetchAndAggregate error', e);
      setError((e as any)?.message ?? 'fetchAndAggregate failed');
    } finally {
      setLoading(false);
    }
  }
  // Compute avg24 and avg100 for a given symbol on demand
  async function computeAveragesForSymbol(symbol: string) {
    try {
      const history = await fetchFundingRateHistoryForSymbol(symbol, 100);
      if (!Array.isArray(history) || history.length === 0) return { avg24: null, avg100: null };
      const rates = history.map((h: any) => Number(h.lastFundingRate ?? h.fundingRate ?? 0)).filter((v: any) => !isNaN(v));
      if (rates.length === 0) return { avg24: null, avg100: null };
      const last24 = rates.slice(-24);
      const last100 = rates.slice(-100);
      const avg24 = last24.length ? last24.reduce((s: number, v: number) => s + v, 0) / last24.length : null;
      const avg100 = last100.length ? last100.reduce((s: number, v: number) => s + v, 0) / last100.length : null;
      return { avg24, avg100 };
    } catch (e) {
      return { avg24: null, avg100: null };
    }
  }
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        await fetchExchangeInfo();
        await fetchFundingIntervals();
        await fetchAndAggregate();
        if (!mounted) return;
        timerRef.current = window.setInterval(fetchAndAggregate, TEN_MINUTES);
      } catch (e) {
        console.error('init error', e);
        setError((e as any)?.message ?? 'init failed');
      }
    }
    init();
    return () => {
      mounted = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    loading,
    allContractData,
    lastUpdated,
    formatValue,
    formatDeliveryDate,
    calculateAnnualRate,
    allValidSymbols: allValidSymbolsRef.current,
    currentRateDataMap: currentRateDataMapRef.current,
    reload: fetchAndAggregate,
    computeAveragesForSymbol,
    getIntervalHours: (symbol: string) => intervalMapRef.current.get(symbol) || 8,
    error,
  };
}


