# Manual de Usuario: Solver de Programación Lineal Inteligente

¡Bienvenido al **Solver de Programación Lineal Inteligente**! Esta es una plataforma full-stack interactiva diseñada para formular, resolver e interpretar problemas de optimización lineal utilizando el **Método Simplex** y el **Método de la M Grande (Big M)** para variables artificiales, ofreciendo visualizaciones geométricas dinámicas (2D) y análisis detallados de sensibilidad económica.

---

## 🚀 Características Principales

1. **Formulación Dinámica Manual:**
   - Define el tipo de objetivo (`Maximizar` o `Minimizar`).
   - Ajusta dinámicamente el número de variables de decisión (desde $2$ hasta $6$ variables).
   - Añade y elimina restricciones estructurales al instante.
   - Introduce coeficientes numéricos en formato de enteros, flotantes/decimales (p. ej. `1.5`) o cómodas fracciones exactas (p. ej. `1/3` o `4/5`).

2. **Formulación con Inteligencia Artificial (IA - Gemini):**
   - Escribe el problema descriptivo en lenguaje natural (ej. problemas clásicos de mezcla, producción o logística).
   - El sistema analiza automáticamente el texto mediante **Google Gemini (gemini-3.5-flash)** para poblar instantáneamente el objetivo, las variables y las restricciones del modelo.

3. **Compatibilidad Estática y Local:**
   - Incluye soporte dual para llamadas seguras de backend y procesamiento directo desde el cliente (con almacenamiento seguro en el navegador) mediante API Keys de Gemini. ¡Ideal para despliegues estáticos como **Netlify**!

4. **Iteraciones Simplex Detalladas:**
   - Tablas interactivas completas paso por paso.
   - Resalto visual de la **Fila Pivote**, **Columna Pivote** e **Elemento Pivote**.
   - Explicación intuitiva de la variable que ingresa y la variable que sale de la base.

5. **Análisis de Sensibilidad Económica:**
   - Tabla de Variables de Decisión (*Costos Reducidos* y rango de variabilidad admisible para los coeficientes $c_j$).
   - Tabla de Restricciones (*Precios Sombra* o valor marginal de los recursos y rangos de estabilidad del lado derecho $b_j$ o RHS).

6. **Método Gráfico Interactivo (2D):**
   - Graficador interactivo diseñado para modelos con 2 variables.
   - Resaltado de la **Región Factible** (polígono de soluciones válidas).
   - **Línea de la Función Objetivo (Isocoste / Isoganancia)** interactiva mediante un control deslizante (*slider*) para ver cómo se maximiza o minimiza el valor de $Z$ visualmente en los vértices del polígono convexo.

---

## 🛠️ Cómo Utilizar el Aplicativo

### Paso 1: Formular el Problema

Tienen dos métodos para plasmar el modelo matemático:

#### Opción A: Formulación Manual
1. Selecciona si deseas **Maximizar (Max)** o **Minimizar (Min)** el valor del objetivo $Z$.
2. Utiliza los controles `+` and `-` en la sección "Variables de decisión" para definir cuántas variables participarán ($X_1, X_2...$).
3. Introduce los coeficientes en la ecuación de la función objetivo.
4. En la sección "Restricciones", añade restricciones pulsando `Añadir restricción`. Introduce los coeficientes técnicos de cada variable, selecciona el operador de relación (`<=`, `>=`, `=`) e ingresa el valor límite superior/inferior del lado derecho en la columna **RHS**.

#### Opción B: Formulación con Inteligencia Artificial (IA)
1. Despliega la tarjeta **"Formular con Inteligencia Artificial (Texto a Modelo)"** en la parte superior.
2. Escribe o pega el enunciado completo de tu problema. *Ejemplo:* 
   > "Minimizar el costo de una mezcla de alimento para granja. El alimento A cuesta $3 el kg y contiene 5% de ingrediente X, 10% de ingrediente Y. El alimento B cuesta $5 el kg y contiene 12% de ingrediente X y 8% de ingrediente Y. Se requiere al menos 60g de ingrediente X y 45g de ingrediente Y."
3. (Opcional) Carga uno de los ejemplos preconfigurados haciendo clic sobre ellos.
4. Haz clic en **"Formular problema con IA"**. La IA extraerá los coeficientes, el número exacto de variables y poblará la interfaz de forma interactiva.

---

## 🔑 Configurar API Key de Gemini (Esencial para Netlify)

Dado que las plataformas de hosting estático (como Netlify) no cuentan con un servidor de backend dinámico para procesar solicitudes de API de manera segura en Cloud Run, **puedes utilizar tu propia API Key de Gemini directamente desde el navegador de forma gratuita:**

