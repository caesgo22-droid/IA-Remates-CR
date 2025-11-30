export interface Property {
  id: string;
  numeroExpediente: string;
  tipoBien: 'Propiedad' | 'Vehículo' | 'Mueble' | 'Otro';
  descripcion: string;
  precioBaseNumerico: number;
  moneda: 'CRC' | 'USD';
  fechaRemate: string; // ISO String or YYYY-MM-DD
  juzgado: string;
  provincia: string;
  canton: string;
  medidasNumericas: string;
  
  // Second Auction
  montoSegundoRemateNumerico: number;
  fechaSegundoRemate: string;
  
  // Third Auction
  montoTercerRemateNumerico: number;
  fechaTercerRemate: string;

  // Metadata
  originalText?: string; // El bloque grande (legacy)
  textoEspecifico?: string; // El fragmento exacto de este remate
  fincaId?: string; // For SIRI (Matrícula / Folio Real)
  plano?: string;   // Plano Catastrado
  customSiriUrl?: string; // User editable
  isRejected?: boolean;
  attachments?: { 
    id: string, 
    type: 'image' | 'link' | 'file', 
    mimeType?: string,
    name: string, 
    data: string, 
    date: string 
  }[];

  // Vehicle Specifics
  placa?: string;
  marca?: string;
  modelo?: string;
  anio?: string;
}

export interface FilterState {
  searchQuery: string;
  provincia: string;
  canton: string;
  tipoBien: string;
  juzgado: string;
  minPrice: number | '';
  maxPrice: number | '';
  minDate: string;
  maxDate: string;
  onlyFavorites: boolean;
  sortOrder: 'asc' | 'desc';
}

export type ViewMode = 'grid' | 'list';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}