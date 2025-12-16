
import { GoogleGenAI, Type } from "@google/genai";
import { Property } from '../types';
import { toTitleCase, cleanAndParseJSON } from '../utils/helpers';

// Safely access API Key
const getApiKey = () => {
  let key = '';
  try {
    // @ts-ignore
    if (import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      key = import.meta.env.VITE_API_KEY;
    }
  } catch (e) {}

  if (!key) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        key = process.env.VITE_API_KEY || process.env.API_KEY || '';
      }
    } catch (e) {}
  }
  return key;
};

const BATCH_SIZE = 1;
const CHUNK_LIMIT = 25000;

const compressText = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim();
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateWithRetry = async (model: any, params: any, retries = 3, baseDelay = 3000): Promise<any> => {
  try {
    return await model.generateContent(params);
  } catch (error: any) {
    const msg = error?.toString() || "";
    if ((msg.includes("429") || msg.includes("quota") || msg.includes("Overloaded")) && retries > 0) {
      console.warn(`⚠️ Rate limit. Retry in ${baseDelay}ms...`);
      await wait(baseDelay);
      return generateWithRetry(model, params, retries - 1, baseDelay * 1.5);
    }
    throw error;
  }
};

// Mapa de Cantones para inferencia
const CANTIONES_PROVINCIAS: Record<string, string> = {
    'san jose': 'San José', 'escazu': 'San José', 'desamparados': 'San José', 'puriscal': 'San José', 'tarrazu': 'San José', 'aserri': 'San José', 'mora': 'San José', 'goicoechea': 'San José', 'santa ana': 'San José', 'alajuelita': 'San José', 'vazquez de coronado': 'San José', 'acosta': 'San José', 'tibas': 'San José', 'moravia': 'San José', 'montes de oca': 'San José', 'turrubares': 'San José', 'dota': 'San José', 'curridabat': 'San José', 'perez zeledon': 'San José', 'leon cortes': 'San José',
    'alajuela': 'Alajuela', 'san ramon': 'Alajuela', 'grecia': 'Alajuela', 'san mateo': 'Alajuela', 'atenas': 'Alajuela', 'naranjo': 'Alajuela', 'palmares': 'Alajuela', 'poas': 'Alajuela', 'orotina': 'Alajuela', 'san carlos': 'Alajuela', 'zarcero': 'Alajuela', 'sarchi': 'Alajuela', 'upala': 'Alajuela', 'los chiles': 'Alajuela', 'guatuso': 'Alajuela', 'rio cuarto': 'Alajuela',
    'cartago': 'Cartago', 'paraiso': 'Cartago', 'la union': 'Cartago', 'jimenez': 'Cartago', 'turrialba': 'Cartago', 'alvarado': 'Cartago', 'oreamuno': 'Cartago', 'el guarco': 'Cartago',
    'heredia': 'Heredia', 'barva': 'Heredia', 'santo domingo': 'Heredia', 'santa barbara': 'Heredia', 'san rafael': 'Heredia', 'san isidro': 'Heredia', 'belen': 'Heredia', 'flores': 'Heredia', 'san pablo': 'Heredia', 'sarapiqui': 'Heredia',
    'liberia': 'Guanacaste', 'nicoya': 'Guanacaste', 'santa cruz': 'Guanacaste', 'bagaces': 'Guanacaste', 'carrillo': 'Guanacaste', 'cañas': 'Guanacaste', 'abangares': 'Guanacaste', 'tilaran': 'Guanacaste', 'nandayure': 'Guanacaste', 'la cruz': 'Guanacaste', 'hojancha': 'Guanacaste',
    'puntarenas': 'Puntarenas', 'esparza': 'Puntarenas', 'buenos aires': 'Puntarenas', 'montes de oro': 'Puntarenas', 'osa': 'Puntarenas', 'quepos': 'Puntarenas', 'golfito': 'Puntarenas', 'coto brus': 'Puntarenas', 'parrita': 'Puntarenas', 'corredores': 'Puntarenas', 'garabito': 'Puntarenas', 'monteverde': 'Puntarenas', 'puerto jimenez': 'Puntarenas',
    'limon': 'Limón', 'pococi': 'Limón', 'siquirres': 'Limón', 'talamanca': 'Limón', 'matina': 'Limón', 'guacimo': 'Limón'
};

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
          provincia: { type: Type.STRING, enum: ['San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón', 'Desconocido'] },
          canton: { type: Type.STRING },
          medidasNumericas: { type: Type.STRING },
          montoSegundoRemateNumerico: { type: Type.NUMBER },
          fechaSegundoRemate: { type: Type.STRING },
          montoTercerRemateNumerico: { type: Type.NUMBER },
          fechaTercerRemate: { type: Type.STRING },
          fincaId: { type: Type.STRING },
          plano: { type: Type.STRING },
          placa: { type: Type.STRING },
          marca: { type: Type.STRING },
          textoEspecifico: { type: Type.STRING },
          esCondominio: { type: Type.BOOLEAN },
          riesgos: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['numeroExpediente', 'descripcion', 'precioBaseNumerico']
      }
    }
  }
};

