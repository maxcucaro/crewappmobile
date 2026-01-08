import React, { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, TrendingUp, Users, Calendar, Receipt, Clock } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../utils/supabase';

interface Stats {
  vacations: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
  };
  expenses: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
    pendingAmount: number;
    approvedAmount: number;
    totalAmount: number;
  };
  overtime: {
    pending: number;
    approved: number;
    rejected: number;
    total: number;
    pendingHours: number;
    approvedHours: number;
    totalHours: number;
  };
}

const CompanyRiepilogoRichieste: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { showError } = useToastContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    vacations: { pending: 0, approved: 0, rejected: 0, total: 0 },
    expenses: { pending: 0, approved: 0, rejected: 0, total: 0, pendingAmount: 0, approvedAmount: 0, totalAmount: 0 },
    overtime: { pending: 0, approved: 0, rejected: 0, total: 0, pendingHours: 0, approvedHours: 0, totalHours: 0 }
  });
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (companyProfile?.id) {
      findCompanyId();
    }
  }, [companyProfile?.id]);

  useEffect(() => {
    if (companyId) {
      loadStats();
    }
  }, [companyId]);

  const findCompanyId = async () => {
    try {
      const { data, error } = await supabase
        .from('regaziendasoftware')
        .select('id')
        .eq('auth_user_id', companyProfile?.user_id)
        .maybeSingle();

      if (error) {
        console.error('Errore ricerca company_id:', error);
        return;
      }

      if (data?.id) {
        setCompanyId(data.id);
      }
    } catch (err) {
      console.error('Eccezione findCompanyId:', err);
    }
  };

  const loadStats = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const [vacationsRes, expensesRes, overtimeRes] = await Promise.all([
        supabase
          .from('crew_richiesteferie_permessi')
          .select('stato, giorni_richiesti, ore_richieste')
          .eq('azienda_id', companyId),
        supabase
          .from('crew_richiestenota_spese')
          .select('stato, importo')
          .eq('azienda_id', companyId),
        supabase
          .from('crew_richieste_straordinari')
          .select('stato, ore_straordinarie')
          .eq('azienda_id', companyId)
      ]);

      const vacations = vacationsRes.data || [];
      const expenses = expensesRes.data || [];
      const overtime = overtimeRes.data || [];

      setStats({
        vacations: {
          pending: vacations.filter(v => v.stato === 'in_attesa').length,
          approved: vacations.filter(v => v.stato === 'approvata').length,
          rejected: vacations.filter(v => v.stato === 'rifiutata').length,
          total: vacations.length
        },
        expenses: {
          pending: expenses.filter(e => e.stato === 'in_attesa').length,
          approved: expenses.filter(e => e.stato === 'approvata').length,
          rejected: expenses.filter(e => e.stato === 'rifiutata').length,
          total: expenses.length,
          pendingAmount: expenses.filter(e => e.stato === 'in_attesa').reduce((sum, e) => sum + (e.importo || 0), 0),
          approvedAmount: expenses.filter(e => e.stato === 'approvata').reduce((sum, e) => sum + (e.importo || 0), 0),
          totalAmount: expenses.reduce((sum, e) => sum + (e.importo || 0), 0)
        },
        overtime: {
          pending: overtime.filter(o => o.stato === 'in_attesa').length,
          approved: overtime.filter(o => o.stato === 'approvata').length,
          rejected: overtime.filter(o => o.stato === 'rifiutata').length,
          total: overtime.length,
          pendingHours: overtime.filter(o => o.stato === 'in_attesa').reduce((sum, o) => sum + (o.ore_straordinarie || 0), 0),
          approvedHours: overtime.filter(o => o.stato === 'approvata').reduce((sum, o) => sum + (o.ore_straordinarie || 0), 0),
          totalHours: overtime.reduce((sum, o) => sum + (o.ore_straordinarie || 0), 0)
        }
      });
    } catch (err) {
      console.error('Errore caricamento statistiche:', err);
      showError('Errore nel caricamento delle statistiche');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const totalPending = stats.vacations.pending + stats.expenses.pending + stats.overtime.pending;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Riepilogo Richieste</h2>
            <p className="text-sm text-gray-400">Panoramica generale</p>
          </div>
          <button
            onClick={() => loadStats()}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {totalPending > 0 && (
          <div className="mb-4 p-4 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500 rounded-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{totalPending}</div>
                <div className="text-sm text-yellow-200">Richieste in attesa di approvazione</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Calendar className="h-6 w-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Ferie e Permessi</h3>
            <p className="text-sm text-gray-400">Gestione assenze</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-yellow-400">{stats.vacations.pending}</div>
            <div className="text-xs text-gray-400">In attesa</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-green-400">{stats.vacations.approved}</div>
            <div className="text-xs text-gray-400">Approvate</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-red-400">{stats.vacations.rejected}</div>
            <div className="text-xs text-gray-400">Rifiutate</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-blue-400">{stats.vacations.total}</div>
            <div className="text-xs text-gray-400">Totali</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Receipt className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Note Spese</h3>
            <p className="text-sm text-gray-400">Rimborsi dipendenti</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-xl font-bold text-yellow-400">{formatCurrency(stats.expenses.pendingAmount)}</div>
            <div className="text-xs text-gray-400">In attesa ({stats.expenses.pending})</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-xl font-bold text-green-400">{formatCurrency(stats.expenses.approvedAmount)}</div>
            <div className="text-xs text-gray-400">Approvate ({stats.expenses.approved})</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-red-400">{stats.expenses.rejected}</div>
            <div className="text-xs text-gray-400">Rifiutate</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-xl font-bold text-blue-400">{formatCurrency(stats.expenses.totalAmount)}</div>
            <div className="text-xs text-gray-400">Totale ({stats.expenses.total})</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Clock className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Straordinari</h3>
            <p className="text-sm text-gray-400">Ore aggiuntive</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-xl font-bold text-yellow-400">{stats.overtime.pendingHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-400">In attesa ({stats.overtime.pending})</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-xl font-bold text-green-400">{stats.overtime.approvedHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-400">Approvate ({stats.overtime.approved})</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl font-bold text-red-400">{stats.overtime.rejected}</div>
            <div className="text-xs text-gray-400">Rifiutate</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="text-xl font-bold text-blue-400">{stats.overtime.totalHours.toFixed(1)}h</div>
            <div className="text-xs text-gray-400">Totali ({stats.overtime.total})</div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-xl p-4 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-bold text-white">Riepilogo Generale</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{totalPending}</div>
            <div className="text-xs text-gray-400">In attesa</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {stats.vacations.approved + stats.expenses.approved + stats.overtime.approved}
            </div>
            <div className="text-xs text-gray-400">Approvate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {stats.vacations.total + stats.expenses.total + stats.overtime.total}
            </div>
            <div className="text-xs text-gray-400">Totali</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyRiepilogoRichieste;
