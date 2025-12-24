'use client';

import React from 'react';

type Props = {
  active: 'high' | 'followed' | 'calc';
  onChange: (v: 'high' | 'followed' | 'calc') => void;
};

export default function Tabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-2">
      <button
        className={`px-4 py-2 rounded ${active === 'high' ? 'bg-sky-500 text-white' : 'bg-white border'}`}
        onClick={() => onChange('high')}
      >
        高费率合约
      </button>
      <button
        className={`px-4 py-2 rounded ${active === 'followed' ? 'bg-sky-500 text-white' : 'bg-white border'}`}
        onClick={() => onChange('followed')}
      >
        关注合约
      </button>
      <button
        className={`px-4 py-2 rounded ${active === 'calc' ? 'bg-sky-500 text-white' : 'bg-white border'}`}
        onClick={() => onChange('calc')}
      >
        收益计算器
      </button>
    </div>
  );
}



