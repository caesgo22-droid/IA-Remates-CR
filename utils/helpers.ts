
import { EXCHANGE_RATE } from '../constants';
import { Property } from '../types';

// --- ROBUST JSON PARSER ---
export const cleanAndParseJSON = (text: string): any => {
  if (!text) return {};
  
  let cleanText = text;

  // 1. Eliminar bloques de código Markdown
  cleanText = cleanText.replace(/```json/gi, '').replace(/```/g, '');

  // 2. Encontrar el bloque JSON válido más externo
  const firstOpen = cleanText.indexOf('{');
  const lastClose = cleanText.lastIndexOf('}');

  if (firstOpen !== -1 && lastClose !== -1) {
    cleanText = cleanText.substring(firstOpen, lastClose + 1);
  }

  // 3. Limpieza preventiva de errores comunes de LLMs
  // Elimina comas antes de cierres de array/objeto: ", ]" -> "]" y ", }" -> "}"
  cleanText = cleanText.replace(/,(\s*[}\]])/g, '$1');

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse JSON from AI:", text);
    // Segundo intento agresivo para JSON malformados
    try {
        // Intenta corregir comillas simples a dobles si la IA se equivocó
        // Nota: Esto es riesgoso si el texto contiene comillas simples reales, pero útil como fallback
        const fixedQuotes = cleanText.replace(/'/g, '"');
        return JSON.parse(fixedQuotes);
    } catch (e2) {
        throw new Error("La IA generó una respuesta con formato inválido. Por favor intenta procesar de nuevo.");
    }
  }
};

// --- IMAGE UTILS ---
export const resizeImage = (file: File, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
              reject(new Error("No canvas context"));
              return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compresión 70%
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
};


export const formatCurrency = (amount: number, currency: string) => {
  if (amount === undefined || amount === null || isNaN(amount)) return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(0);
  
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const convertToCRC = (amount: number, currency: string) => {
  if (!amount) return 0;
  if (currency === 'CRC') return amount;
  return amount * EXCHANGE_RATE;
};

export const formatDate = (dateString: string, short = false) => {
  if (!dateString) return 'Por definir';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    if (short) {
      return new Intl.DateTimeFormat('es-CR', {
        day: 'numeric',
        month: 'short',
        year: '2-digit'
      }).format(date);
    }

    return new Intl.DateTimeFormat('es-CR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (e) {
    return dateString;
  }
};

export const formatMeasurement = (text: string | number | null | undefined) => {
  if (!text) return 'N/A';
  
  const strText = String(text);
  
  // Limpiar texto basura común
  const cleanText = strText.replace(/MIDE[:\s]*/i, '').replace(/AREA[:\s]*/i, '');
  
  // Regex mejorado: Busca números que probablemente sean áreas (evita fechas o números de finca si es posible)
  // Busca: digitos + (opcional punto/coma y digitos) + opcional espacios + m2 o metros
  const match = cleanText.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|mts|metros)?/i);
  
  if (match && match[1]) {
      // Normalizar: reemplazar coma por punto para consistencia visual si se desea, o dejar tal cual
      return `${match[1]} m²`;
  }
  
  // Fallback: Si solo hay números en el string, devolver eso
  if (/^\d+(?:[.,]\d+)?$/.test(cleanText.trim())) {
      return `${cleanText.trim()} m²`;
  }
  
  return 'N/A';
};

export const toTitleCase = (str: string) => {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
};

export const generateShareUrl = (property: Property) => {
  const json = JSON.stringify(property);
  const base64 = btoa(unescape(encodeURIComponent(json))); 
  return `${window.location.origin}${window.location.pathname}#share=${base64}`;
};

export const parseShareUrl = (): Property | null => {
  const hash = window.location.hash;
  if (hash.startsWith('#share=')) {
    try {
      const base64 = hash.replace('#share=', '');
      const json = decodeURIComponent(escape(atob(base64)));
      return JSON.parse(json) as Property;
    } catch (e) {
      console.error("Error parsing share URL", e);
      return null;
    }
  }
  return null;
};

export const generateContentHash = async (text: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const getAuctionStatus = (property: Property) => {
  const now = new Date();
  
  const d1 = property.fechaRemate ? new Date(property.fechaRemate) : null;
  const d2 = property.fechaSegundoRemate ? new Date(property.fechaSegundoRemate) : null;
  const d3 = property.fechaTercerRemate ? new Date(property.fechaTercerRemate) : null;

  if (d1 && d1 > now) {
    return {
      stage: '1er Remate',
      price: property.precioBaseNumerico,
      date: d1,
      isFuture: true
    };
  }

  if (d2 && d2 > now) {
    return {
      stage: '2do Remate (-25%)',
      price: property.montoSegundoRemateNumerico || 0,
      date: d2,
      isFuture: true
    };
  }

  if (d3 && d3 > now) {
    return {
      stage: '3er Remate (-50%)',
      price: property.montoTercerRemateNumerico || 0,
      date: d3,
      isFuture: true
    };
  }

  return {
    stage: 'Finalizado',
    price: 0,
    date: null,
    isFuture: false
  };
};

// Investment Calculations
export const calculateFinancials = (property: Property) => {
  const status = getAuctionStatus(property);
  // Get active strategy price or current active price
  let acquisitionCost = status.price;
  
  if (property.estrategia === '2do' && property.montoSegundoRemateNumerico) acquisitionCost = property.montoSegundoRemateNumerico;
  if (property.estrategia === '3er' && property.montoTercerRemateNumerico) acquisitionCost = property.montoTercerRemateNumerico;
  
  // Ensure we are comparing same currency (normalize to CRC for calc)
  const acqCRC = convertToCRC(acquisitionCost, property.moneda);
  
  const analysis = property.analisis || {};
  const reno = analysis.costoRemodelacion || 0;
  const legal = analysis.costosLegales || 0;
  
  const totalInvestment = acqCRC + reno + legal;
  
  const salesPrice = analysis.precioVentaEstimado || 0; // Usually CRC
  
  const netProfit = salesPrice - totalInvestment;
  const roi = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

  return {
    acquisitionCost,
    totalInvestment,
    netProfit,
    roi,
    currencySymbol: '₡', // Doing math in CRC mostly
    date: status.date,
    isFuture: status.isFuture
  };
};

export const downloadCSV = (properties: Property[], filename: string) => {
  if (properties.length === 0) return;

  const headers = ['Expediente', 'Tipo', 'Provincia', 'Canton', 'Precio Base', 'Moneda', 'Fecha 1er Remate', 'ID Finca', 'Plano', 'Descripcion'];
  const csvContent = [
    headers.join(','),
    ...properties.map(p => {
      const desc = p.descripcion ? String(p.descripcion) : '';
      const row = [
        p.numeroExpediente,
        p.tipoBien,
        p.provincia || 'ND',
        p.canton || 'ND',
        p.precioBaseNumerico,
        p.moneda,
        p.fechaRemate,
        p.fincaId || '',
        p.plano || '',
        `"${desc.replace(/"/g, '""').substring(0, 150)}..."`
      ];
      return row.join(',');
    })
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
