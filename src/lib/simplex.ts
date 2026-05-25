import { Fraction } from './fraction';
import { RawConfig, OptimizationResult, SimplexIteration } from '../types';

export class SimplexSolver {
  type: 'max' | 'min';
  numDecVars: number;
  origObjective: Fraction[];
  origConstraints: { coeffs: Fraction[]; type: string; rhs: Fraction }[];

  iterations: SimplexIteration[] = [];
  status: 'optimal' | 'unbounded' | 'infeasible' | 'multiple' | null = null;
  solution: { z: Fraction | null; variables: Record<string, Fraction> } | null = null;
  M = new Fraction(100000);
  useBigM = false;
  isMin = false;

  varNames: string[] = [];
  slackInfo: { row: number; name: string; type: 'slack' | 'surplus' }[] = [];
  artificialInfo: { row: number; name: string }[] = [];
  totalVars = 0;
  numCols = 0;
  rhsCol = 0;
  tableau: Fraction[][] = [];
  basicVars: (string | null)[] = [];
  objCoeffs: Fraction[] = [];
  constraints: { coeffs: Fraction[]; type: string; rhs: Fraction }[] = [];

  constructor(config: RawConfig) {
    this.type = config.type;
    this.numDecVars = config.numVars;
    this.origObjective = config.objective.map(v => Fraction.parse(v));
    this.origConstraints = config.constraints.map(c => ({
      coeffs: c.coeffs.map(v => Fraction.parse(v)),
      type: c.type,
      rhs: Fraction.parse(c.rhs),
    }));
  }

  solve(): OptimizationResult {
    // Copiar coeficientes objetivo
    this.objCoeffs = this.origObjective.map(c => c.clone());

    // Si es minimización, negamos el objetivo internamente para maximizar -Z
    this.isMin = this.type === 'min';
    if (this.isMin) {
      this.objCoeffs = this.objCoeffs.map(c => c.neg());
    }

    // Asegurar RHS no negativo
    this.constraints = this.origConstraints.map(c => {
      const nc = {
        coeffs: c.coeffs.map(v => v.clone()),
        type: c.type,
        rhs: c.rhs.clone(),
      };
      if (nc.rhs.isNeg()) {
        nc.coeffs = nc.coeffs.map(v => v.neg());
        nc.rhs = nc.rhs.neg();
        if (nc.type === '<=') {
          nc.type = '>=';
        } else if (nc.type === '>=') {
          nc.type = '<=';
        }
      }
      return nc;
    });

    this._buildAugmented();
    this._recordIteration(0);

    let iter = 1;
    const maxIter = 100;
    while (iter <= maxIter) {
      if (this._isOptimal()) {
        break;
      }
      const pivotCol = this._findPivotCol();
      if (pivotCol === -1) {
        this.status = 'optimal';
        break;
      }
      const pivotRow = this._findPivotRow(pivotCol);
      if (pivotRow === -1) {
        this.status = 'unbounded';
        this._recordIteration(iter);
        break;
      }
      this._pivot(pivotRow, pivotCol, iter);
      iter++;
    }

    if (this.status !== 'unbounded') {
      if (this._hasArtificialInBasis()) {
        this.status = 'infeasible';
      } else {
        this.status = 'optimal';
        this._checkMultipleOptimal();
      }
    }

    this._extractSolution();

    return {
      status: this.status || 'optimal',
      solution: this.solution || { z: null, variables: {} },
      iterations: this.iterations,
      metadata: {
        useBigM: this.useBigM,
        isDegenerado: this._checkDegeneracy(),
        numIterations: this.iterations.length,
        method: this.useBigM ? 'Big-M' : 'Simplex Estándar',
      },
    };
  }

