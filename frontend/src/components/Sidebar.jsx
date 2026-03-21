import React from 'react';
import CardNav from './CardNav';

export default function Sidebar({ navItems }) {
  return (
    <div className="sticky top-0 h-screen w-80 bg-[#11141b] border-r border-white/5 flex flex-col shrink-0 z-50 p-6">
      <div className="mb-8 ml-4">
        <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
          RALLY<span className="text-green-500">.AI</span>
        </h2>
      </div>

      <div className="flex-1">
        <CardNav
          items={navItems}
          baseColor="#1a1d24"
          logoText="RALLY.AI"
        />
      </div>

      <div className="mt-auto p-4 bg-black/20 rounded-3xl border border-white/5 text-center">
        <p className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em]">System v2.0 Ready</p>
      </div>
    </div>
  );
}