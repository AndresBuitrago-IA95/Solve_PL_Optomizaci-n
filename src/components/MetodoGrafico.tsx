import React, { useRef, useEffect, useState } from 'react';
import { Fraction } from '../lib/fraction';
import { RawConfig, OptimizationResult } from '../types';
import { Maximize2, Layers, Compass, HelpCircle, Eye, Sliders, AlertCircle } from 'lucide-react';

interface MetodoGraficoProps {
  config: RawConfig;
  result: OptimizationResult;
}

const GRAPH_COLORS = [
  '#00FF9C', // Neon Green/Lime
  '#38BDF8', // Cyber Cyan
  '#FF79C6', // Hot Magenta
  '#BD93F9', // Purple
  '#FBBF24', // Amber Glow
  '#F43F5E', // Rose Glow
  '#A78BFA', // Violet
  '#34D399', // Mint
];

// Subscript helpers
const getSubscript = (num: number) => {
  const subscripts = ['₀', '₁', '₂', '₃', '₄', '₅', '₆'];
  return subscripts[num] || String(num);
};

// Polygon clipping helper functions (ported to TS)
function clipPolygon(polygon: [number, number][], a: number, b: number, c: number, type: string): [number, number][] {
  if (polygon.length === 0) return polygon;
  const out: [number, number][] = [];

  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currVal = a * curr[0] + b * curr[1];
    const nextVal = a * next[0] + b * next[1];

    let currInside = false;
    let nextInside = false;

    if (type === '<=' || type === '=') {
      currInside = currVal <= c + 1e-9;
      nextInside = nextVal <= c + 1e-9;
    } else {
      currInside = currVal >= c - 1e-9;
      nextInside = nextVal >= c - 1e-9;
    }

    if (currInside && nextInside) {
      out.push(next);
    } else if (currInside && !nextInside) {
      out.push(intersect(curr, next, a, b, c));
    } else if (!currInside && nextInside) {
      out.push(intersect(curr, next, a, b, c));
      out.push(next);
    }
  }
  return out;
}

function intersect(p1: [number, number], p2: [number, number], a: number, b: number, c: number): [number, number] {
  const d1 = a * p1[0] + b * p1[1] - c;
  const d2 = a * p2[0] + b * p2[1] - c;
  const t = d1 / (d1 - d2);
  return [
    p1[0] + t * (p2[0] - p1[0]),
    p1[1] + t * (p2[1] - p1[1])
  ];
}

function getLinePoints(a1: number, a2: number, b: number, maxX1: number, maxX2: number): [number, number][] {
  const pts: [number, number][] = [];
  if (a2 !== 0) {
    const y0 = b / a2;
    if (y0 >= 0 && y0 <= maxX2 * 2) {
      pts.push([0, y0]);
    }
    const yMax = (b - a1 * maxX1) / a2;
    if (yMax >= 0 && yMax <= maxX2 * 2) {
      pts.push([maxX1, yMax]);
    }
  }
  if (a1 !== 0) {
    const x0 = b / a1;
    if (x0 >= 0 && x0 <= maxX1 * 2) {
      pts.push([x0, 0]);
    }
    if (a2 !== 0) {
      const xMax = (b - a2 * maxX2) / a1;
      if (xMax >= 0 && xMax <= maxX1 * 2) {
        pts.push([xMax, maxX2]);
      }
    }
  }
  if (a1 === 0 && a2 !== 0) {
    const y = b / a2;
    pts.length = 0;
    pts.push([0, y], [maxX1, y]);
  }
  if (a2 === 0 && a1 !== 0) {
    const x = b / a1;
    pts.length = 0;
    pts.push([x, 0], [x, maxX2]);
  }
  return pts.slice(0, 2) as [number, number][];
}

