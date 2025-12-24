'use client';

import React, { useState } from 'react';
import Tabs from './Tabs';
import HighRates from './HighRates';
import Followed from './Followed';
import Calculator from './Calculator';

export default function ArbitrageApp(): React.ReactElement {
  const [active, setActive] = useState<'high' | 'followed' | 'calc'>('high');

  return (
    <div className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">币安资金费率套利监控</h1>
        <p className="text-sm text-slate-500">监控高费率合约 / 管理关注合约 / 收益计算器</p>
      </header>

      <div className="mb-4">
        <Tabs active={active} onChange={(v) => setActive(v)} />
      </div>

      <main>
        {active === 'high' && <HighRates />}
        {active === 'followed' && <Followed />}
        {active === 'calc' && <Calculator />}
      </main>
    </div>
  );
}



