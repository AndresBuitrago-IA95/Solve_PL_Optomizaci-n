import { useState } from 'react';
import { RawConfig, OptimizationResult } from './types';
import { SimplexSolver } from './lib/simplex';
import Formulario from './components/Formulario';
import PasoAPaso from './components/PasoAPaso';
import AnalisisSensibilidad from './components/AnalisisSensibilidad';
import MetodoGrafico from './components/MetodoGrafico';
import { PRESETS } from './data';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Calculator,
  Compass,
  FileSpreadsheet,
  LineChart,
  HelpCircle,
  TrendingUp,
  Brain,
  Award
} from 'lucide-react';

const INITIAL_CONFIG: RawConfig = {
  type: 'max',
  numVars: 2,
  objective: ['1', '2'],
  constraints: [
    { coeffs: ['1', '3'], type: '<=', rhs: '200' },
    { coeffs: ['2', '2'], type: '<=', rhs: '300' },
    { coeffs: ['0', '1'], type: '<=', rhs: '60' },
  ],
};

export default function App() {
  const [config, setConfig] = useState<RawConfig>(INITIAL_CONFIG);
  const [currentResult, setCurrentResult] = useState<OptimizationResult | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'simplex' | 'sensibilidad' | 'grafico'>('form');

  const handleSolve = (problemConfig: RawConfig) => {
    try {
      const solver = new SimplexSolver(problemConfig);
      const result = solver.solve();
      setCurrentResult(result);
      
      // Auto-switch tab to simplex on success
      setActiveTab('simplex');
    } catch (err: any) {
      console.error(err);
      alert(`Error al calcular la solución: ${err.message}`);
    }
  };

  const handleReset = () => {
    setConfig(INITIAL_CONFIG);
    setCurrentResult(null);
    setActiveTab('form');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E0E0E0] font-sans antialiased pb-16">
      {/* GEOMETRIC BALANCE BRANDED BAR */}
      <div className="bg-[#0F0F0F] border-b border-[#262626]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00FF9C] rounded flex items-center justify-center text-[#0A0A0A] font-extrabold text-lg shadow-sm shadow-[#00FF9C]/20 transition-all">
              ∑
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#888] font-mono tracking-tighter uppercase block">PROJECT / SOLVER_PL_CORE</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9C] animate-pulse"></span>
              </div>
              <h1 className="font-bold text-lg text-white tracking-wide font-mono -mt-0.5">optimization_engine.ts</h1>
            </div>
          </div>
          
          {/* Active status indicator & UdeA Marker */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#161616] border border-[#262626] rounded-lg text-xs font-mono text-[#00FF9C]">
              <span className="w-2 h-2 bg-[#00FF9C] rounded-full animate-none"></span>
              SOLVER ACTIVE
            </div>
            <div className="flex items-center gap-2 bg-[#1A1A1A] border border-[#262626] px-3.5 py-1.5 rounded-lg text-zinc-400 text-xs font-mono">
              <Award className="w-3.5 h-3.5 text-[#00FF9C] shrink-0" />
              <span>OPTIMIZACIÓN · UdeA</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* TABS SELECTOR PANEL */}
        <div className="flex items-center justify-start border-b border-[#262626] overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 mb-8 whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveTab('form')}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 text-zinc-400 hover:text-white transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'form'
                ? 'border-[#00FF9C] text-[#00FF9C] font-bold bg-[#111111]/30'
                : 'border-transparent'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" /> Formulación del Modelo
          </button>
          
          <button
            onClick={() => setActiveTab('simplex')}
            disabled={!currentResult}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              activeTab === 'simplex'
                ? 'border-[#00FF9C] text-[#00FF9C] font-bold bg-[#111111]/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> Simplex Tableros
          </button>

          <button
            onClick={() => setActiveTab('sensibilidad')}
            disabled={!currentResult || currentResult.status === 'unbounded' || currentResult.status === 'infeasible'}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              activeTab === 'sensibilidad'
                ? 'border-[#00FF9C] text-[#00FF9C] font-bold bg-[#111111]/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Análisis de Sensibilidad
          </button>

          <button
            onClick={() => setActiveTab('grafico')}
            disabled={!currentResult || config.numVars !== 2 || currentResult.status === 'unbounded' || currentResult.status === 'infeasible'}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              activeTab === 'grafico'
                ? 'border-[#00FF9C] text-[#00FF9C] font-bold bg-[#111111]/30'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" /> Método Gráfico (2D)
          </button>
        </div>

        {/* ACTIVE MODULE CONTAINER SHEET */}
        <div className="relative">
          <AnimatePresence mode="wait">
            {activeTab === 'form' && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Formulario
                  config={config}
                  setConfig={setConfig}
                  onSolve={handleSolve}
                  onReset={handleReset}
                />
              </motion.div>
            )}

            {activeTab === 'simplex' && currentResult && (
              <motion.div
                key="simplex"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {/* COMPACT OPTIMAL SOLUTION METRICS PANEL */}
                {currentResult.solution && currentResult.solution.z !== null && (
                  <div className="bg-[#0F0F0F] text-[#E0E0E0] rounded-xl p-6 border border-[#262626] grid grid-cols-1 sm:grid-cols-3 gap-6 items-center shadow-lg">
                    <div className="space-y-1 relative">
                      <div className="absolute -top-3 -left-3 text-[48px] font-black text-[#1A1A1A] select-none pointer-events-none font-mono">01</div>
                      <div className="relative z-10">
                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block font-mono">
                          Estado de Optimización
                        </span>
                        <p className="text-sm font-bold text-[#00FF9C] font-mono tracking-wide uppercase mt-1">
                          {currentResult.status === 'multiple' ? 'Múltiples Óptimos' : 'Solución Óptima'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1 sm:border-l sm:border-[#262626] sm:pl-6">
                      <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block font-mono">
                        Función Objetivo (Z*)
                      </span>
                      <p className="text-2xl font-bold text-white font-mono">
                        {currentResult.solution.z.toString()}
                        <span className="text-[11px] text-[#00FF9C] font-semibold font-mono ml-2">
                          (≈ {currentResult.solution.z.toDecimal().toFixed(4).replace(/\.00+$/, '')})
                        </span>
                      </p>
                    </div>
                    <div className="space-y-2 sm:border-l sm:border-[#262626] sm:pl-6">
                      <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block font-mono">
                        Variables de Decisión Óptimas
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {Object.entries(currentResult.solution.variables)
                          .filter(([key]) => key.startsWith('X'))
                          .map(([key, val]) => (
                            <span key={key} className="text-xs font-semibold bg-[#111] border border-[#262626] px-2 py-1 rounded font-mono text-white">
                              {key} = <span className="text-[#00FF9C]">{val.toString()}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                <PasoAPaso config={config} result={currentResult} />
              </motion.div>
            )}

            {activeTab === 'sensibilidad' && currentResult && (
              <motion.div
                key="sensibilidad"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <AnalisisSensibilidad config={config} result={currentResult} />
              </motion.div>
            )}

            {activeTab === 'grafico' && currentResult && (
              <motion.div
                key="grafico"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <MetodoGrafico config={config} result={currentResult} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
