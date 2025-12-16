
import React from 'react';
import { Property } from '../types';
import { formatCurrency, formatMeasurement, formatDate } from '../utils/helpers';
import { Heart, Home, Car, EyeOff, Layers, Building2, MapPin, Ruler, Calendar, Hash } from 'lucide-react';

interface Props {
  items: Property[];
  isFavorite: boolean;
  isRejected?: boolean;
  toggleFavorite: (id: string) => void;
  toggleRejected?: (id: string) => void;
  onClick: () => void;
}

const PropertyCard: React.FC<Props> = ({ items, isFavorite, isRejected, toggleFavorite, toggleRejected, onClick }) => {
  const main = items[0];
  if (!main) return null;
  
  const isGroup = items.length > 1;
  const displayPrice = isGroup 
    ? items.reduce((s, i) => s + (i.precioBaseNumerico || 0), 0)
    : (main.precioBaseNumerico || 0);

  const isVehicle = main.tipoBien === 'Vehículo';
  const isCondo = items.some(i => i.esCondominio);

  const displayType = (main.tipoBien || 'OTRO').toUpperCase();

  return (
    <div 
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className={`glass-card bg-white rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.01] border border-slate-100 ${isRejected ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-80' : ''}`}
    >
       {/* Header: Location & Type Badge */}
       <div className="bg-slate-50/80 p-3 flex justify-between items-start border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-2">
             <div className="flex items-center gap-1 text-slate-500 mb-1">
                <MapPin size={12} className="text-brand-500" />
                {/* AQUI SE MUESTRA EL CANTON CLARAMENTE */}
                <span className="text-xs font-bold uppercase tracking-wide truncate">
                  {main.provincia || 'Ubicación ND'}, {main.canton || 'Desconocido'}
                </span>
             </div>
             <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${isVehicle ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                   {isGroup ? `LOTE DE ${items.length}` : displayType}
                </span>
                {isCondo && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1">
                    <Building2 size={10} /> CONDOMINIO
                  </span>
                )}
             </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFavorite(main.id); }} 
            className={`p-1.5 rounded-full shadow-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${isFavorite ? 'bg-red-50 border-red-100 text-red-500' : 'bg-white border-slate-100 text-slate-300 hover:text-red-400'}`}
            title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          >
             <Heart size={16} fill={isFavorite ? "currentColor" : "none"}/>
          </button>
       </div>

       {/* Body: Key Metrics */}
       <div className="p-4 space-y-3">
          
          {/* Main Content Row */}
          <div className="flex justify-between items-end">
             <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Precio Base {isGroup && 'Total'}</span>
                <div className="text-xl font-extrabold text-slate-800 leading-none">
                   {formatCurrency(displayPrice, main.moneda)}
                </div>
             </div>
             
             {/* Size Badge (M2) */}
             {!isVehicle && (
               <div className="text-right">
                  <div className="flex items-center justify-end gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                     <Ruler size={14} className="text-slate-500" />
                     <span className="text-sm font-bold text-slate-700">
                        {isGroup 
                          ? `${items.length} Props` 
                          : formatMeasurement(main.medidasNumericas)
                        }
                     </span>
                  </div>
               </div>
             )}
          </div>

          {/* Date & Info */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
             <div className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2 py-1 rounded-md border border-red-100">
                <Calendar size={12} />
                <span className="text-[10px] font-bold">
                   {formatDate(main.fechaRemate, true).split(',')[0]}
                </span>
             </div>
             
             <div className="flex items-center gap-1 text-slate-400 ml-auto">
                <Hash size={12} />
                <span className="text-[10px] font-mono">{main.numeroExpediente}</span>
             </div>
          </div>

       </div>

       {/* Footer Actions */}
       {toggleRejected && (
         <div className="px-4 pb-3 flex justify-end">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleRejected(main.numeroExpediente); }} 
              className="text-xs text-slate-300 hover:text-slate-500 flex items-center gap-1 hover:underline decoration-slate-300"
              title="Marcar como no interesante"
            >
               <EyeOff size={14} /> Descartar
            </button>
         </div>
       )}
    </div>
  );
};

export default PropertyCard;
