import React from 'react';
import { Property } from '../types';
import { formatDate, formatCurrency, formatMeasurement } from '../utils/helpers';
import { Heart, Gavel, Car, Home, MapPin, Ruler, ChevronRight, EyeOff, Building2 } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  property: Property;
  isFavorite: boolean;
  isRejected?: boolean;
  toggleFavorite: (id: string) => void;
  toggleRejected?: (id: string) => void;
  onClick: () => void;
}

const PropertyCard: React.FC<Props> = ({ property, isFavorite, isRejected, toggleFavorite, toggleRejected, onClick }) => {
  const isVehicle = property.tipoBien === 'Vehículo';
  const Icon = isVehicle ? Car : Home;
  
  // Compact Date Formatter
  const renderDate = (dateStr: string) => {
    if (!dateStr) return <span className="text-slate-300">-</span>;
    return formatDate(dateStr, true);
  };

  const renderPrice = (amount: number) => {
    if (!amount) return <span className="text-slate-300">-</span>;
    return formatCurrency(amount, property.moneda);
  };

  return (
    <div 
      className={clsx(
        "glass-card bg-white/70 rounded-2xl p-0 transition-all duration-300 cursor-pointer flex flex-col group overflow-hidden border border-white/50",
        isRejected ? "opacity-40 grayscale hover:opacity-80 hover:grayscale-0" : "hover:shadow-xl hover:bg-white hover:scale-[1.01]"
      )}
      onClick={onClick}
    >
      {/* Header Bar */}
      <div className="flex justify-between items-start p-3 pb-2 border-b border-slate-100/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className={clsx("p-1.5 rounded-lg shadow-sm border border-white/50", isVehicle ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600")}>
            <Icon size={16} />
          </div>
          <div className="flex flex-col min-w-0">
             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">
               Exp: {property.numeroExpediente}
             </span>
             <div className="flex items-center gap-1.5">
               <span className="text-xs font-semibold text-slate-800 truncate">
                  {property.tipoBien}
               </span>
               {property.esCondominio && (
                 <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-purple-200 flex items-center gap-0.5">
                   <Building2 size={8} /> Condo
                 </span>
               )}
             </div>
          </div>
        </div>
        <div className="flex gap-1">
          {toggleRejected && (
            <button 
              onClick={(e) => { e.stopPropagation(); toggleRejected(property.id); }}
              className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-300 hover:text-slate-500"
              title={isRejected ? "Restaurar" : "Descartar / Marcar como visto"}
            >
              <EyeOff size={16} className={clsx(isRejected && "text-slate-600")} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id); }}
            className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Heart size={18} className={clsx(isFavorite ? "text-red-500 fill-current drop-shadow-sm" : "text-slate-300")} />
          </button>
        </div>
      </div>

      <div className="px-3 py-3 flex-1 flex flex-col gap-3">
        
        {/* Main Info Section */}
        <div className="min-h-[2.5rem]">
          {isVehicle ? (
            <div>
               <div className="flex items-center gap-1 mb-1 flex-wrap">
                  <span className="text-xs font-extrabold text-slate-800 leading-tight uppercase">
                    {property.marca || 'Marca ND'} {property.modelo || ''}
                  </span>
                  {property.anio && (
                    <span className="text-[10px] bg-slate-100 px-1.5 rounded font-bold text-slate-600 border border-slate-200">
                      {property.anio}
                    </span>
                  )}
               </div>
               {property.placa && (
                  <div className="inline-block bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-0.5">
                    <span className="text-[10px] font-mono font-bold text-slate-600 tracking-wider">PLACA: {property.placa}</span>
                  </div>
               )}
               <p className="text-[10px] text-slate-500 line-clamp-1 mt-1">{property.descripcion}</p>
            </div>
          ) : (
             <div>
                <div className="flex items-start gap-1 mb-1">
                  <MapPin size={14} className="text-brand-500 mt-0.5 shrink-0 drop-shadow-sm" />
                  <span className="text-xs font-bold text-slate-700 leading-tight">
                    {property.provincia || 'Provincia ND'}, {property.canton || 'Cantón ND'}
                  </span>
                </div>
                {property.medidasNumericas && (
                  <div className="flex items-center gap-1 text-slate-500 ml-0.5">
                    <Ruler size={12} />
                    <span className="text-[10px] font-mono font-medium bg-slate-100 px-1.5 rounded text-slate-600">{formatMeasurement(property.medidasNumericas)}</span>
                  </div>
                )}
             </div>
          )}
        </div>

        {/* 3-Column Auction Schedule Grid */}
        <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100 mt-auto backdrop-blur-sm">
           <div className="grid grid-cols-3 gap-1 text-center divide-x divide-slate-200/50">
              <div className="flex flex-col px-1">
                 <span className="text-[8px] uppercase font-bold text-slate-400 mb-0.5 tracking-tighter">1er Remate</span>
                 <span className="text-[11px] font-bold text-green-600 truncate tracking-tight">
                   {renderPrice(property.precioBaseNumerico)}
                 </span>
                 <span className="text-[9px] text-slate-500 truncate leading-tight mt-0.5 opacity-80">
                   {renderDate(property.fechaRemate)}
                 </span>
              </div>
              
              <div className="flex flex-col px-1 opacity-90">
                 <span className="text-[8px] uppercase font-bold text-slate-400 mb-0.5 tracking-tighter">2do (-25%)</span>
                 <span className="text-[11px] font-medium text-slate-600 truncate tracking-tight">
                   {renderPrice(property.montoSegundoRemateNumerico)}
                 </span>
                 <span className="text-[9px] text-slate-500 truncate leading-tight mt-0.5 opacity-80">
                   {renderDate(property.fechaSegundoRemate)}
                 </span>
              </div>

              <div className="flex flex-col px-1 opacity-75">
                 <span className="text-[8px] uppercase font-bold text-slate-400 mb-0.5 tracking-tighter">3er (-50%)</span>
                 <span className="text-[11px] font-medium text-slate-600 truncate tracking-tight">
                   {renderPrice(property.montoTercerRemateNumerico)}
                 </span>
                 <span className="text-[9px] text-slate-500 truncate leading-tight mt-0.5 opacity-80">
                   {renderDate(property.fechaTercerRemate)}
                 </span>
              </div>
           </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-brand-600 font-medium pt-1">
           <span className="flex items-center gap-1 opacity-70">
             <Gavel size={10} className="text-slate-400"/>
             <span className="text-slate-500 truncate max-w-[100px]">{property.juzgado}</span>
           </span>
           <span className="flex items-center group-hover:translate-x-1 transition-transform">
             Ver Ficha <ChevronRight size={12} />
           </span>
        </div>

      </div>
    </div>
  );
};

export default PropertyCard;