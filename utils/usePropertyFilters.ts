
import { useState, useMemo } from 'react';
import { Property, FilterState } from '../types';
import { INITIAL_FILTERS } from '../constants';
import { convertToCRC } from './helpers';

export const usePropertyFilters = (properties: Property[], rejectedIds: string[]) => {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // 1. Calcular Cantones disponibles dinámicamente
  const availableCantones = useMemo(() => {
    return Array.from(new Set(properties.map(p => p.canton).filter(Boolean))).sort();
  }, [properties]);

  // 2. Lógica de Filtrado Centralizada
  const filteredProperties = useMemo(() => {
    let result = properties;

    // Búsqueda Texto
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(p => 
        (p.descripcion || '').toLowerCase().includes(q) || 
        (p.numeroExpediente || '').toLowerCase().includes(q) ||
        (p.provincia || '').toLowerCase().includes(q) ||
        (p.canton || '').toLowerCase().includes(q)
      );
    }

    // Filtros Estrictos
    if (filters.provincia) result = result.filter(p => p.provincia === filters.provincia);
    if (filters.canton) result = result.filter(p => p.canton === filters.canton);
    if (filters.tipoBien) result = result.filter(p => p.tipoBien === filters.tipoBien);

    // Filtros Numéricos
    if (filters.minPrice !== '') result = result.filter(p => p.precioBaseNumerico >= (filters.minPrice as number));
    if (filters.maxPrice !== '') result = result.filter(p => p.precioBaseNumerico <= (filters.maxPrice as number));
    
    // Ordenar Descartados al final
    result = result.sort((a, b) => {
        const aRej = rejectedIds.includes(a.id) || rejectedIds.includes(a.numeroExpediente) ? 1 : 0;
        const bRej = rejectedIds.includes(b.id) || rejectedIds.includes(b.numeroExpediente) ? 1 : 0;
        return aRej - bRej;
    });

    // Ordenamiento por Precio
    if (filters.sortOrder === 'asc') {
        result = result.sort((a, b) => convertToCRC(a.precioBaseNumerico, a.moneda) - convertToCRC(b.precioBaseNumerico, b.moneda));
    } else {
        result = result.sort((a, b) => convertToCRC(b.precioBaseNumerico, b.moneda) - convertToCRC(a.precioBaseNumerico, a.moneda));
    }

    return result;
  }, [properties, filters, rejectedIds]);

  // 3. Agrupación por Expediente
  const groupedProperties = useMemo(() => {
    const groups: Record<string, Property[]> = {};
    filteredProperties.forEach(p => {
      const key = p.numeroExpediente ? p.numeroExpediente : p.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.values(groups);
  }, [filteredProperties]);

  return {
    filters,
    setFilters,
    filteredProperties,
    groupedProperties,
    availableCantones
  };
};
