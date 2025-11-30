import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Property, FilterState, ViewMode, User as AppUser } from './types';
import { INITIAL_FILTERS, PROVINCIAS } from './constants';
import { auth, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from './firebase';
import { parseShareUrl, convertToCRC, downloadCSV } from './utils/helpers';
import { LayoutGrid, List, Search, LogOut, Filter, X, ShoppingBag, RotateCcw, Home, BarChart2, Download, Loader2, ArrowUpDown, EyeOff } from 'lucide-react';
import BulletinInput from './components/BulletinInput';
import Dashboard from './components/Dashboard';
import InvestmentDashboard from './components/InvestmentDashboard';
import PropertyCard from './components/PropertyCard';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import AuthScreen from './components/AuthScreen';

console.log("App Version: Subcollection Attachments Final Fix");

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="16" height="16" viewBox="0 0 24 24" 
    fill={filled ? "currentColor" : "none"} 
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
  </svg>
);

const App = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true); // New state to handle initial load
  const [properties, setProperties] = useState<Property[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<'home' | 'market'>('home');
  
  // Custom Filter State Logic
  const [pricePreset, setPricePreset] = useState('any');
  const [datePreset, setDatePreset] = useState('any');

  const resultsRef = useRef<HTMLDivElement>(null);

  const hasResults = properties.length > 0;

  useEffect(() => {
    // Check for Shared URL
    const sharedProp = parseShareUrl();
    if (sharedProp) {
      setProperties([sharedProp]);
      setSelectedProperty(sharedProp);
      setActiveTab('market');
      history.pushState("", document.title, window.location.pathname + window.location.search);
    } 

    // Auth Listener & Cloud Sync
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName
        });

        try {
          // Sync Favorites IDs
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          let cloudFavIds: string[] = [];
          if (docSnap.exists()) {
            cloudFavIds = docSnap.data().favorites || [];
            setFavorites(cloudFavIds);
          }

          // Sync Full Saved Properties
          const savedPropsRef = collection(db, "users", currentUser.uid, "saved_properties");
          const querySnapshot = await getDocs(savedPropsRef);
          const cloudProperties: Property[] = [];
          querySnapshot.forEach((doc) => {
            cloudProperties.push(doc.data() as Property);
          });

          if (cloudProperties.length > 0) {
            setProperties(prev => {
              // Merge cloud properties with local properties, avoiding duplicates by ID
              const localIds = new Set(prev.map(p => p.id));
              const newFromCloud = cloudProperties.filter(cp => !localIds.has(cp.id));
              return [...newFromCloud, ...prev];
            });
          }
        } catch (e) {
          console.error("Sync error:", e);
        }
      } else {
        setUser(null);
        setFavorites([]);
        setProperties([]); // Clear sensitive data on logout
      }
      setAuthLoading(false); // Auth check done
    });

    return () => unsubscribe();
  }, []);

  const toggleFavorite = async (id: string) => {
    const isAdding = !favorites.includes(id);
    const newFavs = isAdding
      ? [...favorites, id]
      : favorites.filter(fav => fav !== id);
    
    setFavorites(newFavs);

    if (user) {
      try {
        // 1. Update ID list
        await setDoc(doc(db, "users", user.uid), { favorites: newFavs }, { merge: true });

        // 2. Update Full Property Document (Cloud Persistence)
        if (isAdding) {
          const propToSave = properties.find(p => p.id === id);
          if (propToSave) {
            // Ensure we don't try to save a massive attachments array inside the property document
            const { attachments, ...cleanProp } = propToSave; 
            await setDoc(doc(db, "users", user.uid, "saved_properties", id), cleanProp);
          }
        } else {
          await deleteDoc(doc(db, "users", user.uid, "saved_properties", id));
        }
      } catch (e) { console.error("Error syncing favorite:", e); }
    }
  };

  const toggleRejected = (id: string) => {
    setProperties(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, isRejected: !p.isRejected };
      }
      return p;
    }));
  };

  const handleLogout = () => signOut(auth);

  const { uniqueCantons, uniqueJuzgados } = useMemo(() => {
    const cantons = new Set<string>();
    const juzgados = new Set<string>();
    
    properties.forEach(p => {
      if (p.canton && p.canton !== 'Desconocido') cantons.add(p.canton);
      if (p.juzgado) juzgados.add(p.juzgado);
    });
    
    return {
      uniqueCantons: Array.from(cantons).sort(),
      uniqueJuzgados: Array.from(juzgados).sort()
    };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    let result = properties.filter(p => {
      if (filters.onlyFavorites && !favorites.includes(p.id)) return false;
      
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matches = 
          p.descripcion.toLowerCase().includes(q) || 
          p.numeroExpediente.toLowerCase().includes(q) ||
          p.juzgado.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (filters.provincia && !p.provincia.toLowerCase().includes(filters.provincia.toLowerCase())) return false;
      if (filters.canton && !p.canton.toLowerCase().includes(filters.canton.toLowerCase())) return false;
      if (filters.tipoBien && p.tipoBien !== filters.tipoBien) return false;
      if (filters.juzgado && !p.juzgado.toLowerCase().includes(filters.juzgado.toLowerCase())) return false;

      const price = convertToCRC(p.precioBaseNumerico, p.moneda);
      if (filters.minPrice !== '' && price < Number(filters.minPrice)) return false;
      if (filters.maxPrice !== '' && price > Number(filters.maxPrice)) return false;

      if (filters.minDate || filters.maxDate) {
         if (!p.fechaRemate) return false;
         const pDate = new Date(p.fechaRemate);
         if (filters.minDate && pDate < new Date(filters.minDate)) return false;
         if (filters.maxDate && pDate > new Date(filters.maxDate)) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      // Always put rejected at the end
      if (a.isRejected && !b.isRejected) return 1;
      if (!a.isRejected && b.isRejected) return -1;

      // Price Sort
      const priceA = convertToCRC(a.precioBaseNumerico, a.moneda);
      const priceB = convertToCRC(b.precioBaseNumerico, b.moneda);
      return filters.sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
    });

    return result;
  }, [properties, filters, favorites]);

  const handlePropertyUpdate = (updated: Property) => {
    setProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedProperty(null);
    
    // Also update in cloud if it's saved (excluding attachments field to be safe)
    if (user && favorites.includes(updated.id)) {
       const { attachments, ...cleanProp } = updated;
       setDoc(doc(db, "users", user.uid, "saved_properties", updated.id), cleanProp).catch(console.error);
    }
  };

  const handlePropertiesExtracted = (newProps: Property[]) => {
    setProperties(prev => [...newProps, ...prev]);
    setActiveTab('market'); // Auto switch to result view
  };

  const clearData = () => {
    if (window.confirm("¿Estás seguro de iniciar una nueva búsqueda?")) {
      const kept = properties.filter(p => favorites.includes(p.id));
      setProperties(kept);
      resetFilters();
      setActiveTab('home');
    }
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPricePreset('any');
    setDatePreset('any');
  };

  const exportFiltered = () => {
    downloadCSV(filteredProperties, `remates_mercado_${new Date().toISOString().split('T')[0]}`);
  };

  const handleProvinceFilter = (prov: string) => {
    setFilters(prev => ({...prev, provincia: prov}));
    setActiveTab('market'); 
    setTimeout(() => {
        if (resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
  };

  const handleViewFavorites = () => {
    setActiveTab('market');
    setFilters(prev => ({ ...prev, onlyFavorites: true }));
    setTimeout(() => {
        if (resultsRef.current) {
            resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 100);
  };

  const handlePricePresetChange = (val: string) => {
    setPricePreset(val);
    if (val === 'any') {
      setFilters(prev => ({ ...prev, minPrice: '', maxPrice: '' }));
    } else if (val === 'custom') {
    } else {
      if (val === 'under_5m') setFilters(prev => ({ ...prev, minPrice: '', maxPrice: 5000000 }));
      if (val === 'under_10m') setFilters(prev => ({ ...prev, minPrice: '', maxPrice: 10000000 }));
      if (val === 'under_30m') setFilters(prev => ({ ...prev, minPrice: '', maxPrice: 30000000 }));
      if (val === 'under_60m') setFilters(prev => ({ ...prev, minPrice: '', maxPrice: 60000000 }));
    }
  };

  const handleDatePresetChange = (val: string) => {
    setDatePreset(val);
    const today = new Date().toISOString().split('T')[0];
    
    if (val === 'any') {
      setFilters(prev => ({ ...prev, minDate: '', maxDate: '' }));
    } else if (val === 'custom') {
    } else {
      const future = new Date();
      if (val === 'next_month') future.setMonth(future.getMonth() + 1);
      if (val === 'next_3_months') future.setMonth(future.getMonth() + 3);
      if (val === 'next_year') future.setFullYear(future.getFullYear() + 1);
      
      setFilters(prev => ({ 
        ...prev, 
        minDate: today, 
        maxDate: future.toISOString().split('T')[0] 
      }));
    }
  };

  // 1. Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-brand-600" size={40} />
      </div>
    );
  }

  // 2. Auth Guard (Login Wall)
  if (!user) {
    return <AuthScreen />;
  }

  // 3. Main App (Only visible if logged in)
  return (
    <div className="min-h-screen pb-20 font-sans">
      
      {/* Header */}
      <header className="glass sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/70 border-b border-white/20 transition-all">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-center md:justify-between relative">
          
          {/* Logo - Centered on mobile, Left on desktop */}
          <div className="flex items-center gap-2 cursor-pointer absolute left-4 md:static" onClick={() => setActiveTab('home')}>
            <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/30 text-xs md:text-sm">RC</div>
            <h1 className="hidden md:block text-xl font-bold text-slate-800 tracking-tight leading-none">
              Remates<span className="text-brand-600 font-extrabold">CR</span>
            </h1>
          </div>

          {/* Navigation Tabs - Centered */}
          {hasResults && (
            <div className="flex bg-slate-100/80 p-1 rounded-xl shadow-inner">
               <button 
                 onClick={() => setActiveTab('home')}
                 className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'home' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <Home size={14} /> <span className="hidden md:inline">Inicio</span>
               </button>
               <button 
                 onClick={() => setActiveTab('market')}
                 className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'market' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 <BarChart2 size={14} /> <span className="hidden md:inline">Mercado</span> <span className="bg-brand-100 text-brand-700 px-1.5 rounded-full text-[9px]">{properties.length}</span>
               </button>
            </div>
          )}

          {/* User Controls - Right */}
          <div className="absolute right-4 md:static flex items-center gap-3">
             {hasResults && (
                <button 
                  onClick={clearData}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full text-xs font-bold transition-all active:scale-95"
                  title="Borrar resultados y empezar de cero"
                >
                  <RotateCcw size={14} /> <span className="hidden lg:inline">Nueva Búsqueda</span>
                </button>
             )}

              <div className="flex items-center gap-2">
                 <div className="hidden lg:flex flex-col items-end mr-1">
                    <span className="text-xs font-bold text-slate-700">{user.displayName}</span>
                    <span className="text-[10px] text-slate-400">Usuario</span>
                 </div>
                 <img src={`https://ui-avatars.com/api/?name=${user.displayName}&background=random`} className="w-8 h-8 rounded-full border-2 border-white/50 shadow-sm" alt="User" />
                 <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 p-2 transition-colors rounded-full hover:bg-slate-100" title="Cerrar Sesión"><LogOut size={18} /></button>
              </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 pt-6">
        
        {/* VIEW: HOME */}
        {activeTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 md:space-y-12 max-w-5xl mx-auto mt-2 md:mt-6">
             <section className="text-center space-y-6">
                <div className="space-y-2">
                   <h2 className="text-2xl md:text-5xl font-extrabold text-slate-800 tracking-tight">Analiza Boletines Judiciales</h2>
                   <p className="text-slate-500 text-sm md:text-lg px-4">Copia el texto del edicto, pégalo abajo e identifica oportunidades al instante.</p>
                </div>
                <BulletinInput onPropertiesExtracted={handlePropertiesExtracted} />
             </section>

             <section>
                <InvestmentDashboard 
                  favorites={favorites} 
                  properties={properties}
                  onNavigateToMarket={handleViewFavorites} 
                  onSelectProperty={setSelectedProperty} 
                  user={user}
                  onLogin={() => {}}
                />
             </section>
          </div>
        )}

        {/* VIEW: RESULTS */}
        {activeTab === 'market' && hasResults && (
          <div ref={resultsRef} className="animate-in fade-in duration-500 space-y-6">
            
            <Dashboard 
              properties={properties} 
              onFilterByProvince={handleProvinceFilter}
              onSelect={setSelectedProperty}
            />

            {/* Filter Bar */}
            <div className="sticky top-[70px] z-30 bg-white/80 backdrop-blur-xl p-3 rounded-2xl shadow-sm border border-white/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 transition-all">
              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search */}
                <div className="relative group w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar expediente, cantón..." 
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-transparent focus:bg-white focus:border-brand-500 border rounded-xl text-sm focus:outline-none text-slate-800 transition-all shadow-inner"
                      value={filters.searchQuery}
                      onChange={e => setFilters(prev => ({...prev, searchQuery: e.target.value}))}
                    />
                </div>
                {/* Counter */}
                <div className="hidden lg:block text-[10px] text-slate-400 font-medium px-2">
                  Viendo {filteredProperties.length} de {properties.length}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap w-full md:w-auto">
                 {/* Sort Order */}
                 <button 
                   onClick={() => setFilters(prev => ({...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'}))}
                   className="px-3 py-2 rounded-xl flex items-center gap-1.5 font-bold text-xs transition-all bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex-1 md:flex-none justify-center"
                   title="Ordenar por Precio"
                 >
                   <ArrowUpDown size={14} /> <span className="truncate">{filters.sortOrder === 'asc' ? 'Bajo a Alto' : 'Alto a Bajo'}</span>
                 </button>

                 <button onClick={exportFiltered} className="px-3 py-2 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-green-600">
                   <Download size={14} /> <span className="hidden lg:inline">Excel</span>
                 </button>

                 <button onClick={() => setShowFilters(!showFilters)} className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 ${showFilters ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                   <Filter size={14} /> Filtros
                 </button>
                 
                 <button onClick={() => setFilters(prev => ({...prev, onlyFavorites: !prev.onlyFavorites}))} className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs transition-all active:scale-95 ${filters.onlyFavorites ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                   <HeartIcon filled={filters.onlyFavorites} /> <span className="hidden md:inline">Favoritos</span>
                 </button>

                 <div className="bg-slate-100 p-1 rounded-xl flex">
                   <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={16} /></button>
                   <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600'}`}><List size={16} /></button>
                 </div>
              </div>
            </div>

            {/* Filter Drawer */}
            {showFilters && (
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 animate-in slide-in-from-top-4 relative z-20">
                 <button onClick={() => setShowFilters(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 bg-slate-50 rounded-full"><X size={16}/></button>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Ubicación</label>
                      <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" value={filters.provincia} onChange={e => setFilters(prev => ({...prev, provincia: e.target.value}))}>
                          <option value="">Todas las Provincias</option>
                          {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" value={filters.canton} onChange={e => setFilters(prev => ({...prev, canton: e.target.value}))}>
                          <option value="">Todos los Cantones</option>
                          {uniqueCantons.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Detalles</label>
                       <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" value={filters.tipoBien} onChange={e => setFilters(prev => ({...prev, tipoBien: e.target.value}))}>
                          <option value="">Todos los Tipos</option>
                          <option value="Propiedad">Propiedad</option>
                          <option value="Vehículo">Vehículo</option>
                       </select>
                       <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" value={filters.juzgado} onChange={e => setFilters(prev => ({...prev, juzgado: e.target.value}))}>
                          <option value="">Todos los Juzgados</option>
                          {uniqueJuzgados.map(j => <option key={j} value={j}>{j}</option>)}
                       </select>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Precio</label>
                      <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" value={pricePreset} onChange={e => handlePricePresetChange(e.target.value)}>
                          <option value="any">Cualquier precio</option>
                          <option value="under_5m">&lt; ₡5M</option>
                          <option value="under_30m">&lt; ₡30M</option>
                          <option value="under_60m">&lt; ₡60M</option>
                          <option value="custom">Personalizado</option>
                      </select>
                      {pricePreset === 'custom' && (
                        <div className="flex gap-2">
                           <input type="number" placeholder="Min" className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" value={filters.minPrice} onChange={e => setFilters(prev => ({...prev, minPrice: Number(e.target.value)}))} />
                           <input type="number" placeholder="Max" className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" value={filters.maxPrice} onChange={e => setFilters(prev => ({...prev, maxPrice: Number(e.target.value)}))} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">Fecha</label>
                      <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none" value={datePreset} onChange={e => handleDatePresetChange(e.target.value)}>
                          <option value="any">Cualquier fecha</option>
                          <option value="next_month">Próximo mes</option>
                          <option value="next_3_months">3 meses</option>
                          <option value="next_year">Este año</option>
                          <option value="custom">Personalizado</option>
                      </select>
                      {datePreset === 'custom' && (
                         <div className="flex gap-2">
                           <input type="date" className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" value={filters.minDate} onChange={e => setFilters(prev => ({...prev, minDate: e.target.value}))} />
                           <input type="date" className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm" value={filters.maxDate} onChange={e => setFilters(prev => ({...prev, maxDate: e.target.value}))} />
                        </div>
                      )}
                    </div>
                 </div>
              </div>
            )}

            {/* Grid Results */}
            <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1'}`}>
               {filteredProperties.map(prop => (
                 <PropertyCard 
                   key={prop.id} 
                   property={prop} 
                   isFavorite={favorites.includes(prop.id)}
                   isRejected={prop.isRejected}
                   toggleFavorite={toggleFavorite}
                   toggleRejected={toggleRejected}
                   onClick={() => setSelectedProperty(prop)}
                 />
               ))}
            </div>
            
            {filteredProperties.length === 0 && (
               <div className="flex flex-col items-center justify-center py-20 opacity-50">
                  <ShoppingBag className="mb-4 text-slate-300" size={60}/>
                  <p className="text-xl font-bold text-slate-400">No se encontraron resultados</p>
                  <p className="text-sm text-slate-400">Intenta ajustar los filtros</p>
               </div>
            )}
          </div>
        )}
      </main>

      {selectedProperty && (
        <PropertyDetailModal 
          property={selectedProperty} 
          isOpen={!!selectedProperty} 
          onClose={() => setSelectedProperty(null)}
          onUpdate={handlePropertyUpdate}
          isFavorite={favorites.includes(selectedProperty.id)}
          toggleFavorite={toggleFavorite}
          user={user} // Pass User for Attachment Persistence
        />
      )}
    </div>
  );
};

export default App;