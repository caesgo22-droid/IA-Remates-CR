import React, { useState } from 'react';
import { extractPropertiesFromText } from '../services/geminiService';
import { Property } from '../types';
import { BOLETIN_URL_DEFAULT } from '../constants';
import { FileDown, Loader2, Play, ExternalLink, Settings2, X, FileText } from 'lucide-react';
import { generateContentHash } from '../utils/helpers';

interface Props {
  onPropertiesExtracted: (props: Property[]) => void;
}

const BulletinInput: React.FC<Props> = ({ onPropertiesExtracted }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const [showUrlEdit, setShowUrlEdit] = useState(false);
  const [bulletinUrl, setBulletinUrl] = useState(BOLETIN_URL_DEFAULT);

  const handleProcess = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setWarning(null);
    setProgress(10);

    try {
      // Duplicate Check
      const hash = await generateContentHash(text);
      const processedHashes = JSON.parse(localStorage.getItem('erj_processed_hashes') || '[]');
      
      if (processedHashes.includes(hash)) {
        setWarning("Este texto ya ha sido procesado anteriormente. Se analizará de nuevo, pero podrías tener duplicados.");
      } else {
        localStorage.setItem('erj_processed_hashes', JSON.stringify([...processedHashes.slice(-50), hash]));
      }

      const extracted = await extractPropertiesFromText(text);
      setProgress(100);
      
      if (extracted.length === 0) {
        throw new Error("No se encontraron propiedades. Intenta copiar más contexto del boletín.");
      }

      onPropertiesExtracted(extracted);
      setText(''); // Clear on success
    } catch (err: any) {
      setError(err.message || 'Error al procesar el texto');
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 mb-6 border border-white/40 bg-white/70 shadow-xl backdrop-blur-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div>
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <div className="p-2 bg-brand-100 rounded-xl text-brand-600"><FileDown size={20} /></div>
            Analizador de Boletín
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-xl border border-white/20 max-w-full backdrop-blur-sm self-end md:self-auto shadow-sm">
          {showUrlEdit ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5 duration-200">
              <input 
                type="text" 
                value={bulletinUrl}
                onChange={(e) => setBulletinUrl(e.target.value)}
                className="text-xs p-1.5 rounded border-none bg-white w-32 focus:ring-1 ring-brand-500 shadow-inner"
              />
              <button onClick={() => setShowUrlEdit(false)} className="text-slate-400 hover:text-red-500 p-1">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowUrlEdit(true)} 
              className="text-slate-400 hover:text-brand-500 transition-colors p-1.5 rounded-lg hover:bg-white/50"
              title="Editar URL del Boletín"
            >
              <Settings2 size={14} />
            </button>
          )}
          
          <a 
            href={bulletinUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1 whitespace-nowrap px-3 py-1.5 rounded-lg hover:bg-white/80 transition-colors"
          >
            Ir al Boletín <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <div className="relative group">
        <textarea
          className="w-full h-40 p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-slate-800 focus:ring-0 focus:border-brand-500 focus:bg-white/80 focus:outline-none transition-all resize-y text-xs font-mono placeholder:text-slate-400"
          placeholder=" "
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />
        {!text && (
           <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-50">
             <FileText size={30} className="text-slate-400 mb-2"/>
             <span className="text-sm font-medium text-slate-500">Pega aquí el texto del edicto</span>
           </div>
        )}
        <div className="absolute bottom-3 right-3 text-[9px] text-slate-400 pointer-events-none bg-white/80 px-2 py-1 rounded-full border border-slate-100">
          {text.length} caracteres
        </div>
      </div>

      {(error || warning) && (
        <div className={`mt-3 p-3 rounded-xl text-xs border backdrop-blur-sm flex items-start gap-2 ${error ? 'bg-red-50/90 text-red-700 border-red-100' : 'bg-yellow-50/90 text-yellow-700 border-yellow-100'}`}>
          <div className={`mt-0.5 w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          {error || warning}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          onClick={handleProcess}
          disabled={loading || !text.trim()}
          className="bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 disabled:opacity-50 text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-xl shadow-brand-600/30 active:scale-95 hover:-translate-y-0.5"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Play fill="currentColor" size={18} />}
          {loading ? 'Analizando Texto...' : 'Extraer Datos'}
        </button>
      </div>

      {loading && (
        <div className="w-full bg-slate-100 rounded-full h-2 mt-5 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-brand-400 to-brand-600 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default BulletinInput;