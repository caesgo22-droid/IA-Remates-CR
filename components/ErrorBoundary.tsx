
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
           <div className="glass-card bg-white p-8 rounded-3xl text-center max-w-md shadow-2xl">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} />
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-2">Algo salió mal</h1>
              <p className="text-sm text-slate-500 mb-6">
                Se ha producido un error inesperado en la interfaz. No te preocupes, tus datos guardados están seguros.
              </p>
              
              <div className="p-3 bg-slate-100 rounded-xl text-xs font-mono text-slate-600 mb-6 overflow-hidden text-left break-all">
                  {this.state.error?.message}
              </div>

              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
              >
                 <RotateCcw size={18} /> Recargar Aplicación
              </button>
           </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
