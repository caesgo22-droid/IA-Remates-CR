import React, { useMemo } from 'react';
import { Property, User } from '../types';
import { formatCurrency, convertToCRC } from '../utils/helpers';
import { Wallet, Target, ArrowRight } from 'lucide-react';

interface Props {
  favorites: string[];
  properties: Property[];
  onNavigateToMarket: () => void;
  onSelectProperty: (p: Property) => void;
  onUpdateProperty: (p: Property) => void;
  user: User | null;
}

const InvestmentDashboard: React.FC<Props> = ({ favorites, properties, onSelectProperty, onUpdateProperty }) => {
  
  const stats = useMemo(() => {
    let totalCap = 0;
    const items = properties.filter(p => favorites.includes(p.id)).map(p => {
        let targetPrice = p.precioBaseNumerico;
        if (p.estrategia === '2do') targetPrice = p.montoSegundoRemateNumerico || 0;
        if (p.estrategia === '3er') targetPrice = p.montoTercerRemateNumerico || 0;
        totalCap += convertToCRC(targetPrice, p.moneda);
        return { ...p, targetPrice };
    });
    return { items, totalCap };
  }, [favorites, properties]);

  const handleStrategyChange = (prop: Property, strategy: '1er' | '2do' | '3er') => {
      onUpdateProperty({ ...prop, estrategia: strategy });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs font-bold uppercase"><Wallet size={16}/> Capital Requerido</div>
                <div className="text-3xl font-extrabold text-slate-800">{formatCurrency(stats.totalCap, 'CRC')}</div>
                <div className="text-xs text-slate-400 mt-1">Según estrategia definida</div>
            </div>
        </div>

        {/* Portfolio List */}
        <div className="glass-card bg-white/50 p-4 md:p-6 rounded-2xl border border-white/50">
            <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Target size={18}/> Estrategia de Portafolio</h3>
            
            <div className="space-y-3">
                {stats.items.map(p => (
                    <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                        
                        {/* Info Column (Mobile Stacked) */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelectProperty(p)}>
                            <div className="font-bold text-sm text-slate-800 truncate flex items-center gap-2">
                               {p.provincia || 'Ubicación ND'}, {p.canton}
                               {p.esCondominio && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 rounded">CONDO</span>}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                               <span>Exp: {p.numeroExpediente}</span>
                               <span className="font-mono bg-slate-50 px-1 rounded">{p.medidasNumericas}</span>
                            </div>
                        </div>

                        {/* Strategy Column (Mobile: Full Width) */}
                        <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-50">
                            <select 
                                className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-600 focus:ring-2 ring-brand-500 outline-none w-32"
                                value={p.estrategia || '1er'}
                                onChange={(e) => handleStrategyChange(p, e.target.value as any)}
                            >
                                <option value="1er">1er Remate</option>
                                <option value="2do">2do (-25%)</option>
                                <option value="3er">3er (-50%)</option>
                            </select>
                            <div className="text-right min-w-[80px]">
                                <div className="text-[10px] text-slate-400 uppercase">Oferta</div>
                                <div className="font-extrabold text-sm text-slate-900">{formatCurrency(p.targetPrice, p.moneda)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default InvestmentDashboard;