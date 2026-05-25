import React from 'react';
import { Fraction } from '../lib/fraction';
import { RawConfig, OptimizationResult, SimplexIteration } from '../types';
import { ArrowRight, HelpCircle, AlertCircle, Sparkles } from 'lucide-react';

interface PasoAPasoProps {
  config: RawConfig;
  result: OptimizationResult;
}

const FractionDisplay = ({ val }: { val: Fraction }) => {
  if (val.den === 1) return <span className="font-mono text-zinc-100">{val.num}</span>;
  const isNeg = val.num < 0;
  const absNum = Math.abs(val.num);
  return (
    <span className="inline-flex items-center text-xs font-mono">
      {isNeg && <span className="mr-0.5 text-zinc-100 font-sans">-</span>}
      <sup className="text-[10px] text-[#00FF9C] font-semibold leading-tight mb-1">{absNum}</sup>
      <span className="text-zinc-600 mx-0.5 text-xs font-sans font-light">/</span>
      <sub className="text-[10px] text-zinc-400 font-semibold leading-tight mt-1">{val.den}</sub>
    </span>
  );
};

export default function PasoAPaso({ config, result }: PasoAPasoProps) {
  if (!result || !result.iterations || result.iterations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#262626] rounded-xl bg-[#0F0F0F]">
        <AlertCircle className="w-12 h-12 text-zinc-600 mb-3" />
        <p className="text-zinc-400 font-medium font-mono text-sm">Resuelve un problema primero para ver los tableros paso a paso.</p>
      </div>
    );
  }

  const baseIter = result.iterations[0];
  const finalIter = result.iterations[result.iterations.length - 1];

  // Render original linear program math equation
  const renderOriginalObjective = () => {
    let mathStr = `Z = `;
    config.objective.forEach((coeff, idx) => {
      const val = parseFloat(coeff) || 0;
      if (idx === 0) {
        mathStr += `${coeff}X₁`;
      } else {
        mathStr += ` ${val >= 0 ? '+' : '—'} ${Math.abs(val)}X${idx + 1}`;
      }
    });
    return mathStr;
  };

  const renderOriginalConstraints = () => {
    return config.constraints.map((c, cIdx) => {
      let line = '';
      c.coeffs.forEach((coeff, vIdx) => {
        const val = parseFloat(coeff) || 0;
        if (vIdx === 0) {
          line += `${coeff}X₁`;
        } else {
          line += ` ${val >= 0 ? '+' : '—'} ${Math.abs(val)}X${vIdx + 1}`;
        }
      });
      const sym = c.type === '<=' ? '≤' : c.type === '>=' ? '≥' : '=';
      return (
        <div key={cIdx} className="font-mono text-zinc-300 font-medium text-xs py-1.5 border-b border-[#1E1E1E] last:border-b-0">
          {line} <span className="font-sans font-extrabold text-[#00FF9C] mx-1">{sym}</span> {c.rhs}
        </div>
      );
    });
  };

  // Render Augmented Math Form
  const renderAugmentedObjective = () => {
    if (result.iterations.length === 0) return '';
    const iter0 = result.iterations[0];
    const vn = iter0.varNames;

    let objStr = 'Z';
    for (let j = 0; j < vn.length; j++) {
      const coeff = iter0.tableau[0][j + 1];
      if (!coeff.isZero()) {
        const sign = coeff.isPos() ? ' + ' : ' - ';
        const absCoeff = coeff.abs();
        const fStr = absCoeff.eq(1) ? '' : absCoeff.toString();
        objStr += `${sign}${fStr}${vn[j]}`;
      }
    }
    objStr += ' = 0';
    return objStr;
  };

  const renderAugmentedConstraints = () => {
    if (result.iterations.length === 0) return [];
    const iter0 = result.iterations[0];
    const vn = iter0.varNames;

    return iter0.basicVars.map((_, i) => {
      let line = '';
      let first = true;
      const rowIdx = i + 1;

      for (let j = 0; j < vn.length; j++) {
        const coeff = iter0.tableau[rowIdx][j + 1];
        if (!coeff.isZero()) {
          if (!first) {
            line += coeff.isPos() ? ' + ' : ' — ';
          } else {
            if (coeff.isNeg()) line += '—';
            first = false;
          }
          const absCoeff = coeff.abs();
          const fStr = absCoeff.eq(1) ? '' : absCoeff.toString();
          line += `${fStr}${vn[j]}`;
        }
      }

      const rhsVal = iter0.tableau[rowIdx][iter0.tableau[rowIdx].length - 1];
      return (
        <div key={i} className="font-mono text-zinc-300 font-medium text-xs py-1.5 border-b border-[#1E1E1E] last:border-b-0">
          {line} <span className="font-sans font-semibold text-[#00FF9C] mx-1.5">=</span> {rhsVal.toString()}
        </div>
      );
    });
  };

  return (
    <div className="space-y-8">
      {/* ORIGINAL & AUGMENTED WORKSPACES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ORIGINAL MODEL */}
        <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-[#202020] pb-3">
            <span className="p-1 px-2.5 bg-[#1C1C1C] rounded text-zinc-400 font-mono text-[10px] uppercase font-bold border border-[#262626]">LP</span>
            <h4 className="font-bold text-white text-sm font-mono">Formulación del Problema</h4>
          </div>
          <div className="p-4 bg-[#131313] border border-[#202020] rounded-lg space-y-3">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Función Objetivo</p>
            <p className="font-mono font-bold text-sm text-[#00FF9C]">
              {config.type === 'max' ? 'Maximizar' : 'Minimizar'} {renderOriginalObjective()}
            </p>
            <div className="h-px bg-[#202020] my-2" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Sujeto a:</p>
            <div className="space-y-1">
              {renderOriginalConstraints()}
            </div>
            <div className="pt-2 text-zinc-500 font-mono text-xs">
              {config.objective.map((_, idx) => `X${idx+1}`).join(', ')} ≥ 0
            </div>
          </div>
        </div>

        {/* AUGMENTED FORM STANDARD EQUATIONS */}
        <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-5 shadow-sm space-y-4 relative">
          <div className="absolute right-5 top-5 hidden sm:block">
            <div className="flex items-center gap-1.5 text-[9px] text-[#00FF9C] bg-[#102A1E] border border-[#1FA264]/40 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-[#00FF9C] shrink-0" /> Forma Estándar
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-[#202020] pb-3">
            <span className="p-1 px-2.5 bg-[#1C1C1C] rounded text-zinc-400 font-mono text-[10px] uppercase font-bold border border-[#262626]">LP+</span>
            <h4 className="font-bold text-white text-sm font-mono">Forma Aumentada</h4>
          </div>
          <div className="p-4 bg-[#131313] border border-[#202020] rounded-lg space-y-3">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Ecuación Objetivo (Fila 0)</p>
            <p className="font-mono font-bold text-sm text-[#BD93F9]">
              {renderAugmentedObjective()}
            </p>
            <div className="h-px bg-[#202020] my-2" />
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-mono">Restricciones Igualadas</p>
            <div className="space-y-1">
              {renderAugmentedConstraints()}
            </div>
            <div className="pt-2 text-zinc-500 font-mono text-xs">
              {result.iterations[0]?.varNames.join(', ')} ≥ 0
            </div>
          </div>
        </div>
      </div>

      {/* ITERATIVE TABLEAU SECTION */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-sm">
        <h3 className="font-bold text-white text-base font-mono mb-1">Tableros Simplex Paso a Paso</h3>
        <p className="text-zinc-400 text-xs mb-6 font-mono">Secuencia de tableros generados durante las iteraciones de pivotaje</p>

        <div className="space-y-10">
          {result.iterations.map((iter, idx) => {
            const isLast = idx === result.iterations.length - 1;
            const pmCol = iter.pivotCol;
            const pmRow = iter.pivotRow;
            const isDeg = iter.isDegenerado;

            return (
              <div key={iter.iteration} className="border border-[#262626] rounded-lg p-5 bg-[#131313]/30 space-y-5">
                {/* Tableau Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131313] border border-[#262626] rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-[#00FF9C] text-[#0A0A0A] text-xs font-mono font-bold px-2.5 py-1 rounded">
                      Iteración {iter.iteration}
                    </span>
                    {iter.operations && iter.operations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 font-mono">
                        <span className="font-semibold text-zinc-350">Operaciones:</span>
                        {iter.operations.map((op, opIdx) => (
                          <span key={opIdx} className="bg-[#1C1C1C] border border-[#262626] px-1.5 py-0.5 rounded font-mono font-medium text-white text-[10px] whitespace-nowrap">
                            {op}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    {iter.enteringVar && !isLast && (
                      <span className="text-zinc-400">
                        Entra: <span className="font-mono font-extrabold text-[#00FF9C] bg-[#102A1E] px-2 py-0.5 rounded border border-[#1FA264]/30">{iter.enteringVar}</span>
                      </span>
                    )}
                    {iter.leavingVar && !isLast && (
                      <span className="text-zinc-400">
                        Sale: <span className="font-mono font-extrabold text-[#FF79C6] bg-[#311723] px-2 py-0.5 rounded border border-[#FF79C6]/20">{iter.leavingVar}</span>
                      </span>
                    )}

                    {isLast && iter.isOptimal && (
                      <span className="text-xs bg-[#102A1E] border border-[#00FF9C]/30 text-[#00FF9C] px-2.5 py-1 rounded font-bold flex items-center gap-1">
                        ✓ Óptimo Alcanzado
                      </span>
                    )}
                    {isLast && !iter.isOptimal && result.status === 'unbounded' && (
                      <span className="text-xs bg-[#2A1015] border border-[#FF4949]/35 text-[#FF8585] px-2.5 py-1 rounded font-bold flex items-center gap-1">
                        ⚠ Solución No Acotada
                      </span>
                    )}
                    {isLast && !iter.isOptimal && result.status === 'infeasible' && (
                      <span className="text-xs bg-[#2A1015] border border-[#FF4949]/35 text-[#FF8585] px-2.5 py-1 rounded font-bold flex items-center gap-1">
                        ⚠ Problema Infactible
                      </span>
                    )}
                  </div>
                </div>

                {/* Tableau Table rendering */}
                <div className="overflow-x-auto border border-[#262626] rounded-lg bg-[#0F0F0F]">
                  <table className="w-full text-center border-collapse min-w-[650px] text-xs">
                    <thead>
                      <tr className="border-b border-[#262626] bg-[#131313] text-zinc-450 font-bold tracking-wider uppercase font-mono">
                        <th className="py-2.5 px-3 border-r border-[#262626]">Ec</th>
                        <th className="py-2.5 px-3 border-r border-[#262626]">Basic</th>
                        <th className="py-2.5 px-3 border-r border-[#262626]">Z</th>
                        {iter.varNames.map((n, vi) => {
                          const colId = vi + 1;
                          const isPivotCol = pmCol === colId && !isLast;
                          return (
                            <th key={n} className={`py-2.5 px-3 border-r border-[#262626] font-bold ${isPivotCol ? 'bg-[#122A1E] text-[#00FF9C] font-extrabold border-x border-[#00FF9C]/20' : ''}`}>
                              {n}
                            </th>
                          );
                        })}
                        <th className="py-2.5 px-3 border-r border-[#262626]">RHS (LD)</th>
                        {iter.ratios && !isLast && (
                          <th className="py-2.5 px-3 font-semibold bg-[#13111C]">Cociente (RHS/Y)</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1F1F1F] text-zinc-300 font-mono">
                      {/* Z optimal equation (Row 0) */}
                      <tr className="hover:bg-[#161616]/60 transition-colors bg-[#111] font-semibold text-zinc-200">
                        <td className="py-2 px-3 border-r border-[#262626] font-bold text-zinc-550">(0)</td>
                        <td className="py-2 px-3 border-r border-[#262626] font-extrabold text-[#BD93F9]">Z</td>
                        <td className="py-2 px-3 border-r border-[#262626]"><FractionDisplay val={iter.tableau[0][0]} /></td>
                        {iter.varNames.map((_, vi) => {
                          const colId = vi + 1;
                          const isPivotCol = pmCol === colId && !isLast;
                          return (
                            <td key={vi} className={`py-2 px-3 border-r border-[#262626] ${isPivotCol ? 'bg-[#122A1E]/40 font-semibold text-[#00FF9C] border-x border-[#00FF9C]/20' : ''}`}>
                              <FractionDisplay val={iter.tableau[0][colId]} />
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 border-r border-[#262626] font-bold text-white">
                          <FractionDisplay val={iter.tableau[0][iter.tableau[0].length - 1]} />
                        </td>
                        {iter.ratios && !isLast && (
                          <td className="py-2 px-3 bg-[#13111C]/25 text-zinc-600">—</td>
                        )}
                      </tr>

                      {/* Dec / Slack Constraints (Row 1..m) */}
                      {iter.basicVars.map((bVar, rIdx) => {
                        const fileId = rIdx + 1;
                        const isPivotRow = pmRow === fileId && !isLast;
                        const isRowDeg = iter.tableau[fileId][iter.tableau[fileId].length - 1].isZero();

                        return (
                          <tr key={rIdx} className={`hover:bg-[#161616]/40 transition-colors ${isPivotRow ? 'bg-[#291732] border-y border-[#BD93F9]/20' : ''} ${isRowDeg ? 'bg-[#151515]/30' : ''}`}>
                            <td className="py-2 px-3 border-r border-[#262626] font-medium text-zinc-500 font-mono">({fileId})</td>
                            <td className="py-2 px-3 border-r border-[#262626] font-bold text-zinc-200 bg-[#161616]/30">
                              {bVar || `—`}
                            </td>
                            {/* Z coefficient in restraints is always 0 */}
                            <td className="py-2 px-3 border-r border-[#262626] text-zinc-600">0</td>
                            {iter.varNames.map((_, vi) => {
                              const colId = vi + 1;
                              const isPivotCol = pmCol === colId && !isLast;
                              const isPivotCell = isPivotRow && isPivotCol;

                              return (
                                <td key={vi} className={`py-2 px-3 border-r border-[#262626] ${isPivotCell ? 'bg-[#BD93F9] text-[#0A0A0A] font-extrabold ring-2 ring-[#BD93F9]/30 rounded font-mono' : (isPivotCol ? 'bg-[#122A1E]/30 text-[#00FF9C] border-x border-[#00FF9C]/20' : (isPivotRow ? 'bg-[#291732]/20' : ''))}`}>
                                  <FractionDisplay val={iter.tableau[fileId][colId]} />
                                </td>
                              );
                            })}
                            <td className="py-2 px-3 border-r border-[#262626] font-bold text-white">
                              <FractionDisplay val={iter.tableau[fileId][iter.tableau[fileId].length - 1]} />
                            </td>
                            {iter.ratios && !isLast && (
                              <td className={`py-2 px-3 font-semibold ${isPivotRow ? 'bg-[#311B11] text-[#FF8000] font-bold' : 'bg-[#13111C]/35'}`}>
                                {iter.ratios[rIdx] !== null ? (
                                  <span className="flex items-center justify-center gap-1.5">
                                    <FractionDisplay val={iter.ratios[rIdx]} />
                                    {isPivotRow && <span className="text-[9px] bg-[#BD93F9] text-[#0A0A0A] px-1 py-0.2 rounded font-mono font-bold uppercase shrink-0">Pivote</span>}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600 font-sans font-light">—</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Arrow Flow line between Iterations */}
                {!isLast && (
                  <div className="flex justify-center pt-2 -mb-2">
                    <div className="p-1 px-3 bg-[#161616] border border-[#262626] rounded-lg shadow-inner flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Siguiente Iteración</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#00FF9C] animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* COMPACT HELP CARD */}
      <div className="flex gap-4 p-5 border border-[#262626] rounded-xl bg-[#0F0F0F] text-zinc-400 text-xs leading-relaxed font-sans">
        <HelpCircle className="w-5 h-5 text-[#00FF9C] shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-zinc-200 font-mono"><strong>¿Cómo leer un tablero Simplex?</strong></p>
          <p>La fila (0) contiene la función objetivo. La columna identificada en verde representa la <strong className="text-[#00FF9C]">variable de entrada</strong> (coeficiente más selectivo en fila Z).</p>
          <p>La fila identificada en morado marca la fila pivote de la <strong className="text-[#BD93F9]">variable de salida</strong> (calculada por el mínimo cociente positivo RHS/Y).</p>
          <p>La **celda morada clara** es el pivote exacto. Durante el pivoteo, esta celda se transforma en "1" multiplicando su fila completa, y se utiliza para eliminar y neutralizar los términos de su misma columna haciéndolos "0".</p>
        </div>
      </div>
    </div>
  );
}
