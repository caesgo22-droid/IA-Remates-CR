import { GoogleGenAI, Type } from "@google/genai";
import { Property } from '../types';
import { toTitleCase } from '../utils/helpers';

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

// Optimization: Reduce delay and increase batch slightly if possible, 
// but Gemini has strict rate limits. We'll reduce delay to 500ms to speed up.
const BATCH_SIZE = 3;
const DELAY_MS = 500; 

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
          textoEspecifico: { type: Type.STRING, description: "El fragmento exacto y COMPLETO de texto del edicto que corresponde a este bien específico." },
          esCondominio: { type: Type.BOOLEAN, description: "True si menciona 'condominio', 'filial', o finca termina en -F-000" }
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

  // Optimization: Split text into larger chunks to make fewer requests
  const rawChunks = fullText.split(/\n\s*\n/).filter(c => c.length > 50);
  
  const chunks: string[] = [];
  let currentChunk = "";
  // Increased chunk size limit slightly to allow more context
  for (const raw of rawChunks) {
    if (currentChunk.length + raw.length < 25000) { 
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
          1. **IDENTIFY AUCTION BLOCKS:** Each distinct auction usually starts with phrases like "En este Despacho" or "Sáquese a remate" and typically ends with a reference number line.
          
          CRITICAL RULES FOR EXTRACTION:
          
          1. **MULTIPLE PROPERTIES:** If an edict lists multiple properties (e.g. "Finca 1... Finca 2..."), CREATE A SEPARATE ITEM for each one.
          
          2. **CONDOMINIUM DETECTION (CRITICAL):**
             - Set 'esCondominio' to TRUE if the text mentions: "Condominio", "Finca Filial", "Cuota condominal", or if the Finca ID follows the pattern ######-F-000 or ######-M-000.
          
          3. **MEASUREMENTS (MEDIDAS):**
             - Look closely for "MIDE:", "terreno de", "metros cuadrados". Extract the NUMBER. If text says "trescientos metros", convert to 300.
          
          4. **LOCATION (NORMALIZATION):**
             - Extract 'provincia' and 'canton'. 
             - Valid Provincias: San José, Alajuela, Cartago, Heredia, Guanacaste, Puntarenas, Limón.
          
          5. **VEHICLES:**
             - Extract 'placa', 'marca', 'modelo', 'anio'.
          
          6. **FULL TEXT:**
             - In 'textoEspecifico', encompass the FULL description paragraph for that property, not just a snippet.

          7. **DATES:**
             - Convert text dates (e.g., "quince de enero") to YYYY-MM-DD format.
          `,
          config: {
            responseMimeType: "application/json",
            responseSchema: propertySchema,
            temperature: 0, 
          }
        });

        const json = JSON.parse(response.text || '{}');
        const items = json.items || [];
        
        return items.map((item: any) => ({
          ...item,
          id: Math.random().toString(36).substr(2, 9),
          // Normalize location for filters
          provincia: toTitleCase(item.provincia),
          canton: toTitleCase(item.canton),
          originalText: item.textoEspecifico || chunkText 
        }));

      } catch (error: any) {
        console.error("Error processing chunk:", error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(res => allProperties = [...allProperties, ...res]);

    // Reduced delay for speed
    if (i + BATCH_SIZE < chunks.length) {
      await delay(DELAY_MS);
    }
  }

  return allProperties;
};