1. Al final del recuadro de la IA, haz clic sobre el botón **"Configurar API Key de Gemini (Especial para Netlify)"**.
2. Ingresa tu API Key de Google AI Studio (comienza con `AIzaSy...`).
3. Si no dispones de una, puedes obtenerla de manera gratuita e instantánea haciendo clic en el enlace **"Obtener API Key Gratis"** o visitando [aistudio.google.com](https://aistudio.google.com/).
4. Tu API Key se guardará de forma encriptada y segura únicamente dentro del almacenamiento local (`localStorage`) de tu navegador, garantizando que nadie más tenga acceso a ella.
5. El sistema detectará tu clave y te permitirá realizar formulaciones con IA de inmediato.

---

## 📉 Visualización de Resultados

Una vez presiones el botón **"Resolver"** en la parte inferior, el sistema calculará el problema de inmediato y mostrará las secciones en el siguiente orden secuencial y lógico:

### 1. Soluciones Simplex (Metodología Algebraica)
- **Visualización General del Estado:** Indica si el problema es acotado y factible, infactible (sin región factible) o no acotado (infinito).
- **Consola de Resultados Rápidos:** Detalla el valor óptimo de $Z$ y el valor de cada variable ($X_i$, holguras y excedentes).
- **Recorrido de Tablas Simplex Iterativo:** Te permite explorar paso a paso cómo se resolvieron algebraicamente las variables básicas. Las celdas resaltadas ilustran de forma pedagógica la optimización de pivoting.

### 2. Análisis de Sensibilidad (Perspectiva Económica)
Esta pestaña te provee información vital para tomar decisiones gerenciales con los recursos óptimos:
- **Variables de Decisión:**
  - **Valor Óptimo:** La cantidad óptima que se debe producir/comprar.
  - **Costo Reducido:** El impacto marginal de forzar la producción de una variable no competitiva.
  - **Intervalo de Coeficientes Objeto:** Hasta cuánto puede subir o bajar el beneficio unitario ($c_j$) de una variable antes de que cambie la solución óptima actual.
- **Restricciones:**
  - **Precio Sombra (Shadow Price):** Cuánto estás dispuesto a pagar por una unidad adicional de recurso (ej. mano de obra, materia prima). Si tiene un precio sombra de $0$, significa que te sobra recurso (holgura $> 0$).
  - **Intervalo de Recursos (RHS):** El margen de seguridad (mínimo y máximo) en que la disponibilidad de los recursos puede oscilar garantizando que tu base óptima se mantenga estable.

### 3. Método Gráfico (Perspectiva Geométrica)
**Solo se activa cuando tienes exactamente 2 variables ($X_1$ y $X_2$):**
- Muestra los ejes cartesianos interactivos con un lienzo autoadaptable de alta definición.
- **Región de Factibilidad:** Iluminada con sombreado de neón para delimitar claramente dónde se cumplen simultáneamente todo tu conjunto de desigualdades.
- **Líneas de Restricción:** Representadas con colores diferenciados para trazar las fronteras de los recursos de producción.
- **Isocosta / Isoganancia:** Una recta de color fucsia luminoso que representa las curvas de nivel del objetivo $Z$. Puedes desplazar el control inferior para deslizar la recta paralelamente a lo largo de la región y constatar matemáticamente que el punto óptimo se ubica en uno de los vértices (teorema fundamental de la programación lineal).

---

## 🧐 ¿Por qué secciones no aplican en ciertos problemas?

A petición de la rigurosidad académica, el software integra mensajes informativos que detallan los motivos teóricos y matemáticos ante restricciones en el análisis:

### ¿Por qué NO aplica el Análisis de Sensibilidad?
El análisis de sensibilidad solo se puede efectuar si tu modelo tiene una **solución óptima factible y acotada**.
* **Si es Infactible:** No existe ninguna combinación de variables que cumpla todas las restricciones. Al no existir un punto óptimo de origen habitable, no se puede calcular analíticamente la tasa de cambio marginal frente a variaciones unitarias.
* **Si es No Acotado (Unbounded):** El espacio de soluciones tiene fronteras abiertas hacia el infinito en el sentido de optimización, lo que significa que el beneficio óptimo tiende a $\infty$. Ante esto, la matriz Simplex carece de una base estable o términos finitos para configurar límites económicos reales de recursos o precios duales.

### ¿Por qué NO aplica el Método Gráfico?
* El método gráfico está bloqueado físicamente para modelos que presenten **más de 2 variables de decisión** ($X_1...X_N$ con $N > 2$).
* **Fórmula de la dimensión:** En una pantalla web, solo disponemos de dos dimensiones espaciales ortogonales ($X$-Y) para proyectar puntos de coordenadas. Un problema de $3$ variables formaría un sólido geométrico tridimensional ya muy complejo de renderizar y navegar, mientras que modelos con $4$, $5$ o $6$ variables definen regiones situadas en hiperespacios matemáticos de $4$ o más dimensiones ($\mathbb{R}^N$). En estos niveles, las restricciones definen **hiperplanos de dimensión $N-1$** imposibles de plasmar de forma exacta y visual en una pantalla plana de computador sin distorsionar irreparablemente las relaciones de convexidad espacial.
