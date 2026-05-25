export type ConstraintType = '<=' | '>=' | '=';

export interface RawConstraint {
  coeffs: string[];
  type: ConstraintType;
  rhs: string;
}

export interface RawConfig {
  type: 'max' | 'min';
  numVars: number;
  objective: string[];
  constraints: RawConstraint[];
}

export interface OptimizationResult {
  status: 'optimal' | 'unbounded' | 'infeasible' | 'multiple';
  solution: {
    z: any | null; // Fraction
    variables: Record<string, any>; // Record<string, Fraction>
  };
  iterations: SimplexIteration[];
  metadata: {
    useBigM: boolean;
    isDegenerado: boolean;
    numIterations: number;
    method: string;
  };
}

export interface SimplexIteration {
  iteration: number;
  varNames: string[];
  basicVars: (string | null)[];
  tableau: any[][]; // Fraction[][]
  pivotCol: number | null;
  pivotRow: number | null;
  pivotElement: any | null; // Fraction | null
  enteringVar: string | null;
  leavingVar: string | null;
  ratios: (any | null)[] | null; // Fraction[] | null
  operations: string[] | null;
  prevEntering: string | null;
  prevLeaving: string | null;
  isOptimal: boolean;
  isDegenerado: boolean;
}

export interface ExamplePreset {
  id: number;
  title: string;
  description: string;
  type: 'max' | 'min';
  vars: number;
  constraintsCount: number;
  objective: string[];
  constraints: RawConstraint[];
}
