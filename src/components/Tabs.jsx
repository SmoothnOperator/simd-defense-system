import React from 'react';
import { playCyberBeep } from '../utils/sound';

export default function Tabs({ activeTab, onSelectTab }) {
  const tabList = [
    { id: 0, label: "[01] VECTORIZABILITY ANALYZER", sub: "IDENTIFY" },
    { id: 1, label: "[02] THREE-WAY SIMULATOR (C=A+B & STENCIL)", sub: "COMPARE" },
    { id: 2, label: "[03] APPLICATION RECOMMENDER", sub: "PROPOSE" },
    { id: 3, label: "[04] SPEEDUP & AMDAHL TELEMETRY", sub: "FIGURES" }
  ];

  const handleTabClick = (id) => {
    playCyberBeep(700, 'sine', 0.04);
    onSelectTab(id);
  };

  return (
    <nav className="hud-tabs">
      {tabList.map(tab => (
        <button
          key={tab.id}
          className={`hud-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => handleTabClick(tab.id)}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
