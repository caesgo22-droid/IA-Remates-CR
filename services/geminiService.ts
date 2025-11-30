import { GoogleGenAI, Type } from "@google/genai";
import { Property } from '../types';

// Safely access API Key from different environment configurations (Vite vs Node)
const getApiKey = () => {
  let key = '';

  // 1. Try Vite / Modern Browsers (import.meta.env)
  try {
    // @ts-ignore
    if (import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore if import.meta is not supported
  }

  // 2. Try Process (Node/Webpack) if not found yet
  if (!key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        key = process.env.VITE_API_KEY || process.env.API_KEY || '';
      }
    } catch (e) {
      // Ignore if process is not defined
    }
  }

  return key;
};

const BATCH_SIZE = 3;
const DELAY_MS = 2000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const propertySchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          numeroExpediente: { type: Type.STRING },
          tipoBien: { type: Type.STRING, enum: ['Propiedad', 'Vehículo', 'Mueble', 'Otro'] },
          descripcion: { type: Type.STRING },
          precioBaseNumerico: { type: Type.NUMBER },
          moneda: { type: Type.STRING, enum: ['CRC', 'USD'] },
          fechaRemate: { type: Type.STRING },
          juzgado: { type: Type.STRING },
          provincia: { type: Type.STRING },
          canton: { type: Type.STRING },
          medidasNumericas: { type: Type.STRING },
          montoSegundoRemateNumerico: { type: Type.NUMBER },
          fechaSegundoRemate: { type: Type.STRING },
          montoTercerRemateNumerico: { type: Type.NUMBER },
          fechaTercerRemate: { type: Type.STRING },
          fincaId: { type: Type.STRING, description: "Número de finca, matrícula o folio real (ej: 2-623121-000)" },
          plano: { type: Type.STRING, description: "Número de plano catastrado (ej: A-0078297-1992)" },
          placa: { type: Type.STRING, description: "Solo para vehículos: Placa/Matrícula (ej: BWV097)" },
          marca: { type: Type.STRING, description: "Solo para vehículos: Marca (ej: TOYOTA)" },
          modelo: { type: Type.STRING, description: "Solo para vehículos: Modelo (ej: M20A)" },
          anio: { type: Type.STRING, description: "Solo para vehículos: Año de fabricación" },
          textoEspecifico: { type: Type.STRING, description: "El fragmento exacto de texto del edicto que corresponde a este bien específico." }
        },
        required: ['numeroExpediente', 'descripcion', 'precioBaseNumerico']
      }
    }
  }
};

export const extractPropertiesFromText = async (fullText: string): Promise<Property[]> => {
  // 1. Get Key ONLY when function is called (Lazy Load)
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.error("API Key not found in env vars. VITE_API_KEY is missing.");
    throw new Error("API Key is missing. Check environment variables (VITE_API_KEY) in Vercel.");
  }

  // 2. Initialize Instance locally
  const ai = new GoogleGenAI({ apiKey });

  // Split text into reasonable chunks
  const rawChunks = fullText.split(/\n\s*\n/).filter(c => c.length > 100);
  
  const chunks: string[] = [];
  let currentChunk = "";
  for (const raw of rawChunks) {
    if (currentChunk.length + raw.length < 15000) { 
      currentChunk += "\n" + raw;
    } else {
      chunks.push(currentChunk);
      currentChunk = raw;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  let allProperties: Property[] = [];

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async (chunkText) => {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are an expert legal assistant for Real Estate and Vehicle Auctions in Costa Rica. Extract structured data from the provided judicial bulletin text.

          INPUT TEXT: ${chunkText}
          
          CRITICAL INSTRUCTIONS FOR SEGMENTATION:
          1. **IDENTIFY AUCTION BLOCKS:** Each distinct auction usually starts with phrases like "En este Despacho" or "Sáquese a remate" and typically ends with a reference number line like "Referencia N°: 2025..." or "Referencia número:". 
          2. Treat the text between these markers as a single context for extraction.

          CRITICAL RULES FOR EXTRACTION:
          
          1. **MULTIPLE PROPERTIES IN ONE EDICT:**
             - A single auction block often contains MULTIPLE distinct properties (e.g., "Sáquese a remate la finca A... y la finca B...").
             - **ACTION:** Return a separate JSON object for EACH property or vehicle found.
             - **DATA MAPPING:** Assign the specific 'fincaId', 'plano', 'medidasNumericas' (for properties) or 'placa', 'marca', 'modelo', 'anio' (for vehicles) to the correct object.
             - **SOURCE TEXT:** In the 'textoEspecifico' field, copy the specific sentence or paragraph that describes this particular property/vehicle within the larger block.

          2. **PROPERTIES (BIENES RAÍCES) FIELDS:**
             - **Ubicación:** Extract 'provincia' and 'canton'.
             - **Medidas:** Look for "MIDE:", "Metros cuadrados". Extract just the number.
             - **Finca ID:** Look for "finca", "matrícula", "folio real". Format: #-######-###.
             - **Plano:** Look for "PLANO:", "Plano Catastrado". Format: Letter-Number-Year (e.g. A-0008337-2022).
             - **Juzgado:** Extract the court name (e.g., "JUZGADO DE COBRO DE ALAJUELA").
             - **Detalle:** Create a summary description.

          3. **VEHICLES (VEHÍCULOS) FIELDS:**
             - **Tipo Bien:** Set to 'Vehículo'.
             - **Placa:** "placa BWV097", "matrícula CL-123".
             - **Marca:** "Marca TOYOTA", "Marca NISSAN".
             - **Modelo:** "Modelo M20A", "Estilo SEDAN".
             - **Año:** Look for "Año", "Modelo Año" (e.g., "2000", "2015").
             - **Descripcion:** Combine relevant details (Color, VIN, etc.).

          4. **AUCTION ROUNDS (PRECIOS Y FECHAS):**
             - **1er Remate:** "Base", "Sáquese a remate... con base de...". Extract Price and Date.
             - **2do Remate:** "Segundo remate", "rebajada en un 25%". Extract Price (usually 75% of base) and Date.
             - **3rd Remate:** "Tercer remate", "rebajada en un 50%". Extract Price (usually 25% of base) and Date.
             - *Note:* Convert text numbers (e.g., "DOS MILLONES") to numeric values.

          5. **OUTPUT:**
             - Return strict JSON matching the schema.
             - If location is missing, use "Desconocido".
             - Dates must be ISO format if possible, or null.
          `,
          config: {
            responseMimeType: "application/json",
            responseSchema: propertySchema,
            temperature: 0, // Zero temp for maximum extraction rigidity
          }
        });

        const json = JSON.parse(response.text || '{}');
        const items = json.items || [];
        
        return items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          // Fallback to chunk text if specific text is missing
          originalText: item.textoEspecifico || chunkText 
        }));

      } catch (error: any) {
        console.error("Error processing chunk:", error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(res => allProperties = [...allProperties, ...res]);

    if (i + BATCH_SIZE < chunks.length) {
      await delay(DELAY_MS);
    }
  }

  return allProperties;
};