import React, { useMemo } from 'react';
import { Property } from '../types';
import { formatCurrency, formatDate, convertToCRC, formatMeasurement } from '../utils/helpers';
import { CalendarClock, Car, Home, BarChart3, ChevronRight, Building2 } from 'lucide-react';

interface Props {
  properties: Property[];
  onFilterByProvince: (prov: string) => void;
  onSelect: (prop: Property) => void;
}

const Dashboard: React.FC<Props> = ({ properties, onFilterByProvince, onSelect }) => {
  const stats = useMemo(() => {
    // Ordenar por precio
    const sortedByPrice = [...properties].sort((a, b) => 
      convertToCRC(a.precioBaseNumerico, a.moneda) - convertToCRC(b.precioBaseNumerico, b.moneda)
    );

    // Ordenar por fecha
    const now = new Date();
    const sortedByDate = [...properties]
      .filter(p => p.fechaRemate && new Date(p.fechaRemate) > now)
      .sort((a, b) => new Date(a.fechaRemate).getTime() - new Date(b.fechaRemate).getTime());

    // Provincias
    const byProvince: Record<string, number> = {};
    properties.forEach(p => {
      const prov = p.provincia || 'Desconocido';
      byProvince[prov] = (byProvince[prov] || 0) + 1;
    });

    return {
      cheapProperties: sortedByPrice.filter(p => p.tipoBien === 'Propiedad').slice(0, 5),
      cheapVehicles: sortedByPrice.filter(p => p.tipoBien === 'Vehículo').slice(0, 5),
      soonest: sortedByDate.slice(0, 5),
      byProvince: Object.entries(byProvince).sort((a, b) => b[1] - a[1])
    };
  }, [properties]);

  if (properties.length === 0) return null;

  return (
    <div className="space-y-6 mb-8 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Propiedades Baratas */}
        {stats.cheapProperties.length > 0 && (
          <VerticalList 
            title="Propiedades Baratas" 
            icon={<Home className="text-blue-500" size={16} />} 
            items={stats.cheapProperties}
            onSelect={onSelect}
            color="blue"
            showSize // Flag para mostrar m2
          />
        )}

        {/* Vehículos Baratos */}
        {stats.cheapVehicles.length > 0 && (
          <VerticalList 
            title="Vehículos Oportunidad" 
            icon={<Car className="text-orange-500" size={16} />} 
            items={stats.cheapVehicles}
            onSelect={onSelect}
            color="orange"
          />
        )}

        {/* Cierran Pronto */}
        {stats.soonest.length > 0 && (
          <VerticalList 
            title="Cierran Pronto" 
            icon={<CalendarClock className="text-red-500" size={16} />} 
            items={stats.soonest}
            onSelect={onSelect}
            color="red"
            isDate
            showSize // Flag para mostrar m2 aquí también
          />
        )}
      </div>

      {/* Gráfico Provincias */}
      <div className="glass-card bg-white/60 p-5 rounded-3xl border border-white/40 shadow-sm">
        <h3 className="text-xs font-bold mb-4 flex items-center gap-2 text-slate-400 uppercase tracking-wider">
          <BarChart3 size={14} className="text-purple-500" /> Distribución Geográfica
        </h3>
        <div className="space-y-2">
          {stats.byProvince.slice(0, 5).map(([prov, count]) => {
            const max = Math.max(...stats.byProvince.map(x => x[1]));
            const pct = (count / max) * 100;
            return (
              <div 
                key={prov} 
                onClick={() => onFilterByProvince(prov)}
                className="flex items-center gap-2 text-xs cursor-pointer group hover:bg-white/50 p-1.5 rounded-lg transition-colors"
              >
                <div className="w-24 font-semibold text-slate-600 truncate group-hover:text-purple-600 transition-colors">{prov}</div>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-400 to-purple-600 rounded-full group-hover:from-purple-500 group-hover:to-purple-700 shadow-sm" 
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <div className="w-8 font-mono text-slate-400 text-right font-bold">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Componente Interno de Lista
const VerticalList = ({ title, icon, items, onSelect, color, isDate, showSize }: any) => (
  <div className="glass-card bg-white/70 rounded-2xl p-4 border border-white/40 flex flex-col h-full shadow-sm">
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
      <h3 className="font-bold text-xs text-slate-800 flex items-center gap-2">
        {icon} {title}
      </h3>
      <span className={`text-[9px] px-2 py-0.5 rounded-full bg-${color}-50 text-${color}-600 font-bold uppercase tracking-wide`}>
        Top 5
      </span>
    </div>
    
    <div className="flex flex-col gap-2">
      {items.map((prop: Property, idx: number) => (
        <div 
          key={prop.id}
          onClick={() => onSelect(prop)}
          className="group flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-100 hover:shadow-sm"
        >
          <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold bg-${color}-50 text-${color}-600 shrink-0`}>
            {idx + 1}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
             <span className="text-[10px] text-slate-400 font-mono leading-tight truncate">
               {prop.provincia || 'S/Prov'}, {prop.canton}
             </span>
             <div className="flex items-center gap-1">
                {/* AQUÍ ESTÁ EL CAMBIO: Muestra m² si existe, sino el tipo */}
                {showSize && prop.medidasNumericas ? (
                   <span className="text-xs font-bold text-slate-700 font-mono">
                     {formatMeasurement(prop.medidasNumericas)}
                   </span>
                ) : (
                   <span className="text-xs font-semibold text-slate-700 truncate">
                     {prop.tipoBien === 'Vehículo' ? prop.descripcion : prop.tipoBien}
                   </span>
                )}
                {prop.esCondominio && <Building2 size={10} className="text-purple-500" />}
             </div>
          </div>

          <div className="text-right shrink-0">
             <div className="text-[11px] font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
               {formatCurrency(prop.precioBaseNumerico, prop.moneda)}
             </div>
             {isDate && (
                <div className="text-[9px] text-red-600 font-bold bg-red-50 px-1.5 rounded mt-0.5 inline-block leading-tight">
                  {formatDate(prop.fechaRemate).split(',')[0]}
                </div>
             )}
          </div>
          
          <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-500 opacity-0 group-hover:opacity-100 transition-all -ml-2" />
        </div>
      ))}
    </div>
  </div>
);

export default Dashboard;