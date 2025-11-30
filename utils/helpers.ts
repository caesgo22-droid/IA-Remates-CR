import { EXCHANGE_RATE } from '../constants';
import { Property } from '../types';

export const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const convertToCRC = (amount: number, currency: string) => {
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
        hour: '2-digit',
        minute: '2-digit'
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

export const formatMeasurement = (text: string) => {
  if (!text) return 'N/A';
  // Strict extraction: Remove everything that isn't a digit, dot, or comma
  // Then take the first sequence
  const numbersOnly = text.match(/[\d,.]+/);
  
  if (numbersOnly && numbersOnly[0]) {
      // Clean trailing punctuation
      const clean = numbersOnly[0].replace(/^[.,]|[.,]$/g, '');
      if (clean.length > 0) return `${clean} m²`;
  }
  
  return 'N/A';
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

/**
 * Determines the current status of the auction based on today's date.
 * Returns the relevant price, date, and stage label.
 */
export const getAuctionStatus = (property: Property) => {
  const now = new Date();
  
  const d1 = property.fechaRemate ? new Date(property.fechaRemate) : null;
  const d2 = property.fechaSegundoRemate ? new Date(property.fechaSegundoRemate) : null;
  const d3 = property.fechaTercerRemate ? new Date(property.fechaTercerRemate) : null;

  // If 1st date is future or valid, that's the current stage
  if (d1 && d1 > now) {
    return {
      stage: '1er Remate',
      price: property.precioBaseNumerico,
      date: d1,
      isFuture: true
    };
  }

  // If 1st passed, check 2nd
  if (d2 && d2 > now) {
    return {
      stage: '2do Remate (-25%)',
      price: property.montoSegundoRemateNumerico || 0,
      date: d2,
      isFuture: true
    };
  }

  // If 2nd passed, check 3rd
  if (d3 && d3 > now) {
    return {
      stage: '3er Remate (-50%)',
      price: property.montoTercerRemateNumerico || 0,
      date: d3,
      isFuture: true
    };
  }

  // All passed
  return {
    stage: 'Finalizado',
    price: 0,
    date: null,
    isFuture: false
  };
};

export const downloadCSV = (properties: Property[], filename: string) => {
  if (properties.length === 0) return;

  const headers = ['Expediente', 'Tipo', 'Provincia', 'Canton', 'Precio Base', 'Moneda', 'Fecha 1er Remate', 'ID Finca', 'Plano', 'Descripcion'];
  const csvContent = [
    headers.join(','),
    ...properties.map(p => {
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
        `"${p.descripcion.replace(/"/g, '""').substring(0, 150)}..."`
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