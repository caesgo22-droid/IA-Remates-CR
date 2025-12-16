import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from '../firebase';
import { Mail, Lock, LogIn, UserPlus, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const AuthScreen = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setError("Error al conectar con Google. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        if (!name) {
             setError("El nombre es requerido para registrarse.");
             setLoading(false);
             return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError("Credenciales incorrectas.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este correo ya está registrado.");
      } else if (err.code === 'auth/weak-password') {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("Ocurrió un error. Intenta más tarde.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
       {/* Background Aesthetics */}
       <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-200/40 rounded-full blur-[100px] animate-pulse"></div>
       <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-purple-200/40 rounded-full blur-[80px]"></div>

       <div className="glass-card w-full max-w-md bg-white/60 p-8 rounded-3xl shadow-2xl backdrop-blur-xl border border-white/50 relative z-10 animate-in zoom-in-95 duration-500">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-xl shadow-brand-500/30 mx-auto mb-4">
              RC
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Remates<span className="text-brand-600">CR</span></h1>
            <p className="text-slate-500 mt-2 text-sm">Plataforma de Inteligencia Inmobiliaria</p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            
            {isRegistering && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <UserPlus size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Tu Nombre Completo"
                  className="w-full pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative group">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="Contraseña"
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl flex items-center gap-2 border border-red-100">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18}/> : (isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión')}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white/60 px-2 text-slate-400 font-bold backdrop-blur-sm">O continúa con</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
          >
             <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {isRegistering ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
              <button 
                onClick={() => { setIsRegistering(!isRegistering); setError(null); }}
                className="text-brand-600 font-bold hover:underline"
              >
                {isRegistering ? "Inicia Sesión" : "Regístrate"}
              </button>
            </p>
          </div>
       </div>
    </div>
  );
};

export default AuthScreen;