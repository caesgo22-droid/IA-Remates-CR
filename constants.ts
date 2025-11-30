export const EXCHANGE_RATE = 515;

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