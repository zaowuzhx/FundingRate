'use client';

import React from 'react';

type Props = {
  minAnnualPercent: number | '';
  setMinAnnualPercent: (n: number | '') => void;
  minVolumeM: number | '';
  setMinVolumeM: (n: number | '') => void;
  dataType: string;
  setDataType: (s: string) => void;
  search: string;
  setSearch: (s: string) => void;
  thresholdPercent: number | '';
  setThresholdPercent: (n: number | '') => void;
  onSaveFilter?: (name: string) => void;
  onApplySavedFilter?: () => void;
};

export default function Filters({
  minAnnualPercent,
  setMinAnnualPercent,
  minVolumeM,
  setMinVolumeM,
  dataType,
  setDataType,
  search,
  setSearch,
  thresholdPercent,
  setThresholdPercent,
  onSaveFilter,
  onApplySavedFilter,
}: Props) {
  const [showSaveInput, setShowSaveInput] = React.useState(false);
  const [saveName, setSaveName] = React.useState('');
  return (
    <div className="bg-white border rounded p-4 mb-4 flex flex-wrap gap-3 items-center">
      <label className="text-sm">
        年化费率 &gt;
        <input
          type="number"
          step="0.01"
          className="ml-2 border px-2 py-1 w-20"
          value={minAnnualPercent === '' ? '' : minAnnualPercent}
          placeholder="例如 5"
          onChange={(e) => setMinAnnualPercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
        />
        %
      </label>

      <label className="text-sm">
        24h 成交额（M） &gt;
        <input
          type="number"
          step="0.01"
          className="ml-2 border px-2 py-1 w-28"
          value={minVolumeM === '' ? '' : minVolumeM}
          placeholder="例如 1.2"
          onChange={(e) => setMinVolumeM(e.target.value === '' ? '' : parseFloat(e.target.value))}
        />
      </label>

      <label className="text-sm">
        资金费率阈值 &gt;
        <input
          type="number"
          step="0.001"
          className="ml-2 border px-2 py-1 w-24"
          value={thresholdPercent === '' ? '' : thresholdPercent}
          placeholder="例如 0.005"
          onChange={(e) => setThresholdPercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
        />
        %
      </label>
      <label className="text-sm">
        数据类型
        <select className="ml-2 border px-2 py-1" value={dataType} onChange={(e) => setDataType(e.target.value)}>
          <option value="all">全部</option>
          <option value="现货">现货</option>
          <option value="Alpha">Alpha</option>
          <option value=" ">无数据</option>
        </select>
      </label>
      {/* 刷新间隔已移除 */}

      <div className="ml-auto">
        <input
          className="border px-2 py-1 w-48"
          placeholder="搜索合约 (如 BTCUSDT)"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
        />
      </div>
      <div className="flex items-center gap-2 ml-2">
        {!showSaveInput ? (
          <button
            className="bg-slate-200 px-3 py-1 rounded"
            onClick={() => {
              setSaveName('');
              setShowSaveInput(true);
            }}
          >
            保存筛选
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              aria-label="save-filter-name"
              className="border px-2 py-1 w-40"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="筛选名称"
            />
            <button
              className="bg-emerald-500 text-white px-3 py-1 rounded"
              onClick={() => {
                if (onSaveFilter) onSaveFilter(saveName.trim());
                setShowSaveInput(false);
              }}
              disabled={!saveName.trim()}
            >
              确定
            </button>
            <button
              className="bg-slate-200 px-3 py-1 rounded"
              onClick={() => {
                setShowSaveInput(false);
              }}
            >
              取消
            </button>
          </div>
        )}
        <button className="bg-slate-200 px-3 py-1 rounded" onClick={onApplySavedFilter}>
          应用已保存筛选
        </button>
      </div>
    </div>
  );
}


