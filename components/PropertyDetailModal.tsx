
import React, { useState, useEffect, useRef } from 'react';
import { Property, User } from '../types';
import { formatDate, formatCurrency, generateShareUrl, formatMeasurement, calculateFinancials, convertToCRC, resizeImage } from '../utils/helpers';
import { TRANSFER_TAX_RATE, LEGAL_FEES_RATE } from '../constants';
import { X, Save, Share2, FileText, MapPin, ExternalLink, Heart, Edit2, Link, Paperclip, Trash2, Plus, Image as ImageIcon, UploadCloud, FileType, Loader2, AlertCircle, Map, EyeOff, Calculator, TrendingUp, AlertTriangle, CheckCircle, Target } from 'lucide-react';
import { db, collection, addDoc, deleteDoc, getDocs, doc, query, orderBy } from '../firebase';

interface Props {
  property?: Property; 
  items?: Property[]; 
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Property) => void;
  isFavorite: boolean;
  toggleFavorite: (id: string) => void;
  toggleRejected?: (id: string) => void; 
  isRejected?: boolean;
  user: User | null;
}

export const PropertyDetailModal: React.FC<Props> = ({ property, items, isOpen, onClose, onUpdate, isFavorite, toggleFavorite, toggleRejected, isRejected, user }) => {
  const allItems = items || (property ? [property] : []);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const activeItem = allItems[selectedIndex];

  const [edited, setEdited] = useState<Property>(activeItem);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'calculator'>('info');

  // Attachments State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    if (activeItem) {
        setEdited(activeItem);
        // Initialize analysis if missing
        if (!activeItem.analisis) {
           const basePriceCRC = convertToCRC(activeItem.precioBaseNumerico, activeItem.moneda);
           setEdited(prev => ({
             ...prev,
             analisis: {
                valorMercadoEstimado: 0,
                precioVentaEstimado: 0,
                costoRemodelacion: 0,
                // Auto-calculate suggested legal fees
                costosLegales: Math.round(basePriceCRC * (TRANSFER_TAX_RATE + LEGAL_FEES_RATE))
             }
           }));
        }
    }
  }, [activeItem]);

  useEffect(() => {
    if (activeItem && user && isOpen) {
        fetchCloudAttachments();
    } else {
        setAttachments([]);
    }
  }, [activeItem?.id, user, isOpen]);

  const fetchCloudAttachments = async () => {
      if (!user || !activeItem) return;
      setAttachmentsLoading(true);
      try {
          const q = query(collection(db, "users", user.uid, "saved_properties", activeItem.id, "attachments"), orderBy("date", "desc"));
          const querySnapshot = await getDocs(q);
          const loadedAtts = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setAttachments(loadedAtts);
      } catch (e) {
          setAttachments([]);
      } finally {
          setAttachmentsLoading(false);
      }
  };

  if (!isOpen || !activeItem) return null;

  const handleSave = () => {
    onUpdate(edited);
    setIsEditing(false);
  };

  const handleShare = () => {
    const url = generateShareUrl(edited);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const selectStrategy = (strategy: '1er' | '2do' | '3er') => {
      // Auto save strategy on click
      const updated = { ...edited, estrategia: strategy };
      setEdited(updated);
      onUpdate(updated);
  };

  const openSIRI = () => {
     if (edited.customSiriUrl) {
       window.open(edited.customSiriUrl, "_blank");
     } else {
       window.open("https://siri.rnp.go.cr/SIRI/index.jsp", "_blank");
     }
  };

  const openMaps = () => {
    const query = encodeURIComponent(`${edited.provincia}, ${edited.canton} Costa Rica`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const handleChange = (field: keyof Property, value: any) => {
    setEdited(prev => ({ ...prev, [field]: value }));
  };
  
  const handleAnalysisChange = (field: string, value: number) => {
    setEdited(prev => ({
      ...prev,
      analisis: {
        ...prev.analisis,
        [field]: value
      }
    }));
  };

  const uploadAttachment = async (file: File) => {
    if (!user || !isFavorite) {
        alert("Debes marcar la propiedad como Favorita para adjuntar archivos.");
        return;
    }
    if (!file.type.startsWith('image/') && file.size > 1024 * 1024) { 
      alert("Los documentos no pueden pesar más de 1MB.");
      return;
    }
    setAttachmentsLoading(true);
    let data = '';
    let type: 'image' | 'file' = 'file';
    try {
        if (file.type.startsWith('image/')) {
            type = 'image';
            data = await resizeImage(file);
        } else {
            const reader = new FileReader();
            await new Promise<void>((resolve) => {
                reader.onloadend = () => {
                    data = reader.result as string;
                    resolve();
                }
                reader.readAsDataURL(file);
            });
        }
        const newAtt = {
            type,
            mimeType: file.type,
            name: file.name,
            data: data,
            date: new Date().toISOString()
        };
        const docRef = await addDoc(collection(db, "users", user.uid, "saved_properties", activeItem.id, "attachments"), newAtt);
        setAttachments(prev => [{ ...newAtt, id: docRef.id }, ...prev]);
    } catch (e) {
        console.error("Upload failed", e);
        alert("Error al subir el archivo.");
    } finally {
        setAttachmentsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(uploadAttachment);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isFavorite) return;
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(uploadAttachment);
    }
  };

  const addLinkAttachment = async () => {
    if (!user || !isFavorite) {
        alert("Marca como favorita para agregar enlaces.");
        return;
    }
    const url = prompt("Ingresa el enlace:");
    if (url) {
        setAttachmentsLoading(true);
        try {
            const newAtt = {
                type: 'link',
                name: 'Enlace externo',
                data: url,
                date: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, "users", user.uid, "saved_properties", activeItem.id, "attachments"), newAtt);
            setAttachments(prev => [{ ...newAtt, id: docRef.id }, ...prev]);
        } catch (e) { console.error(e); } finally { setAttachmentsLoading(false); }
    }
  };

  const removeAttachment = async (attId: string) => {
    if (!user || !isFavorite) return;
    if (!window.confirm("¿Borrar archivo?")) return;
    try {
        await deleteDoc(doc(db, "users", user.uid, "saved_properties", activeItem.id, "attachments", attId));
        setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (e) { console.error("Delete failed", e); }
  };

  const isVehicle = edited.tipoBien === 'Vehículo';
  const financials = calculateFinancials(edited);
  const strategy = edited.estrategia || '1er';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-2 md:p-4 animate-in fade-in duration-200">
      
      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in zoom-in-95" onClick={() => setLightboxImage(null)}>
           <button className="absolute top-4 right-4 text-white hover:text-red-500"><X size={32}/></button>
           <img src={lightboxImage} alt="Full view" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="glass bg-white/95 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/50">
        
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-start bg-white/60 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex-1 min-w-0 mr-2">
            
            {/* TABS SI ES MULTIPLE */}
            {allItems.length > 1 && (
               <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                  {allItems.map((item, idx) => (
                     <button
                       key={item.id || idx} // FIXED: Usar ID estable
                       onClick={() => { setSelectedIndex(idx); setActiveTab('info'); }}
                       className={`px-3 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider whitespace-nowrap transition-all ${
                         idx === selectedIndex 
                           ? 'bg-brand-600 text-white border-brand-600 shadow-md' 
                           : 'bg-white text-slate-500 border-slate-200 hover:border-brand-300'
                       }`}
                     >
                       {item.tipoBien === 'Vehículo' ? 'Vehículo' : `Propiedad ${idx + 1}`}
                     </button>
                  ))}
               </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 leading-tight">
                {isEditing ? 
                  <input 
                    className="bg-transparent border-b-2 border-brand-500 w-full focus:outline-none placeholder-slate-400 text-sm" 
                    value={edited.numeroExpediente} 
                    onChange={e => handleChange('numeroExpediente', e.target.value)}
                  /> 
                  : 
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded">EXP</span>
                     <span className="select-all">{edited.numeroExpediente}</span>
                  </div>
                }
              </h2>
              {/* Risk Badges */}
              {edited.riesgos && edited.riesgos.length > 0 && (
                 <div className="flex gap-1 flex-wrap">
                    {edited.riesgos.map((r, i) => (
                      <span key={i} className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border border-red-100 flex items-center gap-1">
                        <AlertTriangle size={10} /> {r}
                      </span>
                    ))}
                 </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-slate-500 mt-1.5 items-center">
               <span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-brand-100 whitespace-nowrap">
                 {edited.tipoBien}
               </span>
               <span className="opacity-80 text-xs truncate max-w-[150px] md:max-w-md">{edited.juzgado}</span>
            </div>
          </div>
          
          <div className="flex gap-1.5 items-center shrink-0">
             {toggleRejected && (
               <button 
                 onClick={() => { toggleRejected(activeItem.numeroExpediente); onClose(); }} 
                 className={`flex items-center gap-1 px-3 py-2 rounded-full transition-all text-xs font-bold ${isRejected ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800'}`}
                 title={isRejected ? "Restaurar" : "Descartar de lista"}
               >
                 <EyeOff size={14} />
                 {isRejected ? "Restaurar" : "Descartar"}
               </button>
             )}
             <button 
                onClick={() => toggleFavorite(activeItem.id)}
                className={`p-2 rounded-full transition-all duration-200 ${isFavorite ? 'bg-red-50 text-red-500 shadow-inner' : 'hover:bg-slate-100 text-slate-400 hover:text-red-400'}`}
              >
                <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
            </button>
            <button onClick={handleShare} className="p-2 hover:bg-slate-100 rounded-full text-brand-600 relative transition-all">
              <Share2 size={16} />
              {copied && <span className="absolute top-10 right-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg z-50">Copiado</span>}
            </button>
            
            {/* Editing Toggle is inside tab content usually, but here fine */}
            {activeTab === 'info' && !isEditing && (
               <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-all"><Edit2 size={16} /></button>
            )}
            
            {(isEditing || activeTab === 'calculator') && (
               <button onClick={handleSave} className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-full shadow-lg shadow-brand-500/20">
                   <Save size={16} />
               </button>
            )}

            <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
             <button 
               onClick={() => setActiveTab('info')} 
               className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'info' ? 'border-brand-500 text-brand-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
             >
                <FileText size={14} /> Información
             </button>
             <button 
               onClick={() => setActiveTab('calculator')} 
               className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'calculator' ? 'border-green-500 text-green-700 bg-green-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
             >
                <Calculator size={14} /> Calculadora ROI
             </button>
        </div>

        <div className="p-3 md:p-6 overflow-y-auto flex-1 bg-slate-50/30">
          
          {/* TAB: INFO */}
          {activeTab === 'info' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Price Grid Interactive */}
                <div className="mb-4">
                    <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-2">
                        <Target size={12}/> Selecciona tu Estrategia de Entrada
                    </h4>
                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                        {/* 1er Remate */}
                        <div 
                          onClick={() => selectStrategy('1er')}
                          className={`rounded-2xl p-3 border-2 cursor-pointer transition-all hover:scale-[1.02] ${strategy === '1er' ? 'bg-white border-brand-500 shadow-md ring-4 ring-brand-500/10' : 'bg-white/60 border-transparent hover:bg-white hover:border-brand-200'}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <div className={`text-[8px] md:text-[10px] font-bold uppercase tracking-widest ${strategy === '1er' ? 'text-brand-600' : 'text-slate-400'}`}>Base (1er)</div>
                                {strategy === '1er' && <CheckCircle size={12} className="text-brand-500"/>}
                            </div>
                            <div className={`text-sm md:text-xl font-extrabold break-words leading-none ${strategy === '1er' ? 'text-slate-800' : 'text-slate-500'}`}>
                                {isEditing ? 
                                    <input type="number" className="w-full bg-transparent text-center border-b border-green-500 focus:outline-none text-sm" value={edited.precioBaseNumerico} onClick={e => e.stopPropagation()} onChange={e => handleChange('precioBaseNumerico', parseFloat(e.target.value))} />
                                    : formatCurrency(edited.precioBaseNumerico, edited.moneda)}
                            </div>
                            <div className="text-[9px] md:text-[10px] text-slate-400 mt-1 truncate">
                                {formatDate(edited.fechaRemate, true)}
                            </div>
                        </div>

                        {/* 2do Remate */}
                        <div 
                           onClick={() => selectStrategy('2do')}
                           className={`rounded-2xl p-3 border-2 cursor-pointer transition-all hover:scale-[1.02] ${strategy === '2do' ? 'bg-white border-brand-500 shadow-md ring-4 ring-brand-500/10' : 'bg-white/60 border-transparent hover:bg-white hover:border-brand-200'}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <div className={`text-[8px] md:text-[10px] font-bold uppercase tracking-widest ${strategy === '2do' ? 'text-brand-600' : 'text-slate-400'}`}>2do (-25%)</div>
                                {strategy === '2do' && <CheckCircle size={12} className="text-brand-500"/>}
                            </div>
                            <div className={`text-xs md:text-lg font-bold break-words leading-none ${strategy === '2do' ? 'text-slate-800' : 'text-slate-500'}`}>
                                {formatCurrency(edited.montoSegundoRemateNumerico || 0, edited.moneda)}
                            </div>
                            <div className="text-[9px] md:text-[10px] text-slate-400 mt-1 truncate">{formatDate(edited.fechaSegundoRemate, true)}</div>
                        </div>

                        {/* 3er Remate */}
                        <div 
                           onClick={() => selectStrategy('3er')}
                           className={`rounded-2xl p-3 border-2 cursor-pointer transition-all hover:scale-[1.02] ${strategy === '3er' ? 'bg-white border-brand-500 shadow-md ring-4 ring-brand-500/10' : 'bg-white/60 border-transparent hover:bg-white hover:border-brand-200'}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <div className={`text-[8px] md:text-[10px] font-bold uppercase tracking-widest ${strategy === '3er' ? 'text-brand-600' : 'text-slate-400'}`}>3er (-50%)</div>
                                {strategy === '3er' && <CheckCircle size={12} className="text-brand-500"/>}
                            </div>
                            <div className={`text-xs md:text-lg font-bold break-words leading-none ${strategy === '3er' ? 'text-slate-800' : 'text-slate-500'}`}>
                                {formatCurrency(edited.montoTercerRemateNumerico || 0, edited.moneda)}
                            </div>
                            <div className="text-[9px] md:text-[10px] text-slate-400 mt-1 truncate">{formatDate(edited.fechaTercerRemate, true)}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        {/* Description */}
                        <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Detalle del Bien</h4>
                            {isEditing ? 
                                <textarea rows={6} className="w-full bg-white border rounded-xl p-3 text-xs" value={edited.descripcion} onChange={e => handleChange('descripcion', e.target.value)} />
                                : <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words">{edited.descripcion}</p>
                            }
                        </div>
                        
                        {/* Location */}
                        {!isVehicle && (
                            <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Ubicación & Legal</h4>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase text-slate-400">Provincia</span>
                                        {isEditing ? (
                                            <input className="border rounded p-1.5 w-full bg-white text-xs" value={edited.provincia} onChange={e => handleChange('provincia', e.target.value)} />
                                        ) : (
                                            <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                                                <MapPin size={14} className="text-brand-500"/> {edited.provincia}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase text-slate-400">Cantón</span>
                                        {isEditing ? (
                                            <input className="border rounded p-1.5 w-full bg-white text-xs" value={edited.canton} onChange={e => handleChange('canton', e.target.value)} />
                                        ) : (
                                            <div className="flex items-center gap-1 text-sm font-bold text-slate-800">
                                                <Map size={14} className="text-slate-400"/> {edited.canton || 'No especificado'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Technical Data / SIRI */}
                        <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                            <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                            {isVehicle ? "Datos del Vehículo" : "Datos Técnicos"}
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-2">
                                {!isVehicle && (
                                    <>
                                        <div className="p-2.5 bg-slate-50 rounded-xl"><span className="text-[9px] uppercase text-slate-400 block">Medidas</span><span className="font-bold text-sm">{formatMeasurement(edited.medidasNumericas)}</span></div>
                                        <div className="p-2.5 bg-slate-50 rounded-xl"><span className="text-[9px] uppercase text-slate-400 block">ID Finca</span><span className="font-bold text-sm">{edited.fincaId || 'ND'}</span></div>
                                        <div className="p-2.5 bg-slate-50 rounded-xl col-span-2"><span className="text-[9px] uppercase text-slate-400 block">Plano</span><span className="font-bold text-sm">{edited.plano || 'ND'}</span></div>
                                    </>
                                )}
                                {isVehicle && (
                                    <>
                                        <div className="p-2.5 bg-slate-50 rounded-xl"><span className="text-[9px] uppercase text-slate-400 block">Placa</span><span className="font-bold text-sm">{edited.placa || 'ND'}</span></div>
                                        <div className="p-2.5 bg-slate-50 rounded-xl"><span className="text-[9px] uppercase text-slate-400 block">Marca</span><span className="font-bold text-sm">{edited.marca || 'ND'}</span></div>
                                    </>
                                )}
                            </div>

                            {!isVehicle && (
                            <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                <div className="flex gap-2">
                                    <button onClick={openSIRI} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 text-white font-bold rounded-xl shadow-md text-xs md:text-sm">
                                        <ExternalLink size={16} /> Consultar SIRI
                                    </button>
                                    <button onClick={openMaps} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 rounded-xl shadow-sm" title="Ver en Mapa">
                                        <Map size={18} />
                                    </button>
                                </div>
                            </div>
                            )}
                        </div>

                        {/* Attachments Section */}
                        <div 
                            className={`bg-white/80 p-4 rounded-2xl border transition-all duration-300 shadow-sm ${isDragging ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/50' : 'border-slate-100'}`}
                            onDragOver={(e) => { e.preventDefault(); if(isFavorite) setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            >
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Paperclip size={12} /> Archivos y Notas {attachments.length > 0 && `(${attachments.length})`}
                                </h4>
                                {isFavorite ? (
                                <div className="flex gap-1">
                                    <button onClick={addLinkAttachment} disabled={attachmentsLoading} className="p-1 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded" title="Agregar enlace"><Link size={14}/></button>
                                    <label className="p-1 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded cursor-pointer" title="Subir archivo">
                                        <Plus size={14} />
                                        <input type="file" className="hidden" multiple accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} ref={fileInputRef} disabled={attachmentsLoading} />
                                    </label>
                                </div>
                                ) : (
                                    <div className="text-[9px] text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <AlertCircle size={10} /> Marca como favorita para adjuntar
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 min-h-[50px] relative">
                                {attachmentsLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] z-10">
                                        <Loader2 className="animate-spin text-brand-500" size={20} />
                                    </div>
                                )}

                                {attachments.map((att) => (
                                <div key={att.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 group">
                                    <div className="p-1.5 bg-white rounded shadow-sm shrink-0 text-slate-500">
                                        {att.type === 'image' ? <ImageIcon size={14} /> : att.type === 'link' ? <Link size={14} /> : <FileType size={14} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        {att.type === 'image' ? (
                                        <button onClick={() => setLightboxImage(att.data)} className="text-xs text-brand-600 hover:underline truncate block font-medium text-left w-full">
                                            {att.name}
                                        </button>
                                        ) : att.type === 'link' ? (
                                        <a href={att.data} target="_blank" className="text-xs text-brand-600 hover:underline truncate block">{att.data}</a>
                                        ) : (
                                        <a href={att.data} download={att.name} className="text-xs text-slate-700 truncate block hover:text-brand-600">{att.name}</a>
                                        )}
                                    </div>
                                    {isFavorite && (
                                        <button onClick={() => removeAttachment(att.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                                ))}
                                
                                {attachments.length === 0 && isFavorite && (
                                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 flex flex-col items-center gap-2 pointer-events-none">
                                    <UploadCloud size={20} className={isDragging ? 'text-brand-500 animate-bounce' : ''}/>
                                    <span className="text-xs">{isDragging ? 'Suelta los archivos aquí' : 'Arrastra imágenes, PDF o Word aquí'}</span>
                                </div>
                                )}
                            </div>
                        </div>

                        {/* Text Original */}
                        <div className="bg-white/80 p-3 rounded-2xl border border-slate-100 shadow-sm mt-4">
                            <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer text-slate-500 text-[10px] font-bold uppercase tracking-widest list-none">
                                Ver Texto Original <FileText size={14} />
                            </summary>
                            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-[9px] font-mono text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                {edited.textoEspecifico || edited.originalText || "Texto no disponible"}
                            </div>
                            </details>
                        </div>
                    </div>
                </div>
            </div>
          )}

          {/* TAB: CALCULATOR */}
          {activeTab === 'calculator' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Inputs */}
                <div className="space-y-4">
                   <div className="bg-white/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                         <Calculator size={14}/> Costos de Adquisición
                      </h4>
                      
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-600">Base del Remate ({edited.estrategia || '1er'})</span>
                            <span className="font-bold text-slate-800">{formatCurrency(financials.acquisitionCost, edited.moneda)}</span>
                         </div>
                         
                         <div>
                            <label className="text-xs text-slate-500 block mb-1">Costos Legales & Traspaso (Est.)</label>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs">₡</span>
                                <input 
                                  type="number" 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 ring-brand-500 outline-none"
                                  value={edited.analisis?.costosLegales || ''}
                                  onChange={(e) => handleAnalysisChange('costosLegales', parseFloat(e.target.value))}
                                  placeholder="0"
                                />
                            </div>
                         </div>

                         <div>
                            <label className="text-xs text-slate-500 block mb-1">Remodelación / Reparaciones</label>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs">₡</span>
                                <input 
                                  type="number" 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:ring-2 ring-brand-500 outline-none"
                                  value={edited.analisis?.costoRemodelacion || ''}
                                  onChange={(e) => handleAnalysisChange('costoRemodelacion', parseFloat(e.target.value))}
                                  placeholder="0"
                                />
                            </div>
                         </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                          <span className="font-bold text-slate-700 text-sm">Inversión Total</span>
                          <span className="font-extrabold text-brand-700 text-lg">₡{formatCurrency(financials.totalInvestment, 'CRC').replace('CRC', '').trim()}</span>
                      </div>
                   </div>

                   <div className="bg-white/80 p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                         <TrendingUp size={14}/> Proyección de Salida
                      </h4>
                      <div>
                            <label className="text-xs text-slate-500 block mb-1">Precio de Venta Estimado</label>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs">₡</span>
                                <input 
                                  type="number" 
                                  className="w-full bg-green-50 border border-green-200 rounded-lg p-2 text-sm focus:ring-2 ring-green-500 outline-none font-bold text-green-700"
                                  value={edited.analisis?.precioVentaEstimado || ''}
                                  onChange={(e) => handleAnalysisChange('precioVentaEstimado', parseFloat(e.target.value))}
                                  placeholder="0"
                                />
                            </div>
                      </div>
                   </div>
                </div>

                {/* Results */}
                <div className="flex flex-col gap-4">
                    <div className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center text-center shadow-sm h-full ${financials.netProfit > 0 ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">ROI Potencial</div>
                        <div className={`text-5xl font-black mb-2 ${financials.netProfit > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            {financials.roi.toFixed(1)}%
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-500">Ganancia Neta:</span>
                            <span className={`text-lg font-bold ${financials.netProfit > 0 ? 'text-green-700' : 'text-slate-600'}`}>
                                ₡{formatCurrency(financials.netProfit, 'CRC').replace('CRC', '').trim()}
                            </span>
                        </div>
                        
                        {financials.roi > 20 && (
                            <div className="mt-4 flex items-center gap-1.5 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                <CheckCircle size={14} /> Oportunidad Atractiva
                            </div>
                        )}
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 text-yellow-800 text-xs space-y-2">
                        <div className="font-bold flex items-center gap-2"><AlertTriangle size={14}/> Recordatorios:</div>
                        <ul className="list-disc pl-4 space-y-1 opacity-90">
                            <li>Revisar gravámenes en el Registro Nacional antes de ofertar.</li>
                            <li>Considerar costos de desalojo si la propiedad está ocupada.</li>
                            <li>El impuesto de traspaso suele ser ~2.5% del valor fiscal o real.</li>
                        </ul>
                    </div>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
