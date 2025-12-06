import React, { useState, useEffect, useRef } from 'react';
import { Property, User } from '../types';
import { formatDate, formatCurrency, generateShareUrl, formatMeasurement } from '../utils/helpers';
import { X, Save, Share2, FileText, MapPin, ExternalLink, Heart, Edit2, Link, Paperclip, Trash2, Plus, Image as ImageIcon, UploadCloud, FileType, Loader2, AlertCircle, Map, EyeOff } from 'lucide-react';
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
  
  // Attachments State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    if (activeItem) {
        setEdited(activeItem);
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

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > 1024) {
            height = Math.round((height * 1024) / width);
            width = 1024;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
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
        alert("Error al subir.");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200">
      
      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in zoom-in-95" onClick={() => setLightboxImage(null)}>
           <button className="absolute top-4 right-4 text-white hover:text-red-500"><X size={32}/></button>
           <img src={lightboxImage} alt="Full view" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="glass bg-white/95 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/50">
        
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-start bg-white/60 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex-1 min-w-0 mr-2">
            
            {/* TABS SI ES MULTIPLE */}
            {allItems.length > 1 && (
               <div className="flex gap-2 mb-2 overflow-x-auto pb-1 no-scrollbar">
                  {allItems.map((item, idx) => (
                     <button
                       key={item.id}
                       onClick={() => setSelectedIndex(idx)}
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

            <h2 className="text-lg font-bold text-slate-800 flex flex-wrap items-center gap-2 leading-tight">
              {isEditing ? 
                <input 
                  className="bg-transparent border-b-2 border-brand-500 w-full focus:outline-none placeholder-slate-400 text-sm" 
                  value={edited.numeroExpediente} 
                  onChange={e => handleChange('numeroExpediente', e.target.value)}
                /> 
                : 
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 break-all">
                  <span className="text-[9px] font-normal text-slate-400 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded self-start md:self-auto">EXP</span>
                  <span className="whitespace-normal break-words leading-tight">{edited.numeroExpediente}</span>
                </div>
              }
            </h2>
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
                 onClick={() => toggleRejected(activeItem.numeroExpediente)} 
                 className={`p-2 rounded-full transition-all ${isRejected ? 'bg-slate-200 text-slate-500' : 'hover:bg-slate-100 text-slate-400'}`}
                 title={isRejected ? "Restaurar" : "Descartar (Ojo Tachado)"}
               >
                 <EyeOff size={16} className={isRejected ? "opacity-100" : ""} />
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
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-all">
                <Edit2 size={16} />
              </button>
            )}
            {isEditing && (
              <div className="flex gap-1 md:gap-2">
                 <button onClick={() => setIsEditing(false)} className="px-2 md:px-3 py-1 bg-slate-100 rounded-lg text-xs md:text-sm font-medium">Cancel</button>
                 <button onClick={handleSave} className="px-2 md:px-4 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs md:text-sm font-bold shadow-lg shadow-brand-500/20 flex items-center gap-1">
                   <Save size={14} /> <span className="hidden md:inline">Guardar</span>
                 </button>
              </div>
            )}
            <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-3 md:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* Price Grid */}
          <div className="mb-4 bg-white/80 rounded-2xl p-3 md:p-5 shadow-sm border border-slate-100">
             <div className="grid grid-cols-3 gap-0.5 md:gap-4 divide-x divide-slate-100">
                <div className="text-center px-0.5 md:px-2 flex flex-col justify-center">
                   <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">Base (1er)</div>
                   <div className="text-base md:text-2xl font-extrabold text-green-600 drop-shadow-sm break-words leading-none">
                      {isEditing ? 
                        <input type="number" className="w-full bg-transparent text-center border-b border-green-500 focus:outline-none text-sm" value={edited.precioBaseNumerico} onChange={e => handleChange('precioBaseNumerico', parseFloat(e.target.value))} />
                        : formatCurrency(edited.precioBaseNumerico, edited.moneda)}
                   </div>
                   <div className="text-[9px] md:text-[11px] text-slate-500 mt-1 font-medium bg-slate-100 inline-block px-1.5 py-0.5 rounded-full whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {isEditing ? 
                        <input type="datetime-local" className="w-full bg-transparent text-[9px]" value={edited.fechaRemate?.substring(0, 16)} onChange={e => handleChange('fechaRemate', e.target.value)} />
                        : formatDate(edited.fechaRemate, true)}
                   </div>
                </div>
                {/* 2do y 3er Remate */}
                <div className="text-center px-0.5 md:px-2 opacity-90 flex flex-col justify-center">
                   <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">2do (-25%)</div>
                   <div className="text-xs md:text-lg font-bold text-slate-700 break-words leading-none">
                     {formatCurrency(edited.montoSegundoRemateNumerico || 0, edited.moneda)}
                   </div>
                   <div className="text-[9px] md:text-[11px] text-slate-500 mt-1">{formatDate(edited.fechaSegundoRemate, true)}</div>
                </div>
                <div className="text-center px-0.5 md:px-2 opacity-75 flex flex-col justify-center">
                   <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">3er (-50%)</div>
                   <div className="text-xs md:text-lg font-bold text-slate-700 break-words leading-none">
                      {formatCurrency(edited.montoTercerRemateNumerico || 0, edited.moneda)}
                   </div>
                   <div className="text-[9px] md:text-[11px] text-slate-500 mt-1">{formatDate(edited.fechaTercerRemate, true)}</div>
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
                     <div className="flex items-center gap-2 text-sm">
                        <div className="p-1.5 bg-brand-100 rounded-lg text-brand-600 shrink-0"><MapPin size={14} /></div>
                        {isEditing ? (
                          <div className="flex gap-2 w-full">
                            <input className="border rounded p-1.5 w-full bg-white text-xs" value={edited.provincia} onChange={e => handleChange('provincia', e.target.value)} />
                            <input className="border rounded p-1.5 w-full bg-white text-xs" value={edited.canton} onChange={e => handleChange('canton', e.target.value)} />
                          </div>
                        ) : (
                          <span className="font-medium text-sm md:text-base text-slate-700">{edited.provincia}, {edited.canton}</span>
                        )}
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
      </div>
    </div>
  );
};