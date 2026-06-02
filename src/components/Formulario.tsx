import React, { useState, useEffect } from 'react';
import { RawConfig, ExamplePreset } from '../types';
import { PRESETS } from '../data';
import { Settings2, Plus, Minus, Calculator, RotateCcw, BookOpen, AlertCircle, Sparkles } from 'lucide-react';

interface FormularioProps {
  onSolve: (config: RawConfig) => void;
  onReset: () => void;
  config: RawConfig;
  setConfig: React.Dispatch<React.SetStateAction<RawConfig>>;
}

export default function Formulario({ onSolve, onReset, config, setConfig }: FormularioProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nlpText, setNlpText] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [nlpError, setNlpError] = useState<string | null>(null);
  const [nlpSuccess, setNlpSuccess] = useState<boolean>(false);

  const handleNlpParse = async () => {
    if (!nlpText.trim()) {
      setNlpError("Por favor, introduce el texto del problema.");
      return;
    }
    setNlpLoading(true);
    setNlpError(null);
    setNlpSuccess(false);

    try {
      const response = await fetch('/api/parse-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpText }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar el texto con IA. Verifica tu conexión o reintenta.');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const parsedNumVars = Math.min(6, Math.max(2, Number(data.numVars) || 2));

      // Build safe arrays
      const paddedObj = Array.from({ length: parsedNumVars }, (_, idx) => {
        return (data.objective && data.objective[idx] !== undefined) ? String(data.objective[idx]) : '0';
      });

      const safeConstraints = (data.constraints || []).map((c: any) => {
        const paddedCoeffs = Array.from({ length: parsedNumVars }, (_, idx) => {
          return (c.coeffs && c.coeffs[idx] !== undefined) ? String(c.coeffs[idx]) : '0';
        });
        return {
          coeffs: paddedCoeffs,
          type: (c.type === '<=' || c.type === '>=' || c.type === '=') ? c.type : '<=',
          rhs: String(c.rhs || '0')
        };
      });

      setConfig({
        type: data.type === 'min' ? 'min' : 'max',
        numVars: parsedNumVars,
        objective: paddedObj,
        constraints: safeConstraints.length > 0 ? safeConstraints : [{
          coeffs: Array.from({ length: parsedNumVars }, () => '0'),
          type: '<=',
          rhs: '0'
        }]
      });

      setNlpSuccess(true);
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setNlpError(err.message || "No se ha podido procesar el problema. Inténtalo de nuevo describiéndolo con más detalle.");
    } finally {
      setNlpLoading(false);
    }
  };

  // When variable count changes, adjust raw objective array length
  const handleVarCountChange = (newCount: number) => {
    if (newCount < 2 || newCount > 6) return; // limit to 2 to 6 variables for sanity and UI fit

    let updatedObjective = [...config.objective];
    if (newCount > config.numVars) {
      // pad with zeros
      while (updatedObjective.length < newCount) {
        updatedObjective.push('0');
      }
    } else {
      updatedObjective = updatedObjective.slice(0, newCount);
    }

    const updatedConstraints = config.constraints.map(c => {
      let coeffs = [...c.coeffs];
      if (newCount > config.numVars) {
        while (coeffs.length < newCount) {
          coeffs.push('0');
        }
      } else {
        coeffs = coeffs.slice(0, newCount);
      }
      return { ...c, coeffs };
    });

    setConfig({
      ...config,
      numVars: newCount,
      objective: updatedObjective,
      constraints: updatedConstraints,
    });
  };

  // When constraints count changes, adjust constraints array length
  const handleConstraintCountChange = (newCount: number) => {
    if (newCount < 1 || newCount > 10) return; // limit to 1 to 10 restrictions

    let updatedConstraints = [...config.constraints];
    if (newCount > config.constraints.length) {
      while (updatedConstraints.length < newCount) {
        updatedConstraints.push({
          coeffs: Array.from({ length: config.numVars }, () => '0'),
          type: '<=',
          rhs: '0',
        });
      }
    } else {
      updatedConstraints = updatedConstraints.slice(0, newCount);
    }

    setConfig({
      ...config,
      constraints: updatedConstraints,
    });
  };

  const handleObjectiveCoeffChange = (idx: number, val: string) => {
    const updatedObjective = [...config.objective];
    updatedObjective[idx] = val;
    setConfig({
      ...config,
      objective: updatedObjective,
    });
  };

  const handleConstraintCoeffChange = (cIdx: number, vIdx: number, val: string) => {
    const updatedConstraints = [...config.constraints];
    updatedConstraints[cIdx].coeffs[vIdx] = val;
    setConfig({
      ...config,
      constraints: updatedConstraints,
    });
  };

  const handleConstraintTypeChange = (cIdx: number, val: '<=' | '>=' | '=') => {
    const updatedConstraints = [...config.constraints];
    updatedConstraints[cIdx].type = val;
    setConfig({
      ...config,
      constraints: updatedConstraints,
    });
  };

  const handleConstraintRhsChange = (cIdx: number, val: string) => {
    const updatedConstraints = [...config.constraints];
    updatedConstraints[cIdx].rhs = val;
    setConfig({
      ...config,
      constraints: updatedConstraints,
    });
  };

  const loadPreset = (p: ExamplePreset) => {
    setConfig({
      type: p.type,
      numVars: p.vars,
      objective: [...p.objective],
      constraints: p.constraints.map(c => ({
        coeffs: [...c.coeffs],
        type: c.type,
        rhs: c.rhs,
      })),
    });
    setErrorMsg(null);
  };

  const validateAndSolve = () => {
    // Validate inputs
    // Enforce that all coefficients can be evaluated to numbers or fraction formats like '3/4'
    const coeffRegex = /^-?\d+(\.\d+)?(\/-?\d+)?$/;

    let invalid = false;
    for (const val of config.objective) {
      if (!val.trim() || !coeffRegex.test(val.trim().replace(/\s/g, ''))) {
        invalid = true;
        break;
      }
    }

    if (!invalid) {
      for (const c of config.constraints) {
        for (const val of c.coeffs) {
          if (!val.trim() || !coeffRegex.test(val.trim().replace(/\s/g, ''))) {
            invalid = true;
            break;
          }
        }
        if (!c.rhs.trim() || !coeffRegex.test(c.rhs.trim().replace(/\s/g, ''))) {
          invalid = true;
        }
      }
    }

    if (invalid) {
      setErrorMsg("Error: Por favor, introduce solo números o fracciones válidas (ej: '5', '-1.5', '2/3').");
      return;
    }

    setErrorMsg(null);
    onSolve(config);
  };

  return (
    <div className="space-y-6">
      {/* PRESETS HEADER PANEL */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-5 shadow-sm">
        <h4 className="font-bold text-xs uppercase tracking-wider mb-3.5 flex items-center gap-2 text-zinc-400 font-mono">
          <BookOpen className="w-4 h-4 text-[#00FF9C]" /> Modelos de Ejemplo Rápidos (Ejemplos UdeA)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => loadPreset(preset)}
              type="button"
              className="text-left p-3.5 bg-[#13111C]/35 border border-[#262626] hover:border-[#00FF9C] hover:bg-[#151515] rounded-lg transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-semibold text-white text-xs group-hover:text-[#00FF9C] block transition-colors font-mono">
                  {preset.title}
                </span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-2 uppercase font-bold border ${preset.type === 'max' ? 'bg-[#102A1E] border-[#1FA264]/40 text-[#00FF9C]' : 'bg-[#1F192F] border-[#BD93F9]/40 text-[#BD93F9]'}`}>
                  {preset.type.toUpperCase()}
                </span>
              </div>
              <p className="text-zinc-500 text-[10px] line-clamp-2 leading-relaxed">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* NLP IA PROBLEM PARSER */}
      <div className="bg-[#120F1F]/45 border border-[#BD93F9]/25 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#2D2140] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#BD93F9]" />
            <h4 className="font-bold text-sm text-white font-mono uppercase tracking-wide">
              Formular con Inteligencia Artificial (Texto a Modelo)
            </h4>
          </div>
          <span className="text-[9px] bg-[#BD93F9]/15 text-[#BD93F9] border border-[#BD93F9]/30 px-2 py-0.5 rounded font-mono font-bold tracking-wider">
            GEMINI IA
          </span>
        </div>

        <p className="text-xs text-zinc-400 font-sans leading-relaxed">
          Escribe o pega el enunciado de tu problema (en lenguaje natural o ecuaciones legibles), y la IA extraerá de forma automática la función objetivo y las restricciones estructurales.
        </p>

        <textarea
          rows={3}
          value={nlpText}
          onChange={(e) => setNlpText(e.target.value)}
          placeholder="Escribe aquí tu problema... Ej: Maximizar Z = 20X1 + 30X2 + 10X3 sujeto a 3X1 + 2X2 <= 240, X1 + 2X2 + 4X3 <= 300, y no negatividad."
          className="w-full text-zinc-200 placeholder-zinc-600 outline-none text-xs font-mono bg-[#111115] border border-[#2D2140] hover:border-[#BD93F9]/40 focus:border-[#BD93F9] transition-all rounded-lg p-3.5 leading-relaxed focus:ring-1 focus:ring-[#BD93F9]/50"
        />

        {/* Quick Suggestions / Frases de ejemplo */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 font-mono text-[10px]">Cargar ejemplos:</span>
          <button
            type="button"
            className="text-[10px] bg-[#16161C] border border-[#262635] text-zinc-400 hover:text-[#BD93F9] hover:border-[#BD93F9]/30 px-2.5 py-1 rounded transition-all cursor-pointer font-sans"
            onClick={() => setNlpText("Una fábrica de juguetes produce trenes y pelotas. Cada tren da una ganancia de $10 y cada pelota $8. Un tren requiere 2 horas de mecanizado y 1 hora de montaje. Una pelota requiere 1 hora de mecanizado y 3 horas de montaje. Se dispone de 40 horas de mecanizado y 60 horas de montaje por semana. Maximiza la utilidad total.")}
          >
            Fábrica de Juguetes (2 var)
          </button>
          <button
            type="button"
            className="text-[10px] bg-[#16161C] border border-[#262635] text-zinc-400 hover:text-[#BD93F9] hover:border-[#BD93F9]/30 px-2.5 py-1 rounded transition-all cursor-pointer font-sans"
            onClick={() => setNlpText("Minimizar el costo de una mezcla de alimento para granja. El alimento A cuesta $3 el kg y contiene 5% de ingrediente X, 10% de ingrediente Y. El alimento B cuesta $5 el kg y contiene 12% de ingrediente X, 8% de ingrediente Y. El requirimiento diario es de al menos 60g de ingrediente X y 45g de ingrediente Y. Formular el modelo.")}
          >
            Mezcla de Alimentos (2 var)
          </button>
          <button
            type="button"
            className="text-[10px] bg-[#16161C] border border-[#262635] text-zinc-400 hover:text-[#BD93F9] hover:border-[#BD93F9]/30 px-2.5 py-1 rounded transition-all cursor-pointer font-sans"
            onClick={() => setNlpText("Maximizar beneficio Z = 15X1 + 25X2 + 18X3 sujeto a las siguientes restricciones: R1: X1 + 2X2 + X3 <= 100, R2: 2X1 + X2 + 3X3 <= 150, R3: X1 + X3 <= 80.")}
          >
            Ecuaciones directas (3 var)
          </button>
        </div>

        {nlpError && (
          <div className="flex items-center gap-2 p-3 bg-[#2A1015] border border-[#C53030]/40 text-[#FF8585] rounded-lg text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#FF4949]" />
            <span>{nlpError}</span>
          </div>
        )}

        {nlpSuccess && (
          <div className="flex items-center gap-2 p-3 bg-[#102A1E] border border-[#1FA264]/40 text-[#00FF9C] rounded-lg text-xs font-mono">
            <Sparkles className="w-4 h-4 shrink-0 text-[#00FF9C]" />
            <span>¡Modelo extraído y cargado con éxito en los formularios inferiores!</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleNlpParse}
            disabled={nlpLoading}
            className="px-4 py-2 text-xs font-mono font-bold text-white bg-[#BD93F9] hover:bg-[#A78BFA] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-[#BD93F9]/10 rounded-lg transition-all cursor-pointer flex items-center gap-2"
          >
            {nlpLoading ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Procesando Enunciado...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Formular problema con IA</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CORE PARAMS AND SETUP */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#202020] pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#00FF9C]" />
            <h3 className="font-bold text-white text-base font-mono">Estructura del Modelo</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
            {/* Variables stepper */}
            <div className="flex items-center gap-2 bg-[#131313] border border-[#262626] px-2.5 py-1.5 rounded-lg">
              <span>Variables:</span>
              <button
                onClick={() => handleVarCountChange(config.numVars - 1)}
                disabled={config.numVars <= 2}
                className="p-1 hover:bg-[#262626] rounded disabled:opacity-30 cursor-pointer text-[#00FF9C]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-white px-1">{config.numVars}</span>
              <button
                onClick={() => handleVarCountChange(config.numVars + 1)}
                disabled={config.numVars >= 6}
                className="p-1 hover:bg-[#262626] rounded disabled:opacity-30 cursor-pointer text-[#00FF9C]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Restricciones stepper */}
            <div className="flex items-center gap-2 bg-[#131313] border border-[#262626] px-2.5 py-1.5 rounded-lg">
              <span>Restricciones:</span>
              <button
                onClick={() => handleConstraintCountChange(config.constraints.length - 1)}
                disabled={config.constraints.length <= 1}
                className="p-1 hover:bg-[#262626] rounded disabled:opacity-30 cursor-pointer text-[#00FF9C]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-white px-1">{config.constraints.length}</span>
              <button
                onClick={() => handleConstraintCountChange(config.constraints.length + 1)}
                disabled={config.constraints.length >= 10}
                className="p-1 hover:bg-[#262626] rounded disabled:opacity-30 cursor-pointer text-[#00FF9C]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* INPUT EQUATIONS SHEET */}
        <div className="space-y-6">
          {/* FUNCTION OBJECTIVE ROW */}
          <div className="space-y-2">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Función Objetivo</label>
            <div className="flex flex-wrap items-center gap-3 bg-[#131313] border border-[#262626] rounded-lg p-4">
              <select
                value={config.type}
                onChange={(e) => setConfig({ ...config, type: e.target.value as 'max' | 'min' })}
                className="bg-[#1C1C1C] border border-[#262626] text-[#00FF9C] text-xs font-bold rounded px-2.5 py-1.5 outline-none shrink-0 cursor-pointer font-mono uppercase"
              >
                <option value="max">MAXIMIZAR (Z)</option>
                <option value="min">MINIMIZAR (Z)</option>
              </select>
              <span className="text-zinc-500 font-bold text-xs font-mono">=</span>
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: config.numVars }).map((_, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span className="text-zinc-650 font-bold px-0.5 font-mono text-sm">+</span>}
                    <div className="inline-flex items-center border border-[#262626] rounded overflow-hidden bg-[#161616] max-w-[110px]">
                      <input
                        type="text"
                        value={config.objective[j] || '0'}
                        onChange={(e) => handleObjectiveCoeffChange(j, e.target.value)}
                        className="w-full text-center py-1 px-2 font-mono text-xs text-white focus:bg-[#222] outline-none"
                        placeholder="0"
                      />
                      <span className="bg-[#212121] border-l border-[#262626] px-2 py-1 text-[#00FF9C] font-mono text-[10px] font-bold select-none">
                        X{j + 1}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* CONSTRAINTS TABLE SHEET */}
          <div className="space-y-3">
            <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">Restricciones Estructurales</label>
            <div className="space-y-3">
              {config.constraints.map((c, cIdx) => (
                <div key={cIdx} className="flex flex-wrap items-center gap-3 bg-[#131313]/40 hover:bg-[#131313]/90 border border-[#262626] rounded-lg p-4 transition-all">
                  <span className="text-xs text-[#00FF9C] font-bold font-mono w-6">R{cIdx + 1}</span>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {Array.from({ length: config.numVars }).map((_, vIdx) => (
                      <React.Fragment key={vIdx}>
                        {vIdx > 0 && <span className="text-[#262626] font-mono text-sm font-semibold px-0.5">+</span>}
                        <div className="inline-flex items-center border border-[#262626] bg-[#161616] rounded overflow-hidden max-w-[105px]">
                          <input
                            type="text"
                            value={c.coeffs[vIdx] || '0'}
                            onChange={(e) => handleConstraintCoeffChange(cIdx, vIdx, e.target.value)}
                            className="w-full text-center py-1 px-2 font-mono text-xs text-white focus:bg-[#222] outline-none"
                            placeholder="0"
                          />
                          <span className="bg-[#212121] border-l border-[#262626] px-1.5 py-1 text-[#00FF9C] font-mono text-[10px] select-none font-bold">
                            X{vIdx + 1}
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 grow justify-between sm:justify-start">
                    {/* Condition Selector */}
                    <select
                      value={c.type}
                      onChange={(e) => handleConstraintTypeChange(cIdx, e.target.value as any)}
                      className="bg-[#1C1C1C] border border-[#262626] text-white text-xs font-bold rounded px-2.5 py-1.5 outline-none cursor-pointer font-mono"
                    >
                      <option value="<=">&le;&nbsp; (≤ Menor o Igual)</option>
                      <option value=">=">&ge;&nbsp; (≥ Mayor o Igual)</option>
                      <option value="=">=&nbsp;&nbsp; (= Igualdad)</option>
                    </select>

                    {/* RHS Input */}
                    <div className="inline-flex items-center border border-[#262626] bg-[#161616] rounded overflow-hidden max-w-[110px]">
                      <input
                        type="text"
                        value={c.rhs}
                        onChange={(e) => handleConstraintRhsChange(cIdx, e.target.value)}
                        className="w-full text-center py-1 px-2 font-mono font-bold text-xs text-white focus:bg-[#222] outline-none"
                        placeholder="RHS"
                      />
                      <span className="bg-[#212121] border-l border-[#262626] px-2 py-1 text-zinc-400 font-mono text-[10px] select-none font-bold">
                        RHS
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* NON-NEGATIVITY COMPLEMENT */}
        <div className="text-zinc-400 text-[11px] font-mono py-2.5 bg-[#131313] border border-[#262626] rounded-lg text-center font-semibold">
          {Array.from({ length: config.numVars }).map((_, idx) => `X${idx + 1}`).join(', ')} ≥ 0 &nbsp;(Restricciones de No Negatividad)
        </div>

        {/* ERROR BOX */}
        {errorMsg && (
          <div className="flex items-center gap-2 p-3 bg-[#2A1015] border border-[#C53030]/40 text-[#FF8585] rounded-lg text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#FF4949]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SUBMIT BUTTON BAR */}
        <div className="flex items-center justify-end gap-3 border-t border-[#202020] pt-4">
          <button
            onClick={() => {
              onReset();
              setErrorMsg(null);
            }}
            type="button"
            className="px-4 py-2 text-xs font-mono font-semibold text-zinc-400 hover:text-white border border-[#262626] hover:bg-[#161616] rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reestablecer
          </button>
          <button
            onClick={validateAndSolve}
            type="button"
            className="px-5 py-2 text-xs font-mono font-bold text-[#0A0A0A] bg-[#00FF9C] hover:bg-[#00D180] shadow-sm shadow-[#00FF9C]/10 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Calculator className="w-3.5 h-3.5" /> Resolver Modelo
          </button>
        </div>
      </div>
    </div>
  );
}
