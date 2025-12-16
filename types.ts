
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
  originalText?: string;
  textoEspecifico?: string;
  fincaId?: string;
  plano?: string;
  customSiriUrl?: string;
  isRejected?: boolean;
  esCondominio?: boolean;
  
  // Risk Analysis (New)
  riesgos?: string[]; // Ej: "Ocupada", "Gravamenes", "Servidumbres"
  valorAvaluo?: number; // Si el edicto lo menciona
  
  // Strategy
  estrategia?: '1er' | '2do' | '3er'; 

  // Investment Analysis (New)
  analisis?: {
    valorMercadoEstimado?: number;
    costoRemodelacion?: number;
    costosLegales?: number; // Traspaso, abogados
    precioVentaEstimado?: number;
    rentaMensualEstimada?: number;
    notas?: string;
  };

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
