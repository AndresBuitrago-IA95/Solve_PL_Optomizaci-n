import React from 'react';
import { Fraction } from '../lib/fraction';
import { RawConfig, OptimizationResult } from '../types';
import { AlertCircle, HelpCircle, CheckCircle2, TrendingUp, Layers } from 'lucide-react';

interface AnalisisSensibilidadProps {
  config: RawConfig;
  result: OptimizationResult;
}

export default function AnalisisSensibilidad({ config, result }: AnalisisSensibilidadProps) {
  if (!result || !result.iterations || result.iterations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-[#262626] rounded-xl bg-[#0F0F0F]">
        <AlertCircle className="w-12 h-12 text-zinc-650 mb-3" />
        <p className="text-zinc-400 font-medium font-mono text-sm">Resuelve un problema primero para ver el análisis de sensibilidad.</p>
      </div>
    );
  }

  const finalIter = result.iterations[result.iterations.length - 1];
  if (!finalIter.isOptimal || result.status === 'unbounded' || result.status === 'infeasible') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-[#FF79C6]/25 rounded-xl bg-[#2A101A]">
        <AlertCircle className="w-12 h-12 text-[#FF79C6] mb-3" />
        <p className="text-zinc-300 font-mono text-sm max-w-sm">
          El Análisis de Sensibilidad sólo es válido para problemas con una solución óptima acotada y factible.
        </p>
      </div>
    );
  }

  const tableau = finalIter.tableau;
  const varNames = finalIter.varNames;
  const basicVars = finalIter.basicVars;
  const numDecVars = config.numVars;
  const numConstraints = config.constraints.length;
  const rhsCol = tableau[0].length - 1;
  const isMin = config.type === 'min';

  // Helper formatting function
  const formatFrac = (f: any) => {
    if (!f) return '—';
    const frac = f instanceof Fraction ? f : Fraction.parse(f);
    if (frac.den === 1) return `${frac.num}`;
    const dec = frac.toDecimal().toFixed(4).replace(/\.?0+$/, "");
    return `${frac.num}/${frac.den} (≈ ${dec})`;
  };

  // Helper for absolute range string formatted nicely
  const formatRange = (orig: Fraction, inc: string, decClass: string) => {
    let minStr = '—';
    let maxStr = '—';

    if (decClass === '∞') {
      minStr = '-∞';
    } else if (decClass === '—') {
      minStr = '—';
    } else {
      const decFrac = Fraction.parse(decClass);
      const val = orig.sub(decFrac);
      minStr = formatFrac(val);
    }

    if (inc === '∞') {
      maxStr = '∞';
    } else if (inc === '—') {
      maxStr = '—';
    } else {
      const incFrac = Fraction.parse(inc);
      const val = orig.add(incFrac);
      maxStr = formatFrac(val);
    }

    return `[ ${minStr} , ${maxStr} ]`;
  };

  // 1. Map constraints to slack/surplus column indices
  const constraintSlackMap: { slackName: string | null; slackColIdx: number; type: string }[] = [];
  let varPtr = numDecVars;

  for (let i = 0; i < numConstraints; i++) {
    const cType = config.constraints[i].type;
    if (cType === '<=') {
      const slackName = varNames[varPtr];
      const slackColIdx = varPtr + 1;
      constraintSlackMap.push({ slackName, slackColIdx, type: 'slack' });
      varPtr++;
    } else if (cType === '>=') {
      const surplusName = varNames[varPtr];
      const surplusColIdx = varPtr + 1;
      constraintSlackMap.push({ slackName: surplusName, slackColIdx: surplusColIdx, type: 'surplus' });
      varPtr += 2; // skip artificial
    } else {
      constraintSlackMap.push({ slackName: null, slackColIdx: -1, type: 'equality' });
      varPtr++; // skip artificial
    }
  }

  // 2. Identify non-basic columns (excluding artificials)
  const nonBasicCols: number[] = [];
  for (let j = 0; j < varNames.length; j++) {
    const vn = varNames[j];
    if (vn.startsWith('A')) continue;
    if (!basicVars.includes(vn)) {
      nonBasicCols.push(j + 1);
    }
  }

  // --- ANALYSIS OF DECISION VARIABLES ---
  interface DecVarInfo {
    name: string;
    optimalValue: Fraction;
    reducedCost: Fraction;
    origCoeff: Fraction;
    increase: string;
    decrease: string;
    absRange: string;
    isBasic: boolean;
  }

  const decVarsInfo: DecVarInfo[] = [];

  // Function to compute c_j range
  const computeObjRange = (colIdx: number, vName: string) => {
    const bIdx = basicVars.indexOf(vName);
    const rc = tableau[0][colIdx];

    if (bIdx === -1) {
      return {
        increase: rc.isZero() ? '0' : rc.abs().toString(),
        decrease: '∞',
      };
    }

    let minIncrease: Fraction | null = null;
    let minDecrease: Fraction | null = null;
    const basicRowIdx = bIdx + 1;

    for (const j of nonBasicCols) {
      const zj = tableau[0][j];
      const ykj = tableau[basicRowIdx][j];

      if (ykj.isZero()) continue;

      const ratio = zj.div(ykj);

      if (ykj.isPos()) {
        if (ratio.isPos() || ratio.isZero()) {
          if (minIncrease === null || ratio.lt(minIncrease)) {
            minIncrease = ratio;
          }
        }
      } else {
        const absRatio = ratio.abs();
        if (absRatio.isPos() || absRatio.isZero()) {
          if (minDecrease === null || absRatio.lt(minDecrease)) {
            minDecrease = absRatio;
          }
        }
      }
    }

    return {
      increase: minIncrease !== null ? minIncrease.toString() : '∞',
      decrease: minDecrease !== null ? minDecrease.toString() : '∞',
    };
  };

  for (let j = 0; j < numDecVars; j++) {
    const vName = `X${j + 1}`;
    const colIdx = j + 1;
    const bIdx = basicVars.indexOf(vName);
    const optimalValue = bIdx !== -1 ? tableau[bIdx + 1][rhsCol] : new Fraction(0);
    const reducedCost = tableau[0][colIdx];
    const origCoeff = Fraction.parse(config.objective[j]);

    const { increase, decrease } = computeObjRange(colIdx, vName);
    const absRange = formatRange(origCoeff, increase, decrease);

    decVarsInfo.push({
      name: vName,
      optimalValue,
      reducedCost,
      origCoeff,
      increase,
      decrease,
      absRange,
      isBasic: bIdx !== -1,
    });
  }

  // --- ANALYSIS OF CONSTRAINTS ---
  interface ConstraintInfo {
    id: number;
    slackName: string | null;
    origType: string;
    origRhs: Fraction;
    shadowPrice: Fraction;
    slackValue: Fraction;
    increase: string;
    decrease: string;
    absRange: string;
    isActive: boolean;
  }

  const constraintsInfo: ConstraintInfo[] = [];

  const findArtificialNameForConstraint = (cIdx: number) => {
    let aCount = 0;
    for (let i = 0; i <= cIdx; i++) {
      const ct = config.constraints[i].type;
      if (ct === '>=' || ct === '=') {
        aCount++;
      }
    }
    if (aCount === 0) return null;
    const aName = `A${aCount}`;
    return varNames.includes(aName) ? aName : null;
  };

  const computeRhsRange = (slackColIdx: number, type: string) => {
    if (slackColIdx === -1) {
      return { increase: '—', decrease: '—' };
    }

    let minIncrease: Fraction | null = null;
    let minDecrease: Fraction | null = null;
    const invertSign = type === 'surplus';

    for (let i = 0; i < basicVars.length; i++) {
      const rowIdx = i + 1;
      let coeff = tableau[rowIdx][slackColIdx];
      const rhsVal = tableau[rowIdx][rhsCol];

      if (invertSign) {
        coeff = coeff.neg();
      }

      if (coeff.isZero()) continue;

      const ratio = rhsVal.div(coeff);

      if (coeff.isPos()) {
        if (ratio.isPos() || ratio.isZero()) {
          if (minIncrease === null || ratio.lt(minIncrease)) {
            minIncrease = ratio;
          }
        }
      } else {
        const absRatio = ratio.abs();
        if (absRatio.isPos() || absRatio.isZero()) {
          if (minDecrease === null || absRatio.lt(minDecrease)) {
            minDecrease = absRatio;
          }
        }
      }
    }

    return {
      increase: minIncrease !== null ? minIncrease.toString() : '∞',
      decrease: minDecrease !== null ? minDecrease.toString() : '∞',
    };
  };

  for (let i = 0; i < numConstraints; i++) {
    const cMap = constraintSlackMap[i];
    const origRhs = Fraction.parse(config.constraints[i].rhs);
    const origType = config.constraints[i].type;

    let shadowPrice = new Fraction(0);
    let slackValue = new Fraction(0);

    if (cMap.slackColIdx !== -1) {
      shadowPrice = tableau[0][cMap.slackColIdx].clone();
      if (cMap.type === 'surplus') {
        shadowPrice = shadowPrice.neg();
      }
      if (isMin) {
        shadowPrice = shadowPrice.neg();
      }

      if (cMap.slackName) {
        const bIdx = basicVars.indexOf(cMap.slackName);
        slackValue = bIdx !== -1 ? tableau[bIdx + 1][rhsCol] : new Fraction(0);
      }
    } else {
      const artName = findArtificialNameForConstraint(i);
      if (artName) {
        const artIdx = varNames.indexOf(artName);
        if (artIdx !== -1) {
          shadowPrice = tableau[0][artIdx + 1].clone();
          if (isMin) {
            shadowPrice = shadowPrice.neg();
          }
        }
      }
    }

    const { increase, decrease } = computeRhsRange(cMap.slackColIdx, cMap.type);
    const absRange = formatRange(origRhs, increase, decrease);

    constraintsInfo.push({
      id: i + 1,
      slackName: cMap.slackName,
      origType,
      origRhs,
      shadowPrice,
      slackValue,
      increase,
      decrease,
      absRange,
      isActive: slackValue.isZero(),
    });
  }

  return (
    <div className="space-y-8">
      {/* SECTION 1: DECISION VARIABLES */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#202020] pb-4 mb-6">
          <div className="p-2 bg-[#13111C]/30 border border-[#262626] rounded-lg">
            <TrendingUp className="w-5 h-5 text-[#00FF9C]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base font-mono">Análisis en Variables de Decisión</h3>
            <p className="text-zinc-550 text-xs font-mono">Rango de optimalidad para los coeficientes de la función objetivo (c_j)</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left border-collapse min-w-[700px] text-xs">
            <thead>
              <tr className="border-b border-[#262626] text-zinc-450 uppercase font-mono font-bold tracking-wider">
                <th className="py-3 px-4">Variable</th>
                <th className="py-3 px-4">Valor Óptimo</th>
                <th className="py-3 px-4">Costo Reducido</th>
                <th className="py-3 px-4">Coef. Original</th>
                <th className="py-3 px-4">Max Incrementar</th>
                <th className="py-3 px-4">Max Decrementar</th>
                <th className="py-3 px-4">Rango [Mínimo, Máximo]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1C] text-zinc-350 font-mono">
              {decVarsInfo.map((info) => (
                <tr key={info.name} className="hover:bg-[#161616]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#00FF9C]">{info.name}</td>
                  <td className="py-3.5 px-4">{formatFrac(info.optimalValue)}</td>
                  <td className="py-3.5 px-4">
                    <span className={info.reducedCost.isZero() ? 'text-zinc-600' : 'text-[#FF79C6] bg-[#3B1226] border border-[#FF79C6]/20 px-1.5 py-0.5 rounded font-semibold'}>
                      {formatFrac(info.reducedCost)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{formatFrac(info.origCoeff)}</td>
                  <td className="py-3.5 px-4 text-zinc-400">{info.increase === '∞' ? '∞' : formatFrac(info.increase)}</td>
                  <td className="py-3.5 px-4 text-zinc-400">{info.decrease === '∞' ? '∞' : formatFrac(info.decrease)}</td>
                  <td className="py-3.5 px-4 font-bold text-[#BD93F9] whitespace-nowrap">{info.absRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HUMAN INTERPRETATION - VARIABLES */}
        <div className="mt-8 bg-[#13111C]/20 border border-[#202020] rounded-lg p-5 space-y-3.5 font-sans text-xs">
          <h4 className="font-bold text-white flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 text-[#00FF9C]" /> Interpretación de las Variables
          </h4>
          <ul className="list-disc pl-5 text-zinc-450 space-y-2.5">
            {decVarsInfo.map((info) => (
              <li key={info.name} className="leading-relaxed">
                <span className="font-bold text-white font-mono text-sm">{info.name}</span> es una variable{' '}
                {info.isBasic ? (
                  <>
                    <span className="text-[#00FF9C] font-semibold italic font-mono">básica</span> en la solución final, con
                    un valor óptimo de <span className="font-semibold text-zinc-200">{formatFrac(info.optimalValue)}</span>. Su coeficiente original
                    es <span className="font-semibold text-zinc-200">{formatFrac(info.origCoeff)}</span> y puede oscilar libremente en el rango{' '}
                    <span className="font-bold text-[#BD93F9] font-mono">{info.absRange}</span> sin cambiar la solución de óptimo físico.
                  </>
                ) : (
                  <>
                    <span className="text-zinc-500 font-semibold italic font-mono">no básica</span> (valor de 0).
                    {info.reducedCost.isZero() ? (
                      <> Su costo reducido es 0, lo que señala la existencia de múltiples soluciones óptimas alternativas.</>
                    ) : (
                      <> Su costo reducido es <span className="font-mono text-[#FF79C6] font-semibold">{formatFrac(info.reducedCost)}</span>. Para ser atractiva económicamente y entrar en la base, su coeficiente en el objetivo deber{isMin ? 'á disminuir' : 'á aumentar'} al menos en <span className="font-semibold text-[#00FF9C]">{formatFrac(info.reducedCost.abs())}</span> unidades.</>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* SECTION 2: CONSTRAINTS */}
      <div className="bg-[#0F0F0F] border border-[#262626] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 border-b border-[#202020] pb-4 mb-6">
          <div className="p-2 bg-[#13111C]/30 border border-[#262626] rounded-lg">
            <Layers className="w-5 h-5 text-[#BD93F9]" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base font-mono">Análisis en Restricciones</h3>
            <p className="text-zinc-550 text-xs font-mono">Precios sombra y rango de factibilidad del lado derecho (RHS)</p>
          </div>
        </div>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-left border-collapse min-w-[700px] text-xs">
            <thead>
              <tr className="border-b border-[#262626] text-zinc-450 uppercase font-mono font-bold tracking-wider">
                <th className="py-3 px-4">Restricción</th>
                <th className="py-3 px-4">Holgura / Exceso</th>
                <th className="py-3 px-4">Precio Sombra</th>
                <th className="py-3 px-4">RHS Original</th>
                <th className="py-3 px-4">Max Incrementar</th>
                <th className="py-3 px-4">Max Decrementar</th>
                <th className="py-3 px-4">Rango RHS [Mín, Máx]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C1C1C] text-zinc-350 font-mono">
              {constraintsInfo.map((info) => (
                <tr key={info.id} className="hover:bg-[#161616]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-zinc-200">R{info.id} ({info.origType})</td>
                  <td className="py-3.5 px-4">
                    {info.slackName ? (
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-xs text-zinc-500">({info.slackName}):</span>
                        <span className={info.slackValue.isZero() ? 'text-zinc-555 font-medium' : 'text-white font-bold'}>
                          {formatFrac(info.slackValue)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-555 font-medium">0</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={info.shadowPrice.isZero() ? 'text-zinc-600 font-mono' : 'text-[#00FF9C] bg-[#102A1E]/80 border border-[#00FF9C]/20 px-1.5 py-0.5 rounded font-bold font-mono'}>
                      {formatFrac(info.shadowPrice)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">{formatFrac(info.origRhs)}</td>
                  <td className="py-3.5 px-4 text-zinc-400">{info.increase === '—' ? '—' : (info.increase === '∞' ? '∞' : formatFrac(info.increase))}</td>
                  <td className="py-3.5 px-4 text-zinc-400">{info.decrease === '—' ? '—' : (info.decrease === '∞' ? '∞' : formatFrac(info.decrease))}</td>
                  <td className="py-3.5 px-4 font-bold text-[#00FF9C] whitespace-nowrap">{info.absRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* HUMAN INTERPRETATION - CONSTRAINTS */}
        <div className="mt-8 bg-[#13111C]/20 border border-[#202020] rounded-lg p-5 space-y-3.5 font-sans text-xs">
          <h4 className="font-bold text-white flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 text-[#BD93F9]" /> Interpretación de las Restricciones
          </h4>
          <ul className="list-disc pl-5 text-zinc-450 space-y-2.5">
            {constraintsInfo.map((info) => (
              <li key={info.id} className="leading-relaxed">
                <span className="font-bold text-white font-mono">Restricción R{info.id}</span>{' '}
                {info.isActive ? (
                  <>
                    es <span className="text-[#FF79C6] font-semibold font-mono">activa / vinculante</span> (holgura = 0). El recurso se consume al 100%. Su precio sombra es{' '}
                    <span className="font-bold text-[#00FF9C] font-mono">{formatFrac(info.shadowPrice)}</span>. Si aumentamos el recurso marginalmente en una unidad (RHS b_{info.id}), la función objetivo Z{' '}
                    <span className="font-semibold text-zinc-200">{info.shadowPrice.isPos() ? 'aumentará' : 'disminuirá'}</span> exactamente en {' '}
                    <span className="font-mono font-semibold text-zinc-200">{formatFrac(info.shadowPrice.abs())}</span> unidades. Esta relación es válida dentro del rango RHS{' '}
                    <span className="font-semibold text-[#00FF9C] font-mono">{info.absRange}</span>.
                  </>
                ) : (
                  <>
                    es <span className="text-zinc-500 font-medium italic font-mono font-bold">inactiva / no vinculante</span> con una holgura/exceso de{' '}
                    <span className="font-semibold text-zinc-200">{formatFrac(info.slackValue)}</span> redundante. Su precio sombra es 0, lo que significa que añadir más de este recurso no cambiará el óptimo de la función objetivo.
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* FOOTER GENERAL LEGEND */}
      <div className="flex gap-4 p-5 border border-[#262626] rounded-xl bg-[#0F0F0F] text-zinc-450 text-xs leading-relaxed font-sans">
        <HelpCircle className="w-5 h-5 text-[#00FF9C] shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-zinc-200 font-mono"><strong>Conceptos Clave de Sensibilidad:</strong></p>
          <p><strong>Costo Reducido:</strong> Costo marginal o penalidad de la función objetivo Z por forzar a una variable que actualmente es cero (no básica) a tomar un valor positivo.</p>
          <p><strong>Precio Sombra:</strong> Tasa de mejora de la función objetivo Z por cada unidad adicional que incrementemos en el lado derecho de una restricción activa (RHS).</p>
          <p><strong>Rango RHS [Mín, Máx]:</strong> Intervalo dentro del cual el precio sombra calculado se sostiene sin alterar la validez estructural de la base del modelo.</p>
        </div>
      </div>
    </div>
  );
}
