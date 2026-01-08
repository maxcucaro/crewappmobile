import React, { useState, useEffect } from 'react';
import { Users, Calendar, AlertCircle, CheckCircle, Euro, FileText } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { supabase } from '../../utils/supabase';

interface DashboardStats {
  totalEmployees: number;
  activeShifts: number;
  pendingRequests: number;
  pendingExpenses: number;
}

const CompanyMobileDashboard: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeShifts: 0,
    pendingRequests: 0,
    pendingExpenses: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyProfile?.id) {
      loadDashboardData();
    }
  }, [companyProfile?.id]);

  const loadDashboardData = async () => {
    if (!companyProfile?.id) return;

    try {
      setLoading(true);

      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth, 1).toISOString().split('T')[0];
      const endOfMonth = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0];

      const [
        employeesResult,
        shiftsResult,
        vacationRequestsResult,
        expensesResult
      ] = await Promise.all([
        supabase
          .from('crew_members')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyProfile.id),

        supabase
          .from('crew_assegnazione_turni')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', companyProfile.id)
          .gte('data_turno', startOfMonth)
          .lte('data_turno', endOfMonth),

        supabase
          .from('crew_richiesteferie_permessi')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', companyProfile.id)
          .eq('stato', 'in_attesa'),

        supabase
          .from('crew_note_spese')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', companyProfile.id)
          .eq('stato', 'in_attesa')
      ]);

      const totalEmployees = employeesResult.count || 0;
      const activeShifts = shiftsResult.count || 0;
      const pendingRequests = vacationRequestsResult.count || 0;
      const pendingExpenses = expensesResult.count || 0;

      console.log('Dashboard Stats:', {
        companyId: companyProfile.id,
        totalEmployees,
        activeShifts,
        pendingRequests,
        pendingExpenses
      });

      setStats({
        totalEmployees,
        activeShifts,
        pendingRequests,
        pendingExpenses
      });

    } catch (err) {
      console.error('Errore caricamento dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Dashboard Azienda</h1>
        <p className="text-blue-100">{companyProfile?.ragione_sociale}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalEmployees}</p>
              <p className="text-sm text-gray-400">Dipendenti</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <Calendar className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.activeShifts}</p>
              <p className="text-sm text-gray-400">Turni mese</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.pendingRequests}</p>
              <p className="text-sm text-gray-400">Richieste</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <FileText className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.pendingExpenses}</p>
              <p className="text-sm text-gray-400">Note spese</p>
            </div>
          </div>
        </div>
      </div>

      {(stats.pendingRequests > 0 || stats.pendingExpenses > 0) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-200 mb-1">Azioni in sospeso</h4>
              <ul className="text-sm text-yellow-100 space-y-1">
                {stats.pendingRequests > 0 && (
                  <li>• {stats.pendingRequests} {stats.pendingRequests === 1 ? 'richiesta' : 'richieste'} ferie/permessi da approvare</li>
                )}
                {stats.pendingExpenses > 0 && (
                  <li>• {stats.pendingExpenses} {stats.pendingExpenses === 1 ? 'nota spese' : 'note spese'} da approvare</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="font-semibold text-white mb-3">Accesso Rapido</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors">
            <Users className="h-5 w-5 text-blue-400 mb-1" />
            <p className="text-sm font-medium text-white">Dipendenti</p>
          </button>
          <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors">
            <Calendar className="h-5 w-5 text-green-400 mb-1" />
            <p className="text-sm font-medium text-white">Calendario</p>
          </button>
          <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors">
            <FileText className="h-5 w-5 text-orange-400 mb-1" />
            <p className="text-sm font-medium text-white">Richieste</p>
          </button>
          <button className="p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors">
            <Euro className="h-5 w-5 text-purple-400 mb-1" />
            <p className="text-sm font-medium text-white">Report</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyMobileDashboard;