  _buildAugmented() {
    const n = this.numDecVars;
    const m = this.constraints.length;

    this.varNames = [];
    for (let i = 0; i < n; i++) {
      this.varNames.push(`X${i + 1}`);
    }

    this.slackInfo = [];
    this.artificialInfo = [];
    this.useBigM = false;
    let sCount = 0;
    let aCount = 0;

    // Determinar variables adicionales por restricción
    for (let i = 0; i < m; i++) {
      const ct = this.constraints[i].type;
      if (ct === '<=') {
        sCount++;
        this.slackInfo.push({ row: i, name: `S${sCount}`, type: 'slack' });
        this.varNames.push(`S${sCount}`);
      } else if (ct === '>=') {
        sCount++;
        this.slackInfo.push({ row: i, name: `S${sCount}`, type: 'surplus' });
        this.varNames.push(`S${sCount}`);
        aCount++;
        this.artificialInfo.push({ row: i, name: `A${aCount}` });
        this.varNames.push(`A${aCount}`);
        this.useBigM = true;
      } else { // '='
        aCount++;
        this.artificialInfo.push({ row: i, name: `A${aCount}` });
        this.varNames.push(`A${aCount}`);
        this.useBigM = true;
      }
    }

    this.totalVars = this.varNames.length;
    const cols = 1 + this.totalVars + 1; // Z + variables + RHS
    this.numCols = cols;
    this.rhsCol = cols - 1;

    // Construir tablero
    this.tableau = [];

    // Fila 0 (objetivo): Z - c1X1 - c2X2 ... = 0
    const row0 = Array.from({ length: cols }, () => new Fraction(0));
    row0[0] = new Fraction(1);
    for (let j = 0; j < n; j++) {
      row0[1 + j] = this.objCoeffs[j].neg();
    }
    this.tableau.push(row0);

    // Filas de restricciones
    this.basicVars = [];
    for (let i = 0; i < m; i++) {
      const row = Array.from({ length: cols }, () => new Fraction(0));
      for (let j = 0; j < n; j++) {
        row[1 + j] = this.constraints[i].coeffs[j].clone();
      }
      row[this.rhsCol] = this.constraints[i].rhs.clone();
      this.tableau.push(row);
      this.basicVars.push(null);
    }

    // Ubicar coeficientes de slack/surplus
    let varIdx = n;
    for (const si of this.slackInfo) {
      const col = 1 + varIdx;
      if (si.type === 'slack') {
        this.tableau[si.row + 1][col] = new Fraction(1);
        this.basicVars[si.row] = si.name;
      } else {
        this.tableau[si.row + 1][col] = new Fraction(-1);
      }
      varIdx++;

      // Si es surplus, la artificial va en la siguiente columna
      if (si.type === 'surplus') {
        const ai = this.artificialInfo.find(a => a.row === si.row);
        if (ai) {
          const aCol = 1 + varIdx;
          this.tableau[si.row + 1][aCol] = new Fraction(1);
          this.basicVars[si.row] = ai.name;
          // Big-M en fila objetivo
          this.tableau[0][aCol] = this.M.clone();
          varIdx++;
        }
      }
    }

    // Variables artificiales para restricciones '='
    for (const ai of this.artificialInfo) {
      if (this.constraints[ai.row].type === '=') {
        const col = 1 + varIdx;
        this.tableau[ai.row + 1][col] = new Fraction(1);
        this.basicVars[ai.row] = ai.name;
        this.tableau[0][col] = this.M.clone();
        varIdx++;
      }
    }

    // Eliminar artificiales de fila 0 (hacer coeficiente 0 en columnas de artificiales básicas)
    for (const ai of this.artificialInfo) {
      const rowIdx = ai.row + 1;
      const colIdx = 1 + this.varNames.indexOf(ai.name);
      const factor = this.tableau[0][colIdx];
      if (!factor.isZero()) {
        for (let j = 0; j < cols; j++) {
          this.tableau[0][j] = this.tableau[0][j].sub(factor.mul(this.tableau[rowIdx][j]));
        }
      }
    }
  }

  _isOptimal(): boolean {
    for (let j = 1; j <= this.totalVars; j++) {
      if (this.tableau[0][j].isNeg()) {
        return false;
      }
    }
    return true;
  }

  _findPivotCol(): number {
    for (let j = 1; j <= this.totalVars; j++) {
      if (this.tableau[0][j].isNeg()) {
        return j;
      }
    }
    return -1;
  }

  _findPivotRow(pivotCol: number): number {
    const m = this.basicVars.length;
    let minRatio: Fraction | null = null;
    let minRow = -1;
    for (let i = 0; i < m; i++) {
      const val = this.tableau[i + 1][pivotCol];
      if (val.isPos()) {
        const ratio = this.tableau[i + 1][this.rhsCol].div(val);
        if (minRatio === null || ratio.lt(minRatio)) {
          minRatio = ratio;
          minRow = i + 1;
        }
      }
    }
    return minRow;
  }

  _computeRatios(pivotCol: number): (Fraction | null)[] {
    const m = this.basicVars.length;
    const ratios: (Fraction | null)[] = [];
    for (let i = 0; i < m; i++) {
      const val = this.tableau[i + 1][pivotCol];
      if (val.isPos()) {
        ratios.push(this.tableau[i + 1][this.rhsCol].div(val));
      } else {
        ratios.push(null);
      }
    }
    return ratios;
  }

