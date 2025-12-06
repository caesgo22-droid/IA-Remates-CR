import React, { useState, useEffect, useMemo } from 'react';
import { Property, FilterState, ViewMode, User as AppUser } from './types';
import { INITIAL_FILTERS, PROVINCIAS } from './constants';
import { auth, signOut, onAuthStateChanged, db, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from './firebase';
import { convertToCRC } from './utils/helpers';
import { Search, LogOut, Filter, ShoppingBag, RotateCcw, Home, Loader2, ArrowUpDown } from 'lucide-react';
import BulletinInput from './components/BulletinInput';
import Dashboard from './components/Dashboard';
import InvestmentDashboard from './components/InvestmentDashboard';
import PropertyCard from './components/PropertyCard';
import { PropertyDetailModal } from './components/PropertyDetailModal'; // Named Export
import AuthScreen from './components/AuthScreen';

const App = () => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // DOS LISTAS SEPARADAS
  const [searchResults, setSearchResults] = useState<Property[]>([]); 
  const [savedProperties, setSavedProperties] = useState<Property[]>([]);
  
  const [favorites, setFavorites] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  
  const [activeTab, setActiveTab] = useState<'home' | 'market'>('home');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedGroup, setSelectedGroup] = useState<Property[] | null>(null); // Seleccionamos GRUPO
  
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

  // Dynamic Options
  const [availableCantones, setAvailableCantones] = useState<string[]>([]);

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

  // Update Filters
  useEffect(() => {
    const source = activeTab === 'home' ? savedProperties : searchResults;
    const cantones = Array.from(new Set(source.map(p => p.canton).filter(Boolean))).sort();
    setAvailableCantones(cantones);
  }, [searchResults, savedProperties, activeTab]);

  // --- Handlers ---

  const handlePropertiesExtracted = (newProps: Property[]) => {
    setSearchResults(newProps); // Solo mostramos lo nuevo
    setActiveTab('market');
  };

  const handleNewSearch = () => {
    if(window.confirm("¿Limpiar resultados actuales?")) {
       setSearchResults([]);
       setActiveTab('home');
    }
  };

  const handlePropertyUpdate = async (updated: Property) => {
    // Actualizar en ambas listas si existe
    setSearchResults(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSavedProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
    
    // Persistir si es favorito
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
      // Add to saved
      const propToAdd = searchResults.find(p => p.id === id) || savedProperties.find(p => p.id === id);
      if (propToAdd) {
          setSavedProperties(prev => [...prev, propToAdd]);
          await setDoc(doc(db, "users", user.uid, "saved_properties", id), propToAdd);
      }
    } else {
      // Remove from saved (local view logic handled by filter)
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

  // --- Filtering & Grouping ---

  const displayedProperties = activeTab === 'home' ? [] : searchResults;

  const filteredProperties = useMemo(() => {
    let result = displayedProperties;

    // Search
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(p => 
        p.descripcion.toLowerCase().includes(q) || 
        p.numeroExpediente.toLowerCase().includes(q) ||
        p.provincia?.toLowerCase().includes(q)
      );
    }

    // Strict
    if (filters.provincia) result = result.filter(p => p.provincia === filters.provincia);
    if (filters.canton) result = result.filter(p => p.canton === filters.canton);
    if (filters.tipoBien) result = result.filter(p => p.tipoBien === filters.tipoBien);

    // Price
    if (filters.minPrice !== '') result = result.filter(p => p.precioBaseNumerico >= (filters.minPrice as number));
    if (filters.maxPrice !== '') result = result.filter(p => p.precioBaseNumerico <= (filters.maxPrice as number));
    
    // Sort Rejects (Rejected properties go last)
    result = result.sort((a, b) => {
        const aRej = rejected.includes(a.id) || rejected.includes(a.numeroExpediente) ? 1 : 0;
        const bRej = rejected.includes(b.id) || rejected.includes(b.numeroExpediente) ? 1 : 0;
        return aRej - bRej;
    });

    // Sort Price
    if (filters.sortOrder === 'asc') {
        result = result.sort((a, b) => convertToCRC(a.precioBaseNumerico, a.moneda) - convertToCRC(b.precioBaseNumerico, b.moneda));
    } else {
        result = result.sort((a, b) => convertToCRC(b.precioBaseNumerico, b.moneda) - convertToCRC(a.precioBaseNumerico, a.moneda));
    }

    return result;
  }, [displayedProperties, filters, rejected]);

  // AGRUPACIÓN POR EXPEDIENTE
  const groupedProperties = useMemo(() => {
    const groups: Record<string, Property[]> = {};
    filteredProperties.forEach(p => {
      const key = p.numeroExpediente ? p.numeroExpediente : p.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return Object.values(groups);
  }, [filteredProperties]);


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
                  onUpdateProperty={handlePropertyUpdate} // Para actualizar estrategia
                />
              </div>
           </div>
        </div>

        {/* MARKET */}
        <div className={activeTab === 'market' ? 'block' : 'hidden'}>
           
           <Dashboard properties={filteredProperties} onFilterByProvince={(p) => setFilters(prev => ({...prev, provincia: p}))} onSelect={(p) => setSelectedGroup([p])} />

           {/* Toolbar (Search & Filters) */}
           <div className="sticky top-[70px] z-30 mb-6 bg-white/90 p-3 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between backdrop-blur-xl border border-white/50">
                 <div className="flex items-center gap-2 w-full md:w-auto flex-1">
                    <Search className="text-slate-400" size={16} />
                    <input type="text" placeholder="Buscar..." className="w-full bg-transparent outline-none text-sm" value={filters.searchQuery} onChange={(e) => setFilters(prev => ({...prev, searchQuery: e.target.value}))} />
                 </div>
                 <div className="flex items-center gap-2">
                    <button onClick={() => setFilters(prev => ({...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc'}))} className="p-2 border rounded-lg text-slate-600"><ArrowUpDown size={16} /></button>
                    <button onClick={() => setShowFilters(!showFilters)} className={`p-2 border rounded-lg ${showFilters ? 'bg-brand-50 text-brand-600' : 'text-slate-600'}`}><Filter size={16} /></button>
                 </div>
           </div>

           {/* Advanced Filters Panel */}
           {showFilters && (
                <div className="mb-6 bg-white p-4 rounded-xl shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
                   <select className="p-2 border rounded text-sm" value={filters.provincia} onChange={(e) => setFilters(prev => ({...prev, provincia: e.target.value}))}><option value="">Provincia</option>{PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}</select>
                   <select className="p-2 border rounded text-sm" value={filters.tipoBien} onChange={(e) => setFilters(prev => ({...prev, tipoBien: e.target.value}))}><option value="">Tipo</option><option value="Propiedad">Propiedad</option><option value="Vehículo">Vehículo</option></select>
                   <select className="p-2 border rounded text-sm" value={filters.maxPrice} onChange={(e) => setFilters(prev => ({...prev, maxPrice: Number(e.target.value) || ''}))}><option value="">Precio Max</option><option value="10000000">10M</option><option value="30000000">30M</option></select>
                   <button onClick={() => setFilters(INITIAL_FILTERS)} className="text-xs text-red-500 font-bold">Limpiar</button>
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
           </div>
        </div>

      </main>

      {/* Modal */}
      {selectedGroup && (
        <PropertyDetailModal 
          items={selectedGroup}
          isOpen={!!selectedGroup} 
          onClose={() => setSelectedGroup(null)}
          onUpdate={handlePropertyUpdate}
          isFavorite={selectedGroup.some(p => favorites.includes(p.id))}
          toggleFavorite={toggleFavorite}
          user={user} 
        />
      )}

    </div>
  );
};

export default App;