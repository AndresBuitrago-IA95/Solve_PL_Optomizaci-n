import React, { useState, useEffect } from 'react';
import { RawConfig, ExamplePreset } from '../types';
import { PRESETS } from '../data';
import { Settings2, Plus, Minus, Calculator, RotateCcw, BookOpen, AlertCircle, Sparkles, Key, Eye, EyeOff } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

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

  // Client-side Gemini API key states
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('NETLIFY_GEMINI_API_KEY') || '';
    if (savedKey) {
      setApiKeyInput(savedKey);
    }
  }, []);

  const saveApiKey = (key: string) => {
    setApiKeyInput(key);
    localStorage.setItem('NETLIFY_GEMINI_API_KEY', key);
  };

  const callClientSideParse = async (text: string, apiKeyToUse: string) => {
    const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Analiza el siguiente problema de programación lineal de entrada y extrae la función objetivo y las restricciones estructurales.
Reglas clave:
- Identifica las variables principales de decisión (generalmente representadas por X1, X2, etc., o definidas implícitamente por los productos, ej: mesas, sillas). Asigna X1, X2, X3, etc. en orden de aparición o relevancia.
- Determina el número total de variables de decisión ('numVars'). No debe exceder las 6 variables (preferiblemente de 2 a 4).
- Determina el tipo de función: 'max' o 'min'.
- Extrae los coeficientes de la función objetivo como un array de strings ('objective') alineados con X1, X2...
- Extrae cada restricción estructural de la siguiente manera:
  - 'coeffs': array de coeficientes correspondientes a cada variable de decisión. Si una variable no participa en la restricción, su coeficiente debe ser exactamente "0".
  - 'type': la desigualdad o relación (<=' | '>=' | '=').
  - 'rhs': el lado derecho ("right hand side") de la restricción como string de número entero, decimal o fraccionario.
- No incluyas restricciones de no negatividad (X_i >= 0) como restricciones estructurales (se manejan de forma implícita).
- Los coeficientes y números pueden representarse como enteros (ej: "3"), decimales (ej: "1.5") o fracciones (ej: "2/3").

Problema a parsear:
"${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              description: "Tipo de optimización: 'max' para maximizar, 'min' para minimizar Z",
            },
            numVars: {
              type: Type.INTEGER,
              description: "El número total de variables de decisión identificadas (ej. 2, 3, 4, etc.)",
            },
            objective: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Los coeficientes de las variables de decisión en la función objetivo, ej: ['3', '5'] para Z = 3X1 + 5X2",
            },
            constraints: {
              type: Type.ARRAY,
              description: "La lista de restricciones estructurales encontradas en el problema",
              items: {
                type: Type.OBJECT,
                properties: {
                  coeffs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Los coeficientes de cada variable en la restricción en orden X1, X2, X3... (debe tener el mismo tamaño que numVars)",
                  },
                  type: {
                     type: Type.STRING,
                    description: "El operador de la restricción: '<=' para menor o igual, '>=' para mayor o igual, '=' para igualdad",
                  },
                  rhs: {
                    type: Type.STRING,
                    description: "El lado derecho (RHS) de la restricción",
                  },
                },
                required: ["coeffs", "type", "rhs"],
              },
            },
          },
          required: ["type", "numVars", "objective", "constraints"],
        },
      },
    });

    let rawText = response.text?.trim() || "{}";
    // Strip markdown JSON code fence backticks if present
    if (rawText.startsWith("```json")) {
      rawText = rawText.substring(7);
      if (rawText.endsWith("```")) {
        rawText = rawText.substring(0, rawText.length - 3);
      }
      rawText = rawText.trim();
    } else if (rawText.startsWith("```")) {
      rawText = rawText.substring(3);
      if (rawText.endsWith("```")) {
        rawText = rawText.substring(0, rawText.length - 3);
      }
      rawText = rawText.trim();
    }

    return JSON.parse(rawText);
  };

  const handleNlpParse = async () => {
    if (!nlpText.trim()) {
      setNlpError("Por favor, introduce el texto del problema.");
      return;
    }
    setNlpLoading(true);
    setNlpError(null);
    setNlpSuccess(false);

    let data;
    try {
      // Intentar primero el endpoint de backend Express (por ejemplo, en el entorno local u host completo)
      const response = await fetch('/api/parse-lp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpText }),
      });

      if (!response.ok) {
        let errorMsgFromResponse = 'Server error response';
        try {
          const errData = await response.json();
          if (errData && errData.error) {
            errorMsgFromResponse = errData.error;
          }
        } catch (_) {}
        throw new Error(errorMsgFromResponse);
      }

      data = await response.json();
    } catch (err: any) {
      console.warn("Fallo el endpoint del servidor (normal en hosts estáticos o Netlify). Intentando cliente-side con API Key local...", err);
      
      const apiKeyToUse = apiKeyInput.trim() || ((import.meta as any).env.VITE_GEMINI_API_KEY || '').trim();
      if (!apiKeyToUse) {
        setNlpError(
          "El servidor de análisis con IA no está disponible o la aplicación se ejecuta de manera estática (como en Netlify). " +
          "Para activar la formulación por IA en entornos de hosting estático, se requiere que especifiques una API Key de Gemini. " +
          "Por favor, ingresa tu API Key en la sección 'Configurar API Key' abajo para usar Gemini directamente desde tu navegador de forma gratuita y segura."
        );
        setShowApiKeyInput(true);
        setNlpLoading(false);
        return;
      }

      try {
        data = await callClientSideParse(nlpText, apiKeyToUse);
      } catch (clientErr: any) {
        console.error("Error en llamada Gemini cliente-side:", clientErr);
        setNlpError(
          `Error al llamar a la API de Gemini desde el cliente: ${clientErr.message || "Verifica tu API Key e intenta nuevamente."}`
        );
        setNlpLoading(false);
        return;
      }
    }

    try {
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

        {/* Configuración de API Key para hosts estáticos (como Netlify) */}
        <div className="border-t border-[#2D2140]/60 pt-3.5 mt-2">
          <button
            type="button"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="text-[10px] text-zinc-400 hover:text-zinc-200 font-mono flex items-center gap-1.5 transition-all outline-none cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 text-[#BD93F9]" />
            <span>Configurar API Key de Gemini {apiKeyInput ? '✓' : '(Especial para Netlify)'}</span>
            <span className="text-[9px] text-[#BD93F9]/70">[{showApiKeyInput ? 'Ocultar' : 'Mostrar'}]</span>
          </button>

          {showApiKeyInput && (
            <div className="mt-3 bg-[#110D1D] border border-[#BD93F9]/20 rounded-lg p-3.5 space-y-2.5">
              <p className="text-[10px] text-zinc-400 leading-relaxed font-sans">
                Esta aplicación está alojada como servidor de archivos estáticos en esta URL (con Netlify).
                Dado que los hostings estáticos no tienen servidor activo de Node.js, para poder usar la 
                Inteligencia Artificial de Gemini, ingresa tu propia <strong>API Key</strong> de forma local. Tu clave se 
                guardará de manera segura solo dentro de tu propio navegador.
              </p>
              
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={apiKeyInput}
                    onChange={(e) => saveApiKey(e.target.value)}
                    placeholder="Escribe tu API Key (AIzaSy...)"
                    className="w-full text-xs font-mono pr-8 pl-3 py-1.5 bg-[#08060F] border border-[#2D2140] hover:border-[#BD93F9]/30 focus:border-[#BD93F9] outline-none text-zinc-200 placeholder-zinc-700 transition-all rounded-md focus:ring-1 focus:ring-[#BD93F9]/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:text-white text-zinc-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                
                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={() => saveApiKey('')}
                    className="px-2.5 py-1.5 bg-[#200A10] hover:bg-[#321019] text-[#FF8585] border border-[#C53030]/25 rounded-md text-[10px] font-mono transition-all cursor-pointer"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              <div className="text-[9px] text-zinc-500 font-sans flex justify-between items-center flex-wrap gap-2">
                <span>¿No sabes cómo obtener tu clave? Es totalmente gratis:</span>
                <a 
                  href="https://aistudio.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#BD93F9] hover:text-[#D5B8FF] hover:underline font-mono"
                >
                  Obtener API Key Gratis ↗
                </a>
              </div>
            </div>
          )}
        </div>

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
