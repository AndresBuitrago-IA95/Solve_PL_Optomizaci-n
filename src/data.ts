import { ExamplePreset } from './types';

export const PRESETS: ExamplePreset[] = [
  {
    id: 1,
    title: "Maximización Estándar (Word Light)",
    description: "Tres restricciones de menor o igual (≤). Solución óptima convencional con variables de holgura.",
    type: "max",
    vars: 2,
    constraintsCount: 3,
    objective: ["1", "2"],
    constraints: [
      { coeffs: ["1", "3"], type: "<=", rhs: "200" },
      { coeffs: ["2", "2"], type: "<=", rhs: "300" },
      { coeffs: ["0", "1"], type: "<=", rhs: "60" }
    ]
  },
  {
    id: 2,
    title: "Optimización de Producción",
    description: "Maximizar utilidades sujeto a límites de capacidad unitaria y materia prima conjunta.",
    type: "max",
    vars: 2,
    constraintsCount: 3,
    objective: ["60", "30"],
    constraints: [
      { coeffs: ["1", "0"], type: "<=", rhs: "5" },
      { coeffs: ["0", "1"], type: "<=", rhs: "4" },
      { coeffs: ["6", "8"], type: "<=", rhs: "48" }
    ]
  },
  {
    id: 3,
    title: "Método Big-M (RESTRICCIÓN EN EXCESO ≥)",
    description: "Requiere agregar variables de excedente y variables artificiales penalizadas con una gran 'M' en el objetivo.",
    type: "max",
    vars: 2,
    constraintsCount: 3,
    objective: ["5", "4"],
    constraints: [
      { coeffs: ["6", "4"], type: "<=", rhs: "24" },
      { coeffs: ["1", "2"], type: "<=", rhs: "6" },
      { coeffs: ["1", "1"], type: ">=", rhs: "2" }
    ]
  },
  {
    id: 4,
    title: "Minimización Mix-Restricciones (Big-M)",
    description: "Minimizar costos sujeto a combinaciones de requerimientos de demanda mínima (≥) y límite físico (≤).",
    type: "min",
    vars: 2,
    constraintsCount: 3,
    objective: ["2", "3"],
    constraints: [
      { coeffs: ["1", "1"], type: ">=", rhs: "4" },
      { coeffs: ["1", "3"], type: ">=", rhs: "6" },
      { coeffs: ["1", "0"], type: "<=", rhs: "5" }
    ]
  },
  {
    id: 5,
    title: "Caso Especial: Problema Infactible",
    description: "Ocurre cuando las restricciones se contradicen mutuamente y no hay ninguna región admisible común.",
    type: "max",
    vars: 2,
    constraintsCount: 2,
    objective: ["1", "1"],
    constraints: [
      { coeffs: ["1", "1"], type: "<=", rhs: "4" },
      { coeffs: ["1", "1"], type: ">=", rhs: "6" }
    ]
  },
  {
    id: 6,
    title: "Caso Especial: Solución No Acotada",
    description: "La función objetivo puede crecer infinitamente porque la región factible está abierta / sin límites superiores.",
    type: "max",
    vars: 2,
    constraintsCount: 2,
    objective: ["2", "1"],
    constraints: [
      { coeffs: ["1", "-1"], type: "<=", rhs: "10" },
      { coeffs: ["1", "0"], type: ">=", rhs: "0" }
    ]
  }
];
