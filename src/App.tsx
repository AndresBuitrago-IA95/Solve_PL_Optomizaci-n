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
  Award,
  AlertCircle
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
  const [alertInfo, setAlertInfo] = useState<{
    tab: 'sensibilidad' | 'grafico' | 'simplex';
    title: string;
    reason: string;
    recommendation: string;
  } | null>(null);

  const handleSolve = (problemConfig: RawConfig) => {
    try {
      const solver = new SimplexSolver(problemConfig);
      const result = solver.solve();
      setCurrentResult(result);
      
      // Auto-switch to the simplex solutions tab on success
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
    setAlertInfo(null);
  };

  const handleTabClick = (tab: 'form' | 'simplex' | 'sensibilidad' | 'grafico') => {
    if (tab === 'form') {
      setActiveTab('form');
      return;
    }

    if (tab === 'simplex') {
      if (!currentResult) {
        setAlertInfo({
          tab: 'simplex',
          title: 'Simplex No Disponible',
          reason: 'Aún no se ha estructurado ni resuelto ningún problema matemático de programación lineal para poder estructurar los tableros matriciales.',
          recommendation: 'Regresa a la pestaña de "Formulación del Modelo", define los coeficientes o formula mediante la IA de Gemini, y presiona el botón "Resolver" para activar esta vista.'
        });
        return;
      }
      setActiveTab('simplex');
      return;
    }

    if (tab === 'sensibilidad') {
      if (!currentResult) {
        setAlertInfo({
          tab: 'sensibilidad',
          title: 'Análisis de Sensibilidad No Disponible',
          reason: 'Para poder realizar un análisis económico de sensibilidad (costos reducidos, precios sombra e intervalos de estabilidad), se requiere haber resuelto previamente el modelo con éxito en el solver.',
          recommendation: 'Regresa a la pestaña de "Formulación del Modelo", define las ecuaciones de tu objetivo y recursos, y presiona "Resolver".'
        });
        return;
      }
      if (currentResult.status === 'infeasible') {
        setAlertInfo({
          tab: 'sensibilidad',
          title: 'Sensibilidad No Aplica: Modelo Infactible',
          reason: 'La teoría matemática de sensibilidad y el cálculo de precios sombra se fundamentan rigurosamente sobre la matriz idónea e invertible de la base óptima final. Dado que tu modelo actual no posee un espacio factible común que satisfaga simultáneamente todas las restricciones estructurales (infactibilidad), es analíticamente inválido calcular marginalidades duales o rangos de variabilidad.',
          recommendation: 'Recomposición del modelo: Valora qué desigualdades entran en conflicto contradictorio (ej. tener simultáneamente restricciones de mayor o igual incompatibles) y reduce o flexibiliza las condiciones del problema.'
        });
        setActiveTab('sensibilidad');
        return;
      }
      if (currentResult.status === 'unbounded') {
        setAlertInfo({
          tab: 'sensibilidad',
          title: 'Sensibilidad No Aplica: Modelo No Acotado',
          reason: 'El espacio convexo de soluciones no se encuentra contenido y la función de beneficio ideal tiende indefinidamente hacia el infinito en el sentido de optimización del criterio seleccionado (Z = ∞). Al carecer de un punto óptimo básico estacionario estable, las bases y los costos reducidos duales resultan indeterminados.',
          recommendation: 'Añade restricciones técnicas limitadoras que eviten que las variables crezcan ilimitadamente sin un tope de capacidad real o económica.'
        });
        setActiveTab('sensibilidad');
        return;
      }
      setActiveTab('sensibilidad');
      return;
    }

    if (tab === 'grafico') {
      if (!currentResult) {
        setAlertInfo({
          tab: 'grafico',
          title: 'Método Gráfico No Disponible',
          reason: 'Se requiere procesar y calcular los límites de nivel geométricos de la función objetivo y verificar si hay región factible resolviendo el problema primero.',
          recommendation: 'Presiona el botón de "Resolver" en la pestaña "Formulación del Modelo".'
        });
        return;
      }
      if (config.numVars !== 2) {
        setAlertInfo({
          tab: 'grafico',
          title: 'Método Gráfico No Aplica: Espacio Multidimensional',
          reason: `El método gráfico bidimensional requiere representar el politopo convexo en un plano cartesiano simple de 2 ejes ortogonales (X1 y X2). Tu modelo actual cuenta con ${config.numVars} variables de decisión. Visualizar físicamente más de 2 dimensiones requeriría la creación de hiperplanos dimensionales (ℝ^${config.numVars}) e hiperespacios proyectivos que rebasan las capacidades visuales de una pantalla bidimensional común sin destruir la proporción y visualización de esquinas factibles.`,
          recommendation: 'Utiliza la pestaña de "Simplex Tableros" para examinar de forma matricial interactiva cómo se resuelven algebraicamente los hiperplanos y variables adicionales del modelo.'
        });
        setActiveTab('grafico');
        return;
      }
      if (currentResult.status === 'infeasible') {
        setAlertInfo({
          tab: 'grafico',
          title: 'Método Gráfico: Región Factible Inexistente',
          reason: 'Las rectas de restricción no coinciden en ningún cuadrante común, lo que genera una región de factibilidad vacía en el plano de coordenadas. Al no haber polígono convexo de búsqueda, no es factible proyectar sombreados ni optimizar geométricamente en los vértices.',
          recommendation: 'Ajusta los operadores o disponibilidades correspondientes de tus desigualdades en el planteamiento original.'
        });
        setActiveTab('grafico');
        return;
      }
      if (currentResult.status === 'unbounded') {
        setAlertInfo({
          tab: 'grafico',
          title: 'Método Gráfico: Espacio No Acotado',
          reason: 'La región sombreada en el plano es infinitamente abierta en la dirección que optimiza el criterio de la isocosta/isoganancia. Por ello, la línea interactiva del objetivo puede deslizarse infinitamente sin tocar un vértice limitante.',
          recommendation: 'Asegúrate de comprobar los signos de desigualdad o añadir recursos máximos que limiten el crecimiento espacial.'
        });
        setActiveTab('grafico');
        return;
      }
      setActiveTab('grafico');
      return;
    }
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
            onClick={() => handleTabClick('form')}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 text-zinc-400 hover:text-white transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'form'
                ? 'border-[#00FF9C] text-[#00FF9C] font-bold bg-[#111111]/30'
                : 'border-transparent'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 shrink-0" /> Formulación del Modelo
          </button>
          
          <button
            onClick={() => handleTabClick('simplex')}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'simplex'
                ? 'border-[#00FF9C] text-[#00FF9C] font-bold bg-[#111111]/30'
                : !currentResult
                ? 'border-transparent text-zinc-600 hover:text-zinc-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" /> Simplex Tableros
            {!currentResult && (
              <span className="text-[9px] text-zinc-650 bg-zinc-900 border border-zinc-800/60 px-1 py-0.5 rounded ml-1 font-sans font-medium tracking-normal normal-case">
                Cerrado
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('sensibilidad')}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sensibilidad'
                ? 'border-[#BD93F9] text-[#BD93F9] font-bold bg-[#1A0E28]/25'
                : (!currentResult || currentResult.status === 'unbounded' || currentResult.status === 'infeasible')
                ? 'border-transparent text-zinc-600 hover:text-zinc-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Análisis de Sensibilidad
            {(!currentResult || currentResult.status === 'unbounded' || currentResult.status === 'infeasible') && (
              <span className="text-[9px] text-[#FF5555]/85 bg-[#FF5555]/10 border border-[#FF5555]/20 px-1.5 py-0.5 rounded ml-1 font-sans font-medium tracking-normal normal-case">
                No aplica
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabClick('grafico')}
            className={`py-3.5 px-5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'grafico'
                ? 'border-[#BD93F9] text-[#BD93F9] font-bold bg-[#1A0E28]/25'
                : (!currentResult || config.numVars !== 2 || currentResult.status === 'unbounded' || currentResult.status === 'infeasible')
                ? 'border-transparent text-zinc-600 hover:text-zinc-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" /> Método Gráfico (2D)
            {(!currentResult || config.numVars !== 2 || currentResult.status === 'unbounded' || currentResult.status === 'infeasible') && (
              <span className="text-[9px] text-[#FF5555]/85 bg-[#FF5555]/10 border border-[#FF5555]/20 px-1.5 py-0.5 rounded ml-1 font-sans font-medium tracking-normal normal-case">
                No aplica
              </span>
            )}
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

      {/* EXPLANATORY ALERT MODAL */}
      <AnimatePresence>
        {alertInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAlertInfo(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-lg bg-[#140D22] border border-[#BD93F9]/25 rounded-2xl p-6 shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-[#2D2140] pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FF5555]/10 border border-[#FF5555]/25 rounded-lg text-[#FF5555]">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  </div>
                  <h3 className="font-bold text-white font-mono text-sm uppercase tracking-wide leading-snug">
                    {alertInfo.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAlertInfo(null)}
                  className="text-zinc-500 hover:text-zinc-300 font-mono text-sm leading-none p-1 transition-all outline-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-widest text-[#BD93F9] font-mono block">¿Por qué ocurre esto?</span>
                <p className="text-zinc-300 text-xs leading-relaxed font-sans">
                  {alertInfo.reason}
                </p>
              </div>

              {/* Recommendation */}
              <div className="bg-[#090610] rounded-xl p-4 border border-[#2D2140] space-y-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-550 font-mono block">Recomendación de Resolución</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  {alertInfo.recommendation}
                </p>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setAlertInfo(null)}
                  className="px-5 py-2 bg-[#BD93F9]/10 hover:bg-[#BD93F9]/20 border border-[#BD93F9]/30 text-white rounded-lg text-xs font-mono tracking-wider transition-all cursor-pointer shadow-sm hover:shadow-[#BD93F9]/10 hover:-translate-y-0.5 active:translate-y-0"
                >
                  ENTENDIDO & CERRAR
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
