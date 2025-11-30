import React, { useState, useEffect, useRef } from 'react';
import { Property, User } from '../types';
import { formatDate, formatCurrency, generateShareUrl, formatMeasurement } from '../utils/helpers';
import { X, Save, Share2, FileText, MapPin, ExternalLink, Heart, Edit2, Link, Pencil, Copy, Check, Paperclip, Trash2, Plus, Image as ImageIcon, UploadCloud, FileType, Loader2, AlertCircle, Map } from 'lucide-react';
import { db, collection, addDoc, deleteDoc, getDocs, doc, query, orderBy } from '../firebase';

interface Props {
  property: Property;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updated: Property) => void;
  isFavorite: boolean;
  toggleFavorite: (id: string) => void;
  user: User | null;
}

export const PropertyDetailModal: React.FC<Props> = ({ property, isOpen, onClose, onUpdate, isFavorite, toggleFavorite, user }) => {
  const [edited, setEdited] = useState<Property>(property);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  
  const [fincaCopied, setFincaCopied] = useState(false);
  const [planoCopied, setPlanoCopied] = useState(false);

  // Attachments State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Lightbox State
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 1. Initial Data Sync
  useEffect(() => {
    setEdited(property);
    setShowLinkInput(false);
  }, [property]);

  // 2. Fetch Attachments from Cloud (Lazy Load)
  useEffect(() => {
    if (isFavorite && user && isOpen) {
        fetchCloudAttachments();
    } else {
        setAttachments([]);
    }
  }, [property.id, isFavorite, user, isOpen]);

  const fetchCloudAttachments = async () => {
      if (!user) return;
      setAttachmentsLoading(true);
      try {
          const q = query(collection(db, "users", user.uid, "saved_properties", property.id, "attachments"), orderBy("date", "desc"));
          const querySnapshot = await getDocs(q);
          const loadedAtts = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          setAttachments(loadedAtts);
      } catch (e) {
          console.error("Error loading attachments:", e);
      } finally {
          setAttachmentsLoading(false);
      }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdate(edited);
    setIsEditing(false);
    setShowLinkInput(false);
  };

  const handleShare = () => {
    const url = generateShareUrl(edited);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyToClipboard = (text: string, setFn: (v: boolean) => void) => {
    if(!text) return;
    navigator.clipboard.writeText(text).then(() => {
        setFn(true);
        setTimeout(() => setFn(false), 1500);
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

  // --- Attachment Logic (Direct to Firestore Subcollection) ---
  
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

        const docRef = await addDoc(collection(db, "users", user.uid, "saved_properties", property.id, "attachments"), newAtt);
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
    const url = prompt("Ingresa el enlace (Drive, Dropbox, etc):");
    if (url) {
        setAttachmentsLoading(true);
        try {
            const newAtt = {
                type: 'link',
                name: 'Enlace externo',
                data: url,
                date: new Date().toISOString()
            };
            const docRef = await addDoc(collection(db, "users", user.uid, "saved_properties", property.id, "attachments"), newAtt);
            setAttachments(prev => [{ ...newAtt, id: docRef.id }, ...prev]);
        } catch (e) {
            console.error(e);
        } finally {
            setAttachmentsLoading(false);
        }
    }
  };

  const removeAttachment = async (attId: string) => {
    if (!user || !isFavorite) return;
    if (!window.confirm("¿Borrar archivo?")) return;

    try {
        await deleteDoc(doc(db, "users", user.uid, "saved_properties", property.id, "attachments", attId));
        setAttachments(prev => prev.filter(a => a.id !== attId));
    } catch (e) {
        console.error("Delete failed", e);
    }
  };

  const isVehicle = edited.tipoBien === 'Vehículo';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200">
      
      {lightboxImage && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-in zoom-in-95" onClick={() => setLightboxImage(null)}>
           <button className="absolute top-4 right-4 text-white hover:text-red-500"><X size={32}/></button>
           <img src={lightboxImage} alt="Full view" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="glass bg-white/95 w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/50">
        
        <div className="p-3 md:p-4 border-b border-slate-100 flex justify-between items-start bg-white/60 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="flex-1 min-w-0 mr-2">
            <h2 className="text-lg font-bold text-slate-800 flex flex-wrap items-center gap-2 leading-tight">
              {isEditing ? 
                <input 
                  className="bg-transparent border-b-2 border-brand-500 w-full focus:outline-none placeholder-slate-400 text-sm" 
                  value={edited.numeroExpediente} 
                  onChange={e => handleChange('numeroExpediente', e.target.value)}
                  placeholder="Número de Expediente"
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
               <span className="opacity-80 text-xs truncate max-w-[150px] md:max-w-md" title={edited.juzgado}>{edited.juzgado}</span>
            </div>
          </div>
          
          <div className="flex gap-1.5 items-center shrink-0">
             <button 
                onClick={() => toggleFavorite(property.id)}
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

                <div className="text-center px-0.5 md:px-2 opacity-90 flex flex-col justify-center">
                   <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">2do (-25%)</div>
                   <div className="text-xs md:text-lg font-bold text-slate-700 break-words leading-none">
                     {isEditing ? 
                        <input type="number" className="w-full bg-transparent text-center border-b focus:outline-none text-xs" value={edited.montoSegundoRemateNumerico || 0} onChange={e => handleChange('montoSegundoRemateNumerico', parseFloat(e.target.value))} />
                        : formatCurrency(edited.montoSegundoRemateNumerico || 0, edited.moneda)}
                   </div>
                   <div className="text-[9px] md:text-[11px] text-slate-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {isEditing ? 
                        <input type="datetime-local" className="w-full bg-transparent text-[9px]" value={edited.fechaSegundoRemate?.substring(0, 16)} onChange={e => handleChange('fechaSegundoRemate', e.target.value)} />
                        : formatDate(edited.fechaSegundoRemate, true)}
                   </div>
                </div>

                <div className="text-center px-0.5 md:px-2 opacity-75 flex flex-col justify-center">
                   <div className="text-[8px] md:text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">3er (-50%)</div>
                   <div className="text-xs md:text-lg font-bold text-slate-700 break-words leading-none">
                      {isEditing ? 
                        <input type="number" className="w-full bg-transparent text-center border-b focus:outline-none text-xs" value={edited.montoTercerRemateNumerico || 0} onChange={e => handleChange('montoTercerRemateNumerico', parseFloat(e.target.value))} />
                        : formatCurrency(edited.montoTercerRemateNumerico || 0, edited.moneda)}
                   </div>
                   <div className="text-[9px] md:text-[11px] text-slate-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {isEditing ? 
                        <input type="datetime-local" className="w-full bg-transparent text-[9px]" value={edited.fechaTercerRemate?.substring(0, 16)} onChange={e => handleChange('fechaTercerRemate', e.target.value)} />
                        : formatDate(edited.fechaTercerRemate, true)}
                   </div>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-4">
               <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Detalle del Bien</h4>
                  {isEditing ? 
                    <textarea rows={6} className="w-full bg-white border rounded-xl p-3 text-xs focus:ring-2 focus:ring-brand-500" value={edited.descripcion} onChange={e => handleChange('descripcion', e.target.value)} />
                    : <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap break-words">{edited.descripcion}</p>
                  }
               </div>
               
               {!isVehicle && (
                 <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                   <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Ubicación & Legal</h4>
                   <div className="space-y-3">
                     <div className="flex items-center gap-2 text-sm">
                        <div className="p-1.5 bg-brand-100 rounded-lg text-brand-600 shrink-0"><MapPin size={14} /></div>
                        {isEditing ? (
                          <div className="flex gap-2 w-full">
                            <input className="border rounded p-1.5 w-full bg-white text-xs" value={edited.provincia} onChange={e => handleChange('provincia', e.target.value)} placeholder="Provincia" />
                            <input className="border rounded p-1.5 w-full bg-white text-xs" value={edited.canton} onChange={e => handleChange('canton', e.target.value)} placeholder="Cantón" />
                          </div>
                        ) : (
                          <span className="font-medium text-sm md:text-base text-slate-700">{edited.provincia}, {edited.canton}</span>
                        )}
                     </div>
                     <div className="flex items-center gap-2 text-sm">
                        <div className="p-1.5 bg-slate-100 rounded-lg text-slate-500 shrink-0"><FileText size={14} /></div>
                        <span className="text-slate-600 leading-tight text-[11px] md:text-xs">{edited.juzgado}</span>
                     </div>
                   </div>
                 </div>
               )}
            </div>

            <div className="space-y-4">
              <div className="bg-white/80 p-4 rounded-2xl border border-slate-100 shadow-sm">
                <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
                  {isVehicle ? "Datos del Vehículo" : "Datos Técnicos"}
                </h4>
                
                <div className="grid grid-cols-1 gap-2 md:gap-3">
                  
                  {isVehicle ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                         <div className="p-2.5 bg-slate-50 rounded-xl relative group">
                            <span className="text-[9px] uppercase text-slate-400 block mb-0.5">Placa</span>
                            {isEditing ? 
                              <input className="w-full border-b bg-transparent font-mono text-xs font-bold" value={edited.placa || ''} onChange={e => handleChange('placa', e.target.value)} />
                              : <span className="font-mono font-bold text-sm text-slate-700">{edited.placa || 'ND'}</span>
                            }
                         </div>
                         <div className="p-2.5 bg-slate-50 rounded-xl relative group">
                            <span className="text-[9px] uppercase text-slate-400 block mb-0.5">Marca</span>
                            {isEditing ? 
                              <input className="w-full border-b bg-transparent text-xs" value={edited.marca || ''} onChange={e => handleChange('marca', e.target.value)} />
                              : <span className="font-bold text-sm text-slate-700">{edited.marca || 'ND'}</span>
                            }
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                         <div className="p-2.5 bg-slate-50 rounded-xl relative group">
                            <span className="text-[9px] uppercase text-slate-400 block mb-0.5">Modelo / Estilo</span>
                            {isEditing ? 
                              <input className="w-full border-b bg-transparent text-xs" value={edited.modelo || ''} onChange={e => handleChange('modelo', e.target.value)} />
                              : <span className="font-bold text-sm text-slate-700">{edited.modelo || 'ND'}</span>
                            }
                         </div>
                         <div className="p-2.5 bg-slate-50 rounded-xl relative group">
                            <span className="text-[9px] uppercase text-slate-400 block mb-0.5">Año</span>
                            {isEditing ? 
                              <input className="w-full border-b bg-transparent text-xs" value={edited.anio || ''} onChange={e => handleChange('anio', e.target.value)} placeholder="Ej: 2015" />
                              : <span className="font-bold text-sm text-slate-700">{edited.anio || 'ND'}</span>
                            }
                         </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-slate-50 rounded-xl relative group">
                          <span className="text-[9px] uppercase text-slate-400 block mb-0.5">Medidas</span>
                          {isEditing ? 
                            <input className="w-full border-b bg-transparent font-mono text-xs" value={edited.medidasNumericas} onChange={e => handleChange('medidasNumericas', e.target.value)} />
                            : <span className="font-mono font-bold text-sm text-slate-700">{formatMeasurement(edited.medidasNumericas || 'N/A')}</span>
                          }
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl relative group hover:bg-slate-100/50 transition-colors">
                          <span className="text-[9px] uppercase text-slate-400 block mb-0.5">ID Finca / Matrícula</span>
                          {isEditing ?
                            <input className="w-full border-b bg-transparent font-mono text-xs" value={edited.fincaId} onChange={e => handleChange('fincaId', e.target.value)} />
                            : (
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-sm text-slate-700 break-all">{edited.fincaId || 'N/A'}</span>
                                    {edited.fincaId && (
                                        <button onClick={() => copyToClipboard(edited.fincaId || '', setFincaCopied)} className="text-slate-300 hover:text-brand-500 transition-colors">
                                            {fincaCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    )}
                                </div>
                            )
                          }
                        </div>
                      </div>
                      
                      <div className="p-2.5 bg-slate-50 rounded-xl relative group hover:bg-slate-100/50 transition-colors">
                        <span className="text-[9px] uppercase text-slate-400 block mb-0.5">Plano Catastrado</span>
                        {isEditing ?
                          <input className="w-full border-b bg-transparent font-mono text-xs" value={edited.plano} onChange={e => handleChange('plano', e.target.value)} placeholder="Ej: A-000000-1990" />
                          : (
                                <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-sm text-slate-700 break-all">{edited.plano || 'N/A'}</span>
                                    {edited.plano && (
                                        <button onClick={() => copyToClipboard(edited.plano || '', setPlanoCopied)} className="text-slate-300 hover:text-brand-500 transition-colors">
                                            {planoCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                        </button>
                                    )}
                                </div>
                          )
                        }
                      </div>
                    </>
                  )}

                </div>

                {!isVehicle && (
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                     <div className="flex gap-2">
                        <button onClick={openSIRI} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold rounded-xl shadow-lg shadow-brand-500/30 transition-all hover:scale-[1.01] active:scale-95 text-xs md:text-sm">
                            <ExternalLink size={16} /> Consultar en Registro (SIRI)
                        </button>
                        <button onClick={openMaps} className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 rounded-xl shadow-sm transition-all" title="Ver en Mapa">
                            <Map size={18} />
                        </button>
                        <button 
                          onClick={() => setShowLinkInput(!showLinkInput)} 
                          className={`p-2 rounded-xl transition-colors ${showLinkInput ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}
                          title="Editar enlace"
                        >
                           <Pencil size={16} />
                        </button>
                     </div>
                     
                     {(showLinkInput || isEditing) && (
                       <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg animate-in slide-in-from-top-2">
                         <label className="text-[9px] font-bold text-yellow-700 flex items-center gap-1 mb-1 uppercase tracking-wide">
                           <Link size={10}/> Enlace SIRI Personalizado
                         </label>
                         <div className="relative">
                            <input 
                              className="w-full text-[10px] p-2 pr-6 border rounded-lg bg-white focus:ring-1 focus:ring-yellow-500 font-mono"
                              placeholder="https://siri.rnp.go.cr/..."
                              value={edited.customSiriUrl || ''}
                              onChange={e => handleChange('customSiriUrl', e.target.value)}
                            />
                            {edited.customSiriUrl && (
                               <button onClick={() => handleChange('customSiriUrl', '')} className="absolute right-1 top-1.5 text-slate-400 hover:text-red-500">
                                 <X size={12} />
                               </button>
                            )}
                         </div>
                       </div>
                     )}
                  </div>
                )}
              </div>

              {/* Attachments Section */}
              <div 
                  className={`bg-white/80 p-4 rounded-2xl border transition-all duration-300 shadow-sm animate-in fade-in slide-in-from-bottom-2 ${isDragging ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/50' : 'border-slate-100'}`}
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
                       <div key={att.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 group animate-in slide-in-from-left-2">
                          <div className="p-1.5 bg-white rounded shadow-sm shrink-0 text-slate-500">
                             {att.type === 'image' ? <ImageIcon size={14} /> : att.type === 'link' ? <Link size={14} /> : <FileType size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                             {att.type === 'link' ? (
                               <a href={att.data} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline truncate block font-medium">{att.data}</a>
                             ) : att.type === 'file' ? ( 
                               <a href={att.data} download={att.name} className="text-xs text-slate-700 truncate block font-medium hover:text-brand-600">{att.name}</a>
                             ) : att.type === 'image' ? (
                               <button 
                                  onClick={() => setLightboxImage(att.data)} 
                                  className="text-xs text-brand-600 hover:underline truncate block font-medium text-left w-full" 
                                  title="Clic para ver imagen completa"
                               >
                                 {att.name}
                               </button>
                             ) : (
                               <span className="text-xs text-slate-700 truncate block font-medium">{att.name}</span>
                             )}
                             <span className="text-[9px] text-slate-400">{new Date(att.date).toLocaleDateString()}</span>
                          </div>
                          {att.type === 'image' && (
                             <button onClick={() => setLightboxImage(att.data)} className="w-8 h-8 rounded bg-slate-200 overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-brand-500 transition-all">
                                <img src={att.data} alt="thumb" className="w-full h-full object-cover" />
                             </button>
                          )}
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
                    {attachments.length === 0 && !isFavorite && (
                        <div className="text-center py-4 text-xs text-slate-400 italic">No hay archivos adjuntos.</div>
                    )}
                  </div>
              </div>

              {/* Original Text Accordion */}
              <div className="bg-white/80 p-3 rounded-2xl border border-slate-100 shadow-sm">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer text-slate-500 hover:text-brand-500 transition-colors list-none">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Ver Texto Original</span>
                    <FileText size={14} className="transform group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-100 text-[9px] font-mono text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto leading-normal selection:bg-yellow-200">
                    {property.textoEspecifico ? (
                       <span>
                          <span className="bg-yellow-100 text-slate-800 px-1 rounded">{property.textoEspecifico}</span>
                       </span>
                    ) : (
                       property.originalText || "Texto no disponible"
                    )}
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