const SYSTEM_INSTRUCTION = `Eres un experto analista de edictos judiciales de Costa Rica. Tu misión es extraer datos estructurados con alta precisión geográfica.

Reglas de Extracción CRÍTICAS:
1.  **UBICACIÓN GEOGRÁFICA:**
    *   **PROVINCIA:** [San José, Alajuela, Cartago, Heredia, Guanacaste, Puntarenas, Limón].
    *   **IMPORTANTE:** Si la provincia NO está explícita, DEBES inferirla basada en el **CANTÓN**, **DISTRITO** o el nombre del **JUZGADO** mencionado (ej: "Juzgado de Pococí" -> Pococí es Limón; "Cantón de Grecia" -> Alajuela).
    *   NO uses "Desconocido" a menos que no haya absolutamente ninguna mención de lugar.

2.  **CANTÓN:** Extrae el cantón claramente.
3.  **NUMERO EXPEDIENTE:** Formatos "Referencia N°", "EXP", "Expediente".
4.  **PRECIO BASE:** El valor numérico.
5.  **FECHAS:** Formato YYYY-MM-DD.
6.  **TIPO BIEN:** 'Propiedad' (Fincas, Lotes, Casas), 'Vehículo', 'Mueble', 'Otro'.
7.  **RIESGOS:** Busca palabras clave: "Ocupado", "Gravamenes", "Servidumbres".

Ignora encabezados administrativos irrelevantes.`;

const intelligentSegmentation = (fullText: string): string[] => {
  const splitPattern = /(?=(?:^|\n)\s*(?:Expediente|EXP|Exp|JUZGADO|AL MONTO DE|SE HACE SABER|Referencia N°)\s*[:Nº#])/i;
  const rawSegments = fullText.split(splitPattern).filter(s => s.length > 50);

  if (rawSegments.length === 0 && fullText.length > 50) return [fullText];

  const mergedChunks: string[] = [];
  let currentChunk = "";

  for (const segment of rawSegments) {
    const compressed = compressText(segment);
    if (compressed.length > CHUNK_LIMIT) {
        if (currentChunk) { mergedChunks.push(currentChunk); currentChunk = ""; }
        mergedChunks.push(compressed);
    } else if (currentChunk.length + compressed.length < CHUNK_LIMIT) {
      currentChunk += "\n" + compressed;
    } else {
      mergedChunks.push(currentChunk);
      currentChunk = compressed;
    }
  }
  if (currentChunk) mergedChunks.push(currentChunk);
  return mergedChunks;
};

// Función auxiliar para corregir provincias basada en cantones conocidos
const fixProvinceByCanton = (item: any) => {
    if ((!item.provincia || item.provincia === 'Desconocido') && item.canton) {
        const cleanCanton = item.canton.toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remover tildes para búsqueda
        
        // Buscar en el mapa
        for (const [key, val] of Object.entries(CANTIONES_PROVINCIAS)) {
            if (cleanCanton.includes(key) || key.includes(cleanCanton)) {
                return val;
            }
        }
    }
    return toTitleCase(item.provincia || 'Desconocido');
};

export const extractPropertiesFromText = async (fullText: string): Promise<Property[]> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });
  const chunks = intelligentSegmentation(fullText);
  let allProperties: Property[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const response = await generateWithRetry(ai.models, {
        model: 'gemini-2.5-flash',
        contents: `Extrae datos de estos edictos:\n\n${chunks[i]}`,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: propertySchema,
          temperature: 0, 
        }
      });

      const json = cleanAndParseJSON(response.text || '{}');
      const items = json.items || [];
      
      const mappedItems = items.map((item: any) => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        // Aplicar corrección de provincia
        provincia: fixProvinceByCanton(item),
        canton: toTitleCase(item.canton || ''),
        tipoBien: item.tipoBien || 'Otro', 
        moneda: item.moneda || 'CRC',
        precioBaseNumerico: Number(item.precioBaseNumerico) || 0,
        medidasNumericas: item.medidasNumericas ? String(item.medidasNumericas) : '',
        descripcion: item.descripcion ? String(item.descripcion) : '',
        originalText: item.textoEspecifico || "Ver detalle en boletín.",
        analisis: { valorMercadoEstimado: 0, costoRemodelacion: 0, costosLegales: 0, precioVentaEstimado: 0 }
      }));

      allProperties = [...allProperties, ...mappedItems];
    } catch (error) {
      console.error("Error processing chunk:", error);
    }
    if (i < chunks.length - 1) await wait(1000);
  }

  return allProperties;
};