export default function MetodoGrafico({ config, result }: MetodoGraficoProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  const getOptimalVal = (varIndex: number): number => {
    if (!result || !result.solution || !result.solution.variables) return 0;
    const name = `X${varIndex}`;
    const f = result.solution.variables[name];
    return f ? f.toDecimal() : 0;
  };

  if (config.numVars !== 2) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#262626] rounded-xl bg-[#0F0F0F]">
        <AlertCircle className="w-12 h-12 text-zinc-600 mb-3" />
        <h4 className="font-bold text-white mb-1 font-mono text-sm uppercase">Método Gráfico No Disponible</h4>
        <p className="text-zinc-500 text-xs max-w-sm font-sans">
          El método gráfico está diseñado únicamente para problemas con exactamente 2 variables de decisión. Su modelo actual utiliza {config.numVars} variables.
        </p>
      </div>
    );
  }

  // Convert constraints to local 2D (Sutherland-Hodgman)
  const constraints = config.constraints.map(c => {
    const a1 = parseFloat(c.coeffs[0]) || 0;
    const a2 = parseFloat(c.coeffs[1]) || 0;
    const rhsVal = parseFloat(c.rhs) || 0;

    return {
      a1,
      a2,
      type: c.type,
      b: rhsVal,
      originalCoeffs: c.coeffs,
      originalRhs: c.rhs
    };
  });

  const c1 = parseFloat(config.objective[0]) || 0;
  const c2 = parseFloat(config.objective[1]) || 0;

  // Let's make sure limits are safe and dynamic
  let maxX1 = 10;
  let maxX2 = 10;

  constraints.forEach(c => {
    if (c.a1 !== 0) maxX1 = Math.max(maxX1, (c.b / c.a1) * 1.25);
    if (c.a2 !== 0) maxX2 = Math.max(maxX2, (c.b / c.a2) * 1.25);
    if (c.a1 === 0 && c.a2 !== 0) maxX2 = Math.max(maxX2, (c.b / c.a2) * 1.35);
    if (c.a2 === 0 && c.a1 !== 0) maxX1 = Math.max(maxX1, (c.b / c.a1) * 1.35);
  });

  const optX1 = getOptimalVal(1);
  const optX2 = getOptimalVal(2);
  maxX1 = Math.max(maxX1, optX1 * 1.5);
  maxX2 = Math.max(maxX2, optX2 * 1.5);

  const idealStep = Math.max(1, Math.round(Math.max(maxX1, maxX2) / 10));
  const roundedStep = idealStep <= 1 ? 1 : idealStep <= 2 ? 2 : idealStep <= 5 ? 5 : Math.ceil(idealStep / 10) * 10;

  maxX1 = roundedStep * 10;
  maxX2 = roundedStep * 10;

  // Clip polygon region
  let region: [number, number][] = [
    [0, 0],
    [maxX1 * 2, 0],
    [maxX1 * 2, maxX2 * 2],
    [0, maxX2 * 2]
  ];

  region = clipPolygon(region, 1, 0, 0, '>=');
  region = clipPolygon(region, 0, 1, 0, '>=');

  constraints.forEach(c => {
    region = clipPolygon(region, c.a1, c.a2, c.b, c.type);
  });

  const feasibleVertices = region.filter(v => v[0] >= -1e-6 && v[1] >= -1e-6 && v[0] <= maxX1 * 1.5 && v[1] <= maxX2 * 1.5);

  useEffect(() => {
    const rObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      const rawSize = Math.max(400, Math.min(800, width));
      setDimensions({ width: rawSize, height: rawSize });
    });

    if (containerRef.current) {
      rObserver.observe(containerRef.current);
    }

    return () => rObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = dimensions.width;
    const H = dimensions.height;
    const pad = 65;

    const toCanvasX = (x: number) => pad + (x / maxX1) * (W - 2 * pad);
    const toCanvasY = (y: number) => H - pad - (y / maxX2) * (H - 2 * pad);

    // 1. Clear background
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#101010';
    ctx.fillRect(pad, pad, W - 2 * pad, H - 2 * pad);

    // 2. Draw minor Grid Lines
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    const gridStepX = roundedStep;
    const gridStepY = roundedStep;

    for (let x = 0; x <= maxX1; x += gridStepX) {
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), pad);
      ctx.lineTo(toCanvasX(x), H - pad);
      ctx.stroke();
    }
    for (let y = 0; y <= maxX2; y += gridStepY) {
      ctx.beginPath();
      ctx.moveTo(pad, toCanvasY(y));
      ctx.lineTo(W - pad, toCanvasY(y));
      ctx.stroke();
    }

    // 3. Draw Feasible Region
    if (feasibleVertices.length >= 3) {
      ctx.fillStyle = 'rgba(0, 255, 156, 0.09)';
      ctx.strokeStyle = '#00FF9C';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(toCanvasX(feasibleVertices[0][0]), toCanvasY(feasibleVertices[0][1]));
      for (let i = 1; i < feasibleVertices.length; i++) {
        ctx.lineTo(toCanvasX(feasibleVertices[i][0]), toCanvasY(feasibleVertices[i][1]));
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 4. Draw primary axes
    ctx.strokeStyle = '#8E8E93';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad - 2, H - pad);
    ctx.lineTo(W - pad + 10, H - pad);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pad, H - pad + 2);
    ctx.lineTo(pad, pad - 10);
    ctx.stroke();

    // Axes Ticks & Labels
    ctx.fillStyle = '#A0A0A5';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';

    for (let x = 0; x <= maxX1; x += gridStepX) {
      ctx.fillText(String(x), toCanvasX(x), H - pad + 18);
      ctx.beginPath();
      ctx.moveTo(toCanvasX(x), H - pad);
      ctx.lineTo(toCanvasX(x), H - pad + 4);
      ctx.stroke();
    }

    ctx.textAlign = 'right';
    for (let y = 0; y <= maxX2; y += gridStepY) {
      ctx.fillText(String(y), pad - 8, toCanvasY(y) + 4);
      ctx.beginPath();
      ctx.moveTo(pad - 4, toCanvasY(y));
      ctx.lineTo(pad, toCanvasY(y));
      ctx.stroke();
    }

    // Axes Arrows
    ctx.fillStyle = '#8E8E93';
    ctx.beginPath();
    ctx.moveTo(W - pad + 10, H - pad - 4);
    ctx.lineTo(W - pad + 18, H - pad);
    ctx.lineTo(W - pad + 10, H - pad + 4);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pad - 4, pad - 10);
    ctx.lineTo(pad, pad - 18);
    ctx.lineTo(pad + 4, pad - 10);
    ctx.fill();

    // Dynamic Axis Labels
    ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`X${getSubscript(1)}`, W - pad + 22, H - pad + 4);
    ctx.fillText(`X${getSubscript(2)}`, pad, pad - 26);

    // 5. Draw constraints lines
    constraints.forEach((c, idx) => {
      const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
      const pts = getLinePoints(c.a1, c.a2, c.b, maxX1, maxX2);

      if (pts.length === 2) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(pts[0][0]), toCanvasY(pts[0][1]));
        ctx.lineTo(toCanvasX(pts[1][0]), toCanvasY(pts[1][1]));
        ctx.stroke();
      }
    });

    // 6. Draw Vertices as soft dots
    feasibleVertices.forEach(v => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(toCanvasX(v[0]), toCanvasY(v[1]), 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Label coordinate text
      ctx.fillStyle = '#8A8A8F';
      ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'left';
      const label = `(${v[0].toFixed(1).replace(/\.0$/, '')}, ${v[1].toFixed(1).replace(/\.0$/, '')})`;
      ctx.fillText(label, toCanvasX(v[0]) + 8, toCanvasY(v[1]) - 5);
    });

    // 7. Iso-Z Target and Line
    if (result.solution && result.solution.variables) {
      const x1val = getOptimalVal(1);
      const x2val = getOptimalVal(2);
      const zOpt = c1 * x1val + c2 * x2val;

      const objPts = getLinePoints(c1, c2, zOpt, maxX1, maxX2);
      if (objPts.length === 2) {
        ctx.strokeStyle = '#BD93F9';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(toCanvasX(objPts[0][0]), toCanvasY(objPts[0][1]));
        ctx.lineTo(toCanvasX(objPts[1][0]), toCanvasY(objPts[1][1]));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Purple Target Point
      const targetX = toCanvasX(x1val);
      const targetY = toCanvasY(x2val);

      ctx.strokeStyle = 'rgba(189, 147, 249, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(targetX, targetY, 11, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#BD93F9';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 2, 0, Math.PI * 2);
      ctx.fill();

      const textX = targetX > W / 2 ? targetX - 142 : targetX + 16;
      const textY = targetY > H / 2 ? targetY - 26 : targetY + 26;

      ctx.fillStyle = 'rgba(15, 15, 15, 0.95)';
      ctx.fillRect(textX - 8, textY - 14, 134, 42);
      ctx.strokeStyle = '#BD93F9';
      ctx.lineWidth = 1.25;
      ctx.strokeRect(textX - 8, textY - 14, 134, 42);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText('ÓPTIMO:', textX, textY);
      ctx.font = '9px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(`X* = (${x1val.toFixed(2).replace(/\.00+$/, '')}, ${x2val.toFixed(2).replace(/\.00+$/, '')})`, textX, textY + 12);
      ctx.fillText(`Z  = ${zOpt.toFixed(2).replace(/\.00+$/, '')}`, textX, textY + 24);
    }
  }, [dimensions, constraints, c1, c2, result]);

  return (
    <div className="space-y-8">
      {/* 2D VARIABLES PANEL */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#202020] pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-[#00FF9C]" />
            <h3 className="font-bold text-white font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              Solución Óptima del Modelo en el Gráfico
            </h3>
          </div>
          <span className="text-[10px] bg-[#BD93F9]/10 text-[#BD93F9] border border-[#BD93F9]/20 px-2.5 py-1 rounded font-mono font-bold self-start sm:self-auto">
            Resolución Gráfica (2D)
          </span>
        </div>

        <p className="text-xs text-zinc-400 font-sans leading-relaxed">
          A continuación se presenta el gráfico del espacio dimensional del problema. Las líneas representan las restricciones y el área sombreada en verde corresponde a la <strong>región de soluciones factibles</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {[1, 2].map(v => {
            const isX = v === 1;
            const optVal = getOptimalVal(v);

            return (
              <div
                key={v}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                  isX
                    ? 'bg-[#00FF9C]/5 border-[#00FF9C]/30 shadow-md shadow-[#00FF9C]/2'
                    : 'bg-sky-500/5 border-sky-400/30 shadow-md shadow-sky-400/2'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono text-xs">
                    Variable X{getSubscript(v)}
                  </span>
                  {isX ? (
                    <span className="text-[9px] bg-[#00FF9C]/15 border border-[#00FF9C]/35 text-[#00FF9C] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                      Eje Horizontal (X₁)
                    </span>
                  ) : (
                    <span className="text-[9px] bg-sky-500/15 border border-sky-400/35 text-sky-400 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                      Eje Vertical (X₂)
                    </span>
                  )}
                </div>

                {/* Values Info */}
                <div className="grid grid-cols-1 gap-2 text-xs font-mono border-t border-[#202020] pt-2">
                  <div className="space-y-0.5">
                    <span className="text-zinc-500 block text-[9px] uppercase tracking-wider">Valor de la Solución Óptima:</span>
                    <span className="text-white font-bold text-base">{optVal.toFixed(4).replace(/\.?0+$/, '')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* CANVAS CONTAINER */}
        <div className="lg:col-span-8 bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-sm flex flex-col items-center overflow-hidden" ref={containerRef}>
          <div className="w-full flex items-center justify-between mb-4 border-b border-[#202020] pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#00FF9C]" />
              <h3 className="font-bold text-white font-mono text-sm uppercase">Polígono de Factibilidad</h3>
            </div>
            <span className="text-[10px] bg-[#1C1C1C] px-2.5 py-1 rounded text-[#00FF9C] font-semibold border border-[#262626] font-mono">
              Escala: {roundedStep} unidades / cuadr.
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="border border-[#262626] rounded bg-[#090909] max-w-full"
          />
        </div>

        {/* DETAILED LEGEND & EXPLANATIONS */}
        <div className="lg:col-span-4 space-y-6">
          {/* CONSTRAINTS DIALOGUE */}
          <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00FF9C]" /> Restricciones
            </h4>
            <div className="space-y-3">
              {constraints.map((c, idx) => {
                const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
                const sym = c.type === '<=' ? '≤' : c.type === '>=' ? '≥' : '=';
                return (
                  <div key={idx} className="flex flex-col gap-1 py-2.5 border-b border-[#1E1E1E] last:border-b-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-3.5 h-3.5 rounded block shrink-0 border border-[#262626]" style={{ backgroundColor: color }} />
                        <span className="font-bold text-white text-xs font-mono">
                          Restricción R{idx + 1}:
                        </span>
                      </div>
                      <span className="font-mono text-[#00FF9C] font-bold text-xs">
                        {sym} {c.b.toFixed(2).replace(/\.00$/, '')}
                      </span>
                    </div>
                    {/* Show formula expression in 2D and context */}
                    <div className="pl-6.5 text-[10px] text-zinc-500 font-mono flex items-center justify-between">
                      <span>
                        {c.a1 !== 0 && `${c.a1}X${getSubscript(1)}`}
                        {c.a2 !== 0 && ` ${c.a2 >= 0 ? '+' : ''} ${c.a2}X${getSubscript(2)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {result.solution && result.solution.variables && (
                <div className="flex items-center justify-between py-1.5 border-b border-[#1E1E1E] last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-1 block border-t-2 border-dashed border-[#BD93F9] shrink-0" />
                    <span className="font-bold text-[#BD93F9] text-xs font-mono">Z (Iso-Z Óptima)</span>
                  </div>
                  <span className="font-mono text-[#BD93F9] text-xs font-semibold">
                    {c1}X₁ + {c2}X₂ = {(c1 * optX1 + c2 * optX2).toFixed(2).replace(/\.00$/, '')}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between py-1.5 border-b border-[#1E1E1E] last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 bg-emerald-500/10 border border-emerald-500/35 block shrink-0 rounded" />
                  <span className="font-medium text-emerald-400 text-xs font-mono">Región Factible</span>
                </div>
                <span className="text-zinc-550 text-[10px] text-right font-mono">Admisión admisible</span>
              </div>
            </div>
          </div>

          {/* COMPREHENSIVE TEXT METADATA */}
          {result.solution && result.solution.variables && (
            <div className="bg-[#0D0D0D] border border-[#BD93F9]/20 rounded-xl p-5 shadow-lg text-zinc-100 space-y-4">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#00FF9C]" /> Vértices Factibles Detectados
              </h4>
              <div className="space-y-3.5 font-mono">
                <div className="flex justify-between items-center py-2 border-b border-[#1A1A1A] text-xs">
                  <span className="text-zinc-500 uppercase tracking-widest text-[9px]">Función Objetivo</span>
                  <span className="font-semibold text-zinc-350">
                    {config.type === 'max' ? 'Maximizar' : 'Minimizar'} Z
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 text-[9px] uppercase tracking-widest block mb-1">Nivel Óptimo final (Z*)</span>
                  <p className="text-2xl font-bold text-[#00FF9C]">
                    {result.solution.z?.toString()}
                    <span className="text-xs text-zinc-500 font-normal ml-2 font-sans">
                      (≈ {result.solution.z?.toDecimal().toFixed(4).replace(/\.00$/, '')})
                    </span>
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#121212] border border-[#202020] p-2.5 rounded">
                    <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider font-sans">Variable X₁</span>
                    <p className="text-sm font-bold text-zinc-200">
                      {optX1.toFixed(4).replace(/\.?0+$/, '')}
                    </p>
                  </div>
                  <div className="bg-[#121212] border border-[#202020] p-2.5 rounded">
                    <span className="text-zinc-400 text-[9px] uppercase font-bold tracking-wider font-sans">Variable X₂</span>
                    <p className="text-sm font-bold text-zinc-200">
                      {optX2.toFixed(4).replace(/\.?0+$/, '')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HOW TO INTERPRET HIGHLIGHTS */}
          <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-5 text-zinc-450 text-xs leading-relaxed space-y-2 font-sans">
            <HelpCircle className="w-4 h-4 text-[#00FF9C] mb-1" />
            <p className="text-zinc-200 font-mono"><strong>Interpretación del Gráfico</strong></p>
            <p>La línea discontinua de color morado representa la <strong>función objetivo</strong> con el valor óptimo. El punto óptimo final se resalta con un círculo morado doble, demostrando cuál de los vértices del polígono maximiza o minimiza el nivel Z.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
