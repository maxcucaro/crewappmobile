import React, { useState, useEffect } from 'react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToast } from '../../context/ToastContext';
import { Building2, Mail, Lock, LogIn, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabase';

export const CompanyLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [releaseDate, setReleaseDate] = useState<string>('Dicembre 2025');
  const { signIn } = useCompanyAuth();
  const { addToast } = useToast();

  const formatReleaseDate = (dateString: string): string => {
    const date = new Date(dateString);
    const months = [
      'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
      'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
    ];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${month} ${year}`;
  };

  useEffect(() => {
    const loadVersionInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('software_versions')
          .select('current_version, release_date')
          .eq('software_code', 'app_crew_azienda')
          .eq('is_active', true)
          .order('release_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !error) {
          setAppVersion(data.current_version);
          setReleaseDate(formatReleaseDate(data.release_date));
        }
      } catch (error) {
        console.error('Errore caricamento versione:', error);
      }
    };

    loadVersionInfo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      addToast('Accesso effettuato con successo', 'success');
    } catch (error: any) {
      console.error('Errore login azienda:', error);

      let errorMessage = 'Errore durante l\'accesso';

      if (error.message === 'EMPLOYEE_LOGIN') {
        errorMessage = 'Accesso negato. Sei un dipendente, usa l\'App Dipendenti per accedere.';
      } else if (error.message === 'SUBSCRIPTION_EXPIRED') {
        errorMessage = 'Abbonamento scaduto. Contatta l\'amministratore per rinnovare.';
      } else if (error.message === 'SUBSCRIPTION_INACTIVE') {
        errorMessage = 'Abbonamento non attivo. Contatta l\'amministratore.';
      } else if (error.message === 'PASSWORD_EXPIRED') {
        errorMessage = 'Password scaduta. Contatta l\'amministratore per reimpostarla.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Back to Employee Login */}
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Torna al login dipendenti
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Crew Manager</h1>
          <p className="text-gray-600">Pannello Azienda</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Aziendale
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="azienda@esempio.it"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              'Accesso in corso...'
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Accedi
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Solo per aziende registrate</p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Versione {appVersion} - {releaseDate}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            © 2025 ControlStage - Crew Manager Azienda
          </p>
        </div>
      </div>
    </div>
  );
};
