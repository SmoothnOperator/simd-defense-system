import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Tabs from './components/Tabs';
import AnalyzerTab from './components/AnalyzerTab';
import SimulatorTab from './components/SimulatorTab';
import RecommenderTab from './components/RecommenderTab';
import TelemetryTab from './components/TelemetryTab';
import { playCyberBeep } from './utils/sound';

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [peCount, setPeCount] = useState(8);
  const [simulatorKernel, setSimulatorKernel] = useState('add');

  const handleUpdateCycles = (newCycles, newPeCount) => {
    setCycles(newCycles);
    if (newPeCount) setPeCount(newPeCount);
  };

  const handleDeployWorkload = (kernelTarget) => {
    setSimulatorKernel(kernelTarget);
    setActiveTab(1); // Switch to Tab 2 (Simulator)
    playCyberBeep(720, 'triangle', 0.08);
  };

  // Keyboard navigation for tab switching
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing inside an input or textarea
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === '1') {
        setActiveTab(0);
        playCyberBeep(600, 'sine', 0.03);
      } else if (e.key === '2') {
        setActiveTab(1);
        playCyberBeep(680, 'sine', 0.03);
      } else if (e.key === '3') {
        setActiveTab(2);
        playCyberBeep(760, 'sine', 0.03);
      } else if (e.key === '4') {
        setActiveTab(3);
        playCyberBeep(840, 'sine', 0.03);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="simd-app">
      <Header cycles={cycles} peCount={peCount} />
      
      <main className="main-container">
        <Tabs activeTab={activeTab} onSelectTab={setActiveTab} />

        <div className="tab-content">
          {activeTab === 0 && <AnalyzerTab />}
          {activeTab === 1 && (
            <SimulatorTab
              onUpdateCycles={handleUpdateCycles}
              initialKernel={simulatorKernel}
            />
          )}
          {activeTab === 2 && (
            <RecommenderTab onDeployWorkload={handleDeployWorkload} />
          )}
          {activeTab === 3 && <TelemetryTab />}
        </div>

        {/* Global HUD Hotkeys Indicator */}
        <div style={{
          marginTop: '28px',
          padding: '8px 16px',
          background: 'rgba(10, 12, 14, 0.75)',
          border: '1px solid var(--border-neon)',
          borderRadius: '6px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.68rem',
          color: 'var(--text-dim)'
        }}>
          <span>⌨ HUD COMMAND HOTKEYS: <strong style={{ color: 'var(--neon-emerald)' }}>[1]-[4]</strong> SWITCH MODULES &nbsp;|&nbsp; <strong style={{ color: '#ffffff' }}>[SPACE]</strong> PLAY/PAUSE &nbsp;|&nbsp; <strong style={{ color: '#ffffff' }}>[→]</strong> STEP &nbsp;|&nbsp; <strong style={{ color: '#ffffff' }}>[R]</strong> RESET</span>
          <span style={{ color: 'var(--neon-emerald)' }}>LIVE TELEMETRY BUS ACTIVE // 512-BIT AVX ENGINE</span>
        </div>
      </main>
    </div>
  );
}