  _pivot(pivotRow: number, pivotCol: number, iterNum: number) {
    const pivotElement = this.tableau[pivotRow][pivotCol].clone();
    const leavingVar = this.basicVars[pivotRow - 1];
    const enteringVar = this.varNames[pivotCol - 1];
    const ops: string[] = [];

    // Dividir fila pivote por elemento pivote
    if (!pivotElement.eq(1)) {
      for (let j = 0; j < this.numCols; j++) {
        this.tableau[pivotRow][j] = this.tableau[pivotRow][j].div(pivotElement);
      }
      ops.push(`R${pivotRow} = R${pivotRow} / ${pivotElement.toString()}`);
    }

    // Hacer ceros en la columna pivote
    const numRows = this.tableau.length;
    for (let i = 0; i < numRows; i++) {
      if (i === pivotRow) continue;
      const factor = this.tableau[i][pivotCol].clone();
      if (!factor.isZero()) {
        for (let j = 0; j < this.numCols; j++) {
          this.tableau[i][j] = this.tableau[i][j].sub(factor.mul(this.tableau[pivotRow][j]));
        }
        const sign = factor.isPos() ? '-' : '+';
        const absFactor = factor.abs();
        const fStr = absFactor.eq(1) ? '' : absFactor.toString() + ' · ';
        const rowLabel = i === 0 ? '(0)' : `(${i})`;
        ops.push(`${rowLabel} = ${rowLabel} ${sign} ${fStr}(${pivotRow})`);
      }
    }

    // Actualizar variable básica
    this.basicVars[pivotRow - 1] = enteringVar;

    this._recordIteration(iterNum, {
      pivotCol,
      pivotRow,
      pivotElement,
      enteringVar,
      leavingVar,
      operations: ops,
    });
  }

  _recordIteration(
    iterNum: number,
    pivotInfo: {
      pivotCol: number;
      pivotRow: number;
      pivotElement: Fraction;
      enteringVar: string;
      leavingVar: string | null;
      operations: string[];
    } | null = null
  ) {
    const optimal = this._isOptimal();

    let nextPivotCol: number | null = null;
    let nextPivotRow: number | null = null;
    let nextRatios: (Fraction | null)[] | null = null;
    let nextEntering: string | null = null;
    let nextLeaving: string | null = null;

    if (!optimal) {
      nextPivotCol = this._findPivotCol();
      if (nextPivotCol !== -1) {
        nextRatios = this._computeRatios(nextPivotCol);
        nextPivotRow = this._findPivotRow(nextPivotCol);
        nextEntering = this.varNames[nextPivotCol - 1];
        if (nextPivotRow !== -1) {
          nextLeaving = this.basicVars[nextPivotRow - 1];
        }
      }
    }

    const snapshot: SimplexIteration = {
      iteration: iterNum,
      varNames: [...this.varNames],
      basicVars: [...this.basicVars],
      tableau: this.tableau.map(row => row.map(v => v.clone())),
      pivotCol: nextPivotCol,
      pivotRow: nextPivotRow,
      pivotElement:
        nextPivotRow !== null && nextPivotCol !== null && nextPivotRow !== -1
          ? this.tableau[nextPivotRow][nextPivotCol].clone()
          : null,
      enteringVar: nextEntering,
      leavingVar: nextLeaving,
      ratios: nextRatios,
      operations: pivotInfo ? pivotInfo.operations : null,
      prevEntering: pivotInfo ? pivotInfo.enteringVar : null,
      prevLeaving: pivotInfo ? pivotInfo.leavingVar : null,
      isOptimal: optimal,
      isDegenerado: this._checkDegeneracy(),
    };

    this.iterations.push(snapshot);
  }

  _hasArtificialInBasis(): boolean {
    for (const bv of this.basicVars) {
      if (bv && bv.startsWith('A')) {
        const rowIdx = this.basicVars.indexOf(bv) + 1;
        if (!this.tableau[rowIdx][this.rhsCol].isZero()) {
          return true;
        }
      }
    }
    return false;
  }

  _checkDegeneracy(): boolean {
    const m = this.basicVars.length;
    for (let i = 0; i < m; i++) {
      if (this.tableau[i + 1][this.rhsCol].isZero()) {
        return true;
      }
    }
    return false;
  }

  _checkMultipleOptimal() {
    for (let j = 1; j <= this.totalVars; j++) {
      const vName = this.varNames[j - 1];
      if (!this.basicVars.includes(vName) && this.tableau[0][j].isZero() && !vName.startsWith('A')) {
        this.status = 'multiple';
        break;
      }
    }
  }

  _extractSolution() {
    if (this.status === 'unbounded' || this.status === 'infeasible') {
      this.solution = { z: null, variables: {} };
      return;
    }

    let zVal = this.tableau[0][this.rhsCol].clone();
    if (this.isMin) {
      zVal = zVal.neg();
    }

    const variables: Record<string, Fraction> = {};
    for (let i = 0; i < this.numDecVars; i++) {
      const vName = `X${i + 1}`;
      const bIdx = this.basicVars.indexOf(vName);
      variables[vName] = bIdx !== -1 ? this.tableau[bIdx + 1][this.rhsCol].clone() : new Fraction(0);
    }

    for (const si of this.slackInfo) {
      const bIdx = this.basicVars.indexOf(si.name);
      variables[si.name] = bIdx !== -1 ? this.tableau[bIdx + 1][this.rhsCol].clone() : new Fraction(0);
    }

    this.solution = { z: zVal, variables };
  }
}
