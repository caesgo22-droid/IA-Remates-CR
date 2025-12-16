
import React, { useMemo } from 'react';
import { Property, User } from '../types';
import { formatCurrency, convertToCRC, calculateFinancials, formatMeasurement, formatDate } from '../utils/helpers';
import { Wallet, Target, TrendingUp, AlertTriangle, Briefcase, CalendarClock, Building2, ChevronRight } from 'lucide-react';

interface Props {
  favorites: string[];
  properties: Property[];
  onNavigateToMarket: () => void;
  onSelectProperty: (p: Property) => void;
  onUpdateProperty: (p: Property) => void;
  user: User | null;
}

const InvestmentDashboard: React.FC<Props> = ({ favorites, properties, onSelectProperty, onUpdateProperty }) => {
  
  const portfolio = useMemo(() => {
    const items = properties.filter(p => favorites.includes(p.id)).map(p => {
        const financials = calculateFinancials(p);
        return { ...p, financials };
    });

    const totalInvested = items.reduce((acc, curr) => acc + curr.financials.totalInvestment, 0);
    const totalPotentialValue = items.reduce((acc, curr) => acc + (curr.analisis?.precioVentaEstimado || 0), 0);
    const totalProjectedProfit = totalPotentialValue - totalInvested;
    const avgRoi = items.length > 0 && totalInvested > 0 ? (totalProjectedProfit / totalInvested) * 100 : 0;

    return { items, totalInvested, totalPotentialValue, totalProjectedProfit, avgRoi };
  }, [favorites, properties]);

  const handleStrategyChange = (e: React.ChangeEvent<HTMLSelectElement>, prop: Property) => {
      e.stopPropagation();
      onUpdateProperty({ ...prop, estrategia: e.target.value as any });
  };

  if (portfolio.items.length === 0) {
      return (
          <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-slate-300">
              <Briefcase size={48} className="text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Tu portafolio está vacío</h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">Comienza a buscar propiedades en el mercado y márcalas como favoritas para construir tu estrategia de inversión.</p>
          </div>
      );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* KPI Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:scale-[1.01] transition-transform">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={60} /></div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Capital Requerido</div>
                <div className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                    ₡{formatCurrency(portfolio.totalInvested, 'CRC').replace('CRC', '').trim()}
                </div>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <span className="bg-slate-100 px-1.5 rounded text-slate-500 font-bold">Base + Gastos</span>
                    según estrategia activa
                </div>
            </div>

            <div className="glass-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:scale-[1.01] transition-transform">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><Target size={60} /></div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Valor de Mercado (Est.)</div>
                <div className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
                    ₡{formatCurrency(portfolio.totalPotentialValue, 'CRC').replace('CRC', '').trim()}
                </div>
                <div className="text-[10px] text-slate-400 mt-2">
                   Suma de estimaciones de venta
                </div>
            </div>

            <div className="glass-card bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:scale-[1.01] transition-transform">
                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={60} /></div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">ROI Proyectado</div>
                <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${portfolio.avgRoi > 15 ? 'text-green-600' : 'text-slate-600'}`}>
                    {portfolio.avgRoi.toFixed(1)}%
                </div>
                <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    Ganancia Potencial: <span className="font-bold text-green-600">₡{formatCurrency(portfolio.totalProjectedProfit, 'CRC').replace('CRC', '').trim()}</span>
                </div>
            </div>
        </div>

        {/* Portfolio Content */}
        <div className="glass-card bg-white/60 rounded-3xl border border-white/50 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100/50 bg-white/40 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><Briefcase size={18}/> Activos en Seguimiento</h3>
                <span className="text-xs font-bold bg-brand-50 text-brand-700 px-2 py-1 rounded-lg">{portfolio.items.length} Oportunidades</span>
            </div>
            
            {/* DESKTOP TABLE VIEW (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] uppercase text-slate-400 tracking-wider border-b border-slate-100">
                            <th className="p-4 font-bold">Propiedad</th>
                            <th className="p-4 font-bold">Estrategia</th>
                            <th className="p-4 font-bold text-right">Costo Total</th>
                            <th className="p-4 font-bold text-right">Spread (Margen)</th>
                            <th className="p-4 font-bold text-center">Fecha Remate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white/40">
                        {portfolio.items.map(p => {
                            const isProfitable = p.financials.netProfit > 0;
                            const profitPercent = p.financials.roi;
                            
                            return (
                                <tr 
                                    key={p.id} 
                                    onClick={() => onSelectProperty(p)} 
                                    className="hover:bg-white transition-colors cursor-pointer group"
                                >
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                                {p.provincia}, {p.canton}
                                                {p.esCondominio && <Building2 size={12} className="text-purple-500"/>}
                                            </span>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                <span className="bg-slate-100 px-1 rounded font-mono text-[10px]">{p.numeroExpediente}</span>
                                                <span>•</span>
                                                <span className="text-slate-400">{formatMeasurement(p.medidasNumericas)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <select 
                                                className={`text-xs border rounded-lg p-1.5 font-bold outline-none cursor-pointer transition-colors ${
                                                    p.estrategia === '2do' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    p.estrategia === '3er' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    'bg-white text-slate-600 border-slate-200'
                                                }`}
                                                value={p.estrategia || '1er'}
                                                onChange={(e) => handleStrategyChange(e, p)}
                                            >
                                                <option value="1er">1er Remate</option>
                                                <option value="2do">2do (-25%)</option>
                                                <option value="3er">3er (-50%)</option>
                                            </select>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="font-bold text-slate-700">
                                            {formatCurrency(p.financials.acquisitionCost, p.moneda)}
                                        </div>
                                        {p.financials.totalInvestment > p.financials.acquisitionCost && (
                                            <div className="text-[10px] text-slate-400 italic">
                                                +Gastos: ₡{formatCurrency(p.financials.totalInvestment, 'CRC').replace('CRC', '').trim()}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        {p.analisis?.precioVentaEstimado ? (
                                            <div>
                                                <div className={`font-bold ${isProfitable ? 'text-green-600' : 'text-red-500'}`}>
                                                    {profitPercent.toFixed(1)}%
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    Margen: ₡{formatCurrency(p.financials.netProfit, 'CRC').replace('CRC', '').trim()}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-1 text-orange-400 text-xs">
                                                <AlertTriangle size={12} />
                                                <span>Sin Analizar</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                                {formatDate(p.financials.date?.toISOString() || '', true)}
                                            </span>
                                            {p.financials.isFuture && (
                                                <span className="text-[9px] text-brand-600 font-bold mt-0.5 flex items-center gap-1">
                                                    <CalendarClock size={10} /> Pendiente
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* MOBILE CARD VIEW (Visible on Mobile) */}
            <div className="md:hidden divide-y divide-slate-100">
                {portfolio.items.map(p => {
                    const isProfitable = p.financials.netProfit > 0;
                    const profitPercent = p.financials.roi;
                    
                    return (
                        <div key={p.id} className="p-4 bg-white/40 active:bg-white/80 transition-colors" onClick={() => onSelectProperty(p)}>
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        {p.provincia}
                                        {p.esCondominio && <Building2 size={12} className="text-purple-500"/>}
                                    </div>
                                    <div className="text-xs text-slate-500">{p.canton}</div>
                                </div>
                                <div className="text-right">
                                     <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                                        {formatDate(p.financials.date?.toISOString() || '', true)}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex justify-between items-center mb-3">
                                <div className="text-xs text-slate-400 font-mono bg-slate-50 px-1 rounded">
                                    {p.numeroExpediente}
                                </div>
                                <select 
                                    className={`text-[10px] border rounded p-1 font-bold outline-none ${
                                        p.estrategia === '2do' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                        p.estrategia === '3er' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                        'bg-white text-slate-600 border-slate-200'
                                    }`}
                                    value={p.estrategia || '1er'}
                                    onChange={(e) => handleStrategyChange(e, p)}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <option value="1er">Base</option>
                                    <option value="2do">2do (-25%)</option>
                                    <option value="3er">3er (-50%)</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                                <div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold">Inversión Total</div>
                                    <div className="font-bold text-slate-700 text-sm">
                                        {formatCurrency(p.financials.totalInvestment, 'CRC').replace('CRC', '').trim()}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] text-slate-400 uppercase font-bold">ROI Estimado</div>
                                    {p.analisis?.precioVentaEstimado ? (
                                        <div className={`font-bold text-sm ${isProfitable ? 'text-green-600' : 'text-red-500'}`}>
                                            {profitPercent.toFixed(1)}%
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-orange-400 flex items-center justify-end gap-1">
                                            <AlertTriangle size={10} /> Sin Datos
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    </div>
  );
};

export default InvestmentDashboard;
