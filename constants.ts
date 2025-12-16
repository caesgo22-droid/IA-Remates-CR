
export const EXCHANGE_RATE = 515;

// Costos aproximados en CR
export const TRANSFER_TAX_RATE = 0.025; // ~2.5% Traspaso/Timbres promedio
export const LEGAL_FEES_RATE = 0.015;   // ~1.5% Honorarios abogado promedio

export const INITIAL_FILTERS = {
  searchQuery: '',
  provincia: '',
  canton: '',
  tipoBien: '',
  juzgado: '',
  minPrice: '' as const,
  maxPrice: '' as const,
  minDate: '',
  maxDate: '',
  onlyFavorites: false,
  sortOrder: 'asc' as const,
};

export const PROVINCIAS = [
  'San José', 'Alajuela', 'Cartago', 'Heredia', 'Guanacaste', 'Puntarenas', 'Limón'
];

export const BOLETIN_URL_DEFAULT = "https://www.imprentanacional.go.cr/boletin/";
