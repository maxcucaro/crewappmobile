import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { Users, Calendar, Clock, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

interface DashboardStats {
  totalEmployees: number;
  activeShifts: number;
  pendingRequests: number;
  monthlyExpenses: number;
  todayPresent: number;
  todayAbsent: number;
}

export const CompanyDashboardView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeShifts: 0,
    pendingRequests: 0,
    monthlyExpenses: 0,
    todayPresent: 0,
    todayAbsent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, [companyProfile]);

  const loadDashboardStats = async () => {
    if (!companyProfile) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const [employeesRes, shiftsRes, requestsRes, expensesRes, checkinsRes] = await Promise.all([
        supabase
          .from('crew_members')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', companyProfile.id),

        supabase
          .from('crew_assegnazione_turni')
          .select('id', { count: 'exact', head: true })
          .eq('azienda_id', companyProfile.id)
          .gte('data_turno', today),

        supabase
          .from('richieste_ferie_permessi')
          .select('id', { count: 'exact', head: true })
          .eq('stato', 'in attesa'),

        supabase
          .from('crew_spese')
          .select('importo')
          .eq('azienda_id', companyProfile.id)
          .gte('data_spesa', firstDayOfMonth),

        supabase
          .from('warehouse_checkins')
          .select('crew_id')
          .gte('check_in_time', `${today}T00:00:00`)
          .lt('check_in_time', `${today}T23:59:59`)
      ]);

      const totalExpenses = expensesRes.data?.reduce((sum, exp) => sum + (exp.importo || 0), 0) || 0;
      const uniquePresent = new Set(checkinsRes.data?.map(c => c.crew_id) || []).size;

      const { count: totalEmp } = await supabase
        .from('crew_members')
        .select('id', { count: 'exact', head: true })
        .eq('azienda_id', companyProfile.id);

      setStats({
        totalEmployees: employeesRes.count || 0,
        activeShifts: shiftsRes.count || 0,
        pendingRequests: requestsRes.count || 0,
        monthlyExpenses: totalExpenses,
        todayPresent: uniquePresent,
        todayAbsent: (totalEmp || 0) - uniquePresent,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Dipendenti Totali',
      value: stats.totalEmployees,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
    },
    {
      title: 'Turni Attivi',
      value: stats.activeShifts,
      icon: Calendar,
      color: 'bg-green-500',
      textColor: 'text-green-600',
    },
    {
      title: 'Richieste in Attesa',
      value: stats.pendingRequests,
      icon: AlertCircle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
    },
    {
      title: 'Spese del Mese',
      value: `€${stats.monthlyExpenses.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-red-500',
      textColor: 'text-red-600',
    },
    {
      title: 'Presenti Oggi',
      value: stats.todayPresent,
      icon: TrendingUp,
      color: 'bg-teal-500',
      textColor: 'text-teal-600',
    },
    {
      title: 'Assenti Oggi',
      value: stats.todayAbsent,
      icon: Clock,
      color: 'bg-gray-500',
      textColor: 'text-gray-600',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Panoramica generale delle attività</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className={`text-3xl font-bold mt-2 ${card.textColor}`}>{card.value}</p>
                </div>
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attività Recenti</h3>
        <p className="text-gray-600">Nessuna attività recente da visualizzare</p>
      </div>
    </div>
  );
};
