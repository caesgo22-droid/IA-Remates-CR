import React, { useMemo } from 'react';
import { Property, User } from '../types';
import { getAuctionStatus, formatCurrency, formatDate, convertToCRC, downloadCSV } from '../utils/helpers';
import { TrendingUp, Calendar, ArrowRight, DollarSign, Wallet, Target, Download } from 'lucide-react';

interface Props {
  favorites: string[];
  properties: Property[];
  onNavigateToMarket: () => void;
  onSelectProperty: (p: Property) => void;
  user: User | null;
  onLogin: () => void;
}

const InvestmentDashboard: React.FC<Props> = ({ favorites, properties, onNavigateToMarket, onSelectProperty, user }) => {
  
  const portfolio = useMemo(() => {
    // Filter favorites
    const favProps = properties.filter(p => favorites.includes(p.id));

    // Calculate Insights
    let totalInvestment = 0;
    let upcomingAuctions: Array<{ prop: Property, status: any }> = [];
    let stageCount = { first: 0, second: 0, third: 0, ended: 0 };

    favProps.forEach(p => {
      const status = getAuctionStatus(p);
      
      if (status.isFuture) {
        totalInvestment += convertToCRC(status.price, p.moneda);
        upcomingAuctions.push({ prop: p, status });
        
        if (status.stage.includes('1er')) stageCount.first++;
        else if (status.stage.includes('2do')) stageCount.second++;
        else if (status.stage.includes('3er')) stageCount.third++;
      } else {
        stageCount.ended++;
      }
    });

    // Sort upcoming by date
    upcomingAuctions.sort((a, b) => a.status.date.getTime() - b.status.date.getTime());

    return {
      items: favProps,
      totalInvestment,
      upcoming: upcomingAuctions,
      stageCount
    };
  }, [favorites, properties]);

  const handleExportPortfolio = () => {
    downloadCSV(portfolio.items, `remates_portafolio_${new Date().toISOString().split('T')[0]}`);
  };

  if (portfolio.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 animate-in fade-in duration-500 bg-white/40 rounded-3xl p-8 border border-white/40">
        <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mb-4 text-brand-600 shadow-inner">
          <Target size={30} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Tu Portafolio está vacío</h2>
        <p className="text-slate-500 text-center max-w-md mb-6 text-sm">
          Aún no tienes propiedades en seguimiento. Analiza boletines y marca con <span className="text-red-500">♥</span> las oportunidades.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
             Hola, {user ? user.displayName?.split(' ')[0] : 'Inversionista'} 👋
          </h2>
          <p className="text-sm text-slate-500">Seguimiento en tiempo real de tus {portfolio.items.length} propiedades favoritas.</p>
        </div>
        <button 
          onClick={handleExportPortfolio}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl border border-slate-200 text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <Download size={16} className="text-green-600" /> Exportar Portafolio
        </button>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Capital - Click to view in Market */}
        <div 
          onClick={onNavigateToMarket}
          className="glass-card bg-white/70 p-5 rounded-2xl border border-white/50 relative overflow-hidden group shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
        >
          <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet size={80} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg"><DollarSign size={18} /></div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Capital Requerido</span>
          </div>
          <div className="text-2xl font-extrabold text-slate-800 tracking-tight">
            {formatCurrency(portfolio.totalInvestment, 'CRC')}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-brand-600">
             Suma de precios base <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Next Opportunity - Click to view details */}
        <div 
           onClick={() => portfolio.upcoming.length > 0 && onSelectProperty(portfolio.upcoming[0].prop)}
           className={`glass-card bg-white/70 p-5 rounded-2xl border border-white/50 relative overflow-hidden group shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all ${portfolio.upcoming.length > 0 ? 'cursor-pointer' : ''}`}
        >
           <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar size={80} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={18} /></div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Próximo Remate</span>
          </div>
          {portfolio.upcoming.length > 0 ? (
            <>
              <div className="text-xl font-bold text-slate-800 truncate">
                {formatDate(portfolio.upcoming[0].status.date.toISOString(), true)}
              </div>
              <div className="text-[10px] text-brand-600 font-bold mt-1 truncate flex items-center gap-1">
                 {portfolio.upcoming[0].prop.tipoBien} en {portfolio.upcoming[0].prop.canton}
                 <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </>
          ) : (
            <div className="text-lg font-bold text-slate-400">Sin fechas futuras</div>
          )}
        </div>

        {/* Strategy Breakdown - Click to view in Market */}
        <div 
          onClick={onNavigateToMarket}
          className="glass-card bg-white/70 p-5 rounded-2xl border border-white/50 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2 mb-3">
             <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Target size={18} /></div>
             <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Estrategia</span>
          </div>
          <div className="flex gap-2">
             <div className="flex-1 text-center bg-white rounded-lg p-1.5 border border-slate-100">
               <div className="text-xs font-bold text-slate-400">1er</div>
               <div className="text-lg font-extrabold text-slate-700">{portfolio.stageCount.first}</div>
             </div>
             <div className="flex-1 text-center bg-white rounded-lg p-1.5 border border-brand-500/30 relative shadow-sm">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-[8px] font-bold px-1.5 rounded-full">Oportunidad</div>
               <div className="text-xs font-bold text-brand-600">2do</div>
               <div className="text-lg font-extrabold text-brand-700">{portfolio.stageCount.second}</div>
             </div>
             <div className="flex-1 text-center bg-white rounded-lg p-1.5 border border-slate-100">
               <div className="text-xs font-bold text-slate-400">3er</div>
               <div className="text-lg font-extrabold text-slate-700">{portfolio.stageCount.third}</div>
             </div>
          </div>
        </div>
      </div>

      {/* Timeline Agenda */}
      <div className="glass-card bg-white/60 rounded-3xl p-6 border border-white/50 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 mb-6 flex items-center gap-2">
           <Calendar size={16} /> Agenda de Remates
        </h3>

        <div className="space-y-0 relative">
          {/* Vertical Line */}
          <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-slate-200"></div>

          {portfolio.upcoming.map((item, idx) => (
            <div 
              key={item.prop.id + idx} 
              className="relative pl-16 py-3 group cursor-pointer hover:bg-white/60 rounded-xl transition-colors pr-4"
              onClick={() => onSelectProperty(item.prop)}
            >
               {/* Timeline Dot */}
               <div className={`absolute left-[21px] top-6 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${idx === 0 ? 'bg-brand-500 scale-125' : 'bg-slate-300'}`}></div>
               
               {/* Date Badge */}
               <div className="absolute left-0 top-4 w-12 text-center">
                  <div className="text-xs font-bold text-slate-700">{item.status.date.getDate()}</div>
                  <div className="text-[9px] uppercase font-bold text-slate-400">{item.status.date.toLocaleString('es-CR', { month: 'short' }).replace('.', '')}</div>
               </div>

               {/* Content */}
               <div className="flex justify-between items-center">
                  <div className="min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          item.status.stage.includes('3er') ? 'bg-red-100 text-red-700' :
                          item.status.stage.includes('2do') ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {item.status.stage}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.status.date.toLocaleTimeString('es-CR', {hour: '2-digit', minute: '2-digit'})}
                        </span>
                     </div>
                     <h4 className="text-sm font-bold text-slate-800 truncate">
                       {item.prop.tipoBien} - {item.prop.provincia}, {item.prop.canton}
                     </h4>
                     <p className="text-xs text-slate-500 truncate max-w-xs">{item.prop.descripcion}</p>
                  </div>
                  <div className="text-right">
                     <div className="text-sm font-extrabold text-slate-900 group-hover:text-brand-600 transition-colors">
                        {formatCurrency(item.status.price, item.prop.moneda)}
                     </div>
                     <div className="text-[10px] text-slate-400">Base actual</div>
                  </div>
               </div>
            </div>
          ))}

          {portfolio.upcoming.length === 0 && (
             <div className="pl-16 py-4 text-slate-400 text-sm">
                No hay remates programados próximamente para tus favoritos.
             </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default InvestmentDashboard;