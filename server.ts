import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI client (server side only)
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// NLP LP Parsing Endpoint
app.post("/api/parse-lp", async (req: express.Request, res: express.Response) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "El texto es obligatorio y debe ser un string" });
  }

  try {
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

    const parsedJson = JSON.parse(response.text?.trim() || "{}");
    res.json(parsedJson);
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    res.status(500).json({ error: error.message || "Error al procesar el texto con IA" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
