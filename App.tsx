
import React, { useState, useEffect } from 'react';
import { Property, ViewMode, User as AppUser } from './types';
import { PROVINCIAS, INITIAL_FILTERS } from './constants';
import { auth, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from './firebase';
import { Search, LogOut, Filter, ShoppingBag, RotateCcw, Home, Loader2, ArrowUpDown, X, Layers } from 'lucide-react';
import BulletinInput from './components/BulletinInput';
import Dashboard from './components/Dashboard';
import InvestmentDashboard from './components/InvestmentDashboard';
import PropertyCard from './components/PropertyCard';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import AuthScreen from './components/AuthScreen';
// IMPORT CRÍTICO: Asegurando ruta desde utils
import { usePropertyFilters } from './utils/usePropertyFilters';

const App = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Data Sources
  const [searchResults, setSearchResults] = useState<Property[]>([]); 
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  
  // User Preferences Data
  const [favorites, setFavorites] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'home' | 'market'>('home');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedGroup, setSelectedGroup] = useState<Property[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // --- HOOK DE FILTRADO ---
  const sourceProperties = activeTab === 'home' ? [] : searchResults; 
  
  const { 
    filters, 
    setFilters, 
    groupedProperties, 
    availableCantones 
  } = usePropertyFilters(sourceProperties, rejected);

  // Load Auth & Favorites
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName
        });
        
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setFavorites(data.favorites || []);
            setRejected(data.rejected || []);
          }

          const savedPropsRef = collection(db, "users", currentUser.uid, "saved_properties");
          const savedPropsSnap = await getDocs(savedPropsRef);
          setSavedProperties(savedPropsSnap.docs.map(doc => doc.data() as Property));

        } catch (e) { console.error(e); }
      } else {
        setUser(null);
        setSavedProperties([]);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Rejects to LocalStorage (si no hay user)
  useEffect(() => {
    if (!user) {
        const localRej = localStorage.getItem('erj_rejected');
        if (localRej) setRejected(JSON.parse(localRej));
    }
  }, [user]);

  // --- Handlers ---

  const handlePropertiesExtracted = (newProps: Property[]) => {
    const processed = newProps.map(p => {
        const isRejected = rejected.includes(p.numeroExpediente);
        const existingFav = savedProperties.find(sp => sp.numeroExpediente === p.numeroExpediente);
        
        if (existingFav) {
            return { 
                ...existingFav, 
                fechaRemate: p.fechaRemate || existingFav.fechaRemate 
            };
        }
        return { ...p, isRejected };
    });

    setSearchResults(processed);
    setActiveTab('market');
  };

  const handleNewSearch = () => {
    if(window.confirm("¿Limpiar resultados actuales y hacer nueva búsqueda?")) {
       setSearchResults([]);
       setActiveTab('home');
    }
  };
  
  const handleResetFilters = () => {
      setFilters(INITIAL_FILTERS);
  };

  const handlePropertyUpdate = async (updated: Property) => {
    setSearchResults(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSavedProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
    
    if (user && favorites.includes(updated.id)) {
        try {
            await setDoc(doc(db, "users", user.uid, "saved_properties", updated.id), updated);
        } catch (e) { console.error(e); }
    }
  };

  const toggleFavorite = async (id: string) => {
    if (!user) return;
    const isFav = favorites.includes(id);
    let newFavorites = isFav ? favorites.filter(fid => fid !== id) : [...favorites, id];

    if (!isFav) {
      const propToAdd = searchResults.find(p => p.id === id) || savedProperties.find(p => p.id === id);
      if (propToAdd) {
          setSavedProperties(prev => [...prev, propToAdd]);
          await setDoc(doc(db, "users", user.uid, "saved_properties", id), propToAdd);
      }
    } else {
      setSavedProperties(prev => prev.filter(p => p.id !== id));
      await deleteDoc(doc(db, "users", user.uid, "saved_properties", id));
    }

    setFavorites(newFavorites);
    await setDoc(doc(db, "users", user.uid), { favorites: newFavorites, rejected }, { merge: true });
  };

  const toggleRejected = async (id: string) => {
      const isRej = rejected.includes(id);
      const newRejected = isRej ? rejected.filter(rid => rid !== id) : [...rejected, id];
      setRejected(newRejected);
      
      if (user) {
          await setDoc(doc(db, "users", user.uid), { rejected: newRejected }, { merge: true });
      } else {
          localStorage.setItem('erj_rejected', JSON.stringify(newRejected));
      }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setSearchResults([]);
    setSavedProperties([]);
  };

  if (authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-brand-600" size={40} /></div>;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen pb-10 bg-slate-50/50">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/20 px-4 md:px-8 py-3 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-6">
           <h1 className="text-xl font-bold text-slate-800 tracking-tight">Remates<span className="text-brand-600">CR</span></h1>
           <div className="flex bg-slate-100/50 p-1 rounded-xl">
              <button onClick={() => setActiveTab('home')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'home' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><Home size={14} /> Portafolio</button>
              <button onClick={() => setActiveTab('market')} className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 ${activeTab === 'market' ? 'bg-white shadow-sm' : 'text-slate-500'}`}><ShoppingBag size={14} /> Mercado</button>
           </div>
        </div>
        <div className="flex items-center gap-3">
           {searchResults.length > 0 && <button onClick={handleNewSearch} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600"><RotateCcw size={14} /> Nueva</button>}
           <button onClick={handleLogout} className="flex items-center gap-2 text-slate-500 text-xs font-bold"><LogOut size={16} /></button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        
        {/* PORTFOLIO / HOME */}
        <div className={activeTab === 'home' ? 'block' : 'hidden'}>
           <div className="max-w-5xl mx-auto">
              {searchResults.length === 0 && <BulletinInput onPropertiesExtracted={handlePropertiesExtracted} />}
              <div className="mt-8">
                <InvestmentDashboard 
                  favorites={favorites} 
                  properties={savedProperties} 
                  onNavigateToMarket={() => setActiveTab('market')}
                  onSelectProperty={(p) => setSelectedGroup([p])} 
                  user={user}
                  onUpdateProperty={handlePropertyUpdate}
                />
              </div>
           </div>
        </div>

        {/* MARKET */}
        <div className={activeTab === 'market' ? 'block' : 'hidden'}>
           
           <Dashboard 
              properties={searchResults} 
              onFilterByProvince={(p) => setFilters(prev => ({...prev, provincia: p}))} 
              onSelect={(p) => setSelectedGroup([p])} 
           />

           {/* Toolbar */}
           <div className="sticky top-[70px] z-30 mb-6 bg-white/90 p-3 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between backdrop-blur-xl border border-white/50">
                 <div className="flex items-center gap-2 w-full md:w-auto flex-1">
                    <Search className="text-slate-400" size={16} />
                    <input type="text" placeholder="Buscar por exp, descripción, cantón..." className="w-full bg-transparent outline-none text-sm" value={filters.searchQuery} onChange={(e) => setFilters(prev => ({...prev, searchQuery: e.target.value}))} />
                 </div>
                 
                 <div className="flex items-center gap-2">
                    {searchResults.length > 0 && (
                        <div className="hidden md:flex items-center gap-2 mr-2 px-3 py-1.5 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-500 border border-slate-100">
                             <Layers size={12}/>
                             <span>{groupedProperties.length} resultados</span>
                        </div>
                    )}

                    <button onClick={() => setFilters(prev => ({...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'}))} className="p-2 border rounded-lg text-slate-600 hover:bg-slate-50" title="Ordenar por Precio"><ArrowUpDown size={16} /></button>
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-2 border rounded-lg ${showFilters ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:bg-slate-50'}`}><Filter size={16} /></button>
                 </div>
           </div>

           {/* Advanced Filters */}
           {showFilters && (
                <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-100 animate-in slide-in-from-top-2">
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <select className="p-2 border rounded-lg text-xs md:text-sm bg-slate-50" value={filters.provincia} onChange={(e) => setFilters(prev => ({...prev, provincia: e.target.value}))}><option value="">Provincia</option>{PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                        <select className="p-2 border rounded-lg text-xs md:text-sm bg-slate-50" value={filters.canton} onChange={(e) => setFilters(prev => ({...prev, canton: e.target.value}))}>
                            <option value="">Cantón (Todos)</option>
                            {availableCantones.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="p-2 border rounded-lg text-xs md:text-sm bg-slate-50" value={filters.tipoBien} onChange={(e) => setFilters(prev => ({...prev, tipoBien: e.target.value}))}><option value="">Tipo Bien</option><option value="Propiedad">Propiedad</option><option value="Vehículo">Vehículo</option></select>
                        <select className="p-2 border rounded-lg text-xs md:text-sm bg-slate-50" value={filters.maxPrice} onChange={(e) => setFilters(prev => ({...prev, maxPrice: Number(e.target.value) || ''}))}><option value="">Precio Max</option><option value="10000000">10 Millones</option><option value="30000000">30 Millones</option><option value="50000000">50 Millones</option><option value="100000000">100 Millones</option></select>
                   </div>
                   <div className="flex justify-end">
                       <button onClick={handleResetFilters} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                           <X size={14}/> Limpiar Filtros
                       </button>
                   </div>
                </div>
           )}

           {/* Grid */}
           <div className={`grid gap-5 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {groupedProperties.map(group => (
                <PropertyCard 
                  key={group[0].id} 
                  items={group} 
                  isFavorite={group.some(p => favorites.includes(p.id))} 
                  isRejected={group[0].isRejected || rejected.includes(group[0].numeroExpediente)}
                  toggleFavorite={(id) => toggleFavorite(id)}
                  toggleRejected={(id) => { group.forEach(p => toggleRejected(p.id)); toggleRejected(group[0].numeroExpediente); }}
                  onClick={() => setSelectedGroup(group)}
                />
              ))}
              
              {groupedProperties.length === 0 && (
                 <div className="col-span-full py-20 text-center text-slate-400">
                    <p>No se encontraron resultados con los filtros actuales.</p>
                    <button onClick={handleResetFilters} className="mt-2 text-brand-600 text-sm font-bold hover:underline">Limpiar filtros</button>
                 </div>
              )}
           </div>
        </div>

      </main>

      {selectedGroup && (
        <PropertyDetailModal 
          items={selectedGroup}
          isOpen={!!selectedGroup} 
          onClose={() => setSelectedGroup(null)}
          onUpdate={handlePropertyUpdate}
          isFavorite={selectedGroup.some(p => favorites.includes(p.id))}
          toggleFavorite={toggleFavorite}
          toggleRejected={toggleRejected}
          isRejected={selectedGroup[0].isRejected || rejected.includes(selectedGroup[0].numeroExpediente)}
          user={user} 
        />
      )}

    </div>
  );
};

export default App;
