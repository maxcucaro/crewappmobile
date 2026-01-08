import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToast } from '../../context/ToastContext';
import { FileText, Download, Calendar, Clock } from 'lucide-react';

interface TimesheetEntry {
  id: string;
  crew_id: string;
  data: string;
  ore_lavorate: number;
  ore_straordinario: number;
  tipo_turno: string;
  crew_members: {
    nome: string;
    cognome: string;
  };
}

export const ReportsView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const { addToast } = useToast();
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadTimesheets();
  }, [companyProfile, startDate, endDate]);

  const loadTimesheets = async () => {
    if (!companyProfile) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('timesheet_entries')
        .select('*, crew_members(nome, cognome)')
        .eq('azienda_id', companyProfile.id)
        .gte('data', startDate)
        .lte('data', endDate)
        .order('data', { ascending: false });

      if (error) throw error;
      setTimesheets(data || []);
    } catch (error: any) {
      addToast(error.message || 'Errore nel caricamento report', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = timesheets.reduce((sum, entry) => sum + entry.ore_lavorate, 0);
  const totalOvertime = timesheets.reduce((sum, entry) => sum + (entry.ore_straordinario || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Report Presenze</h2>
        <p className="text-gray-600 mt-1">Visualizza ed esporta i report delle presenze</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Inizio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Data Fine</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Totale Registrazioni</p>
              <p className="text-2xl font-bold text-gray-900">{timesheets.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Ore Totali</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Straordinari</p>
              <p className="text-2xl font-bold text-gray-900">{totalOvertime.toFixed(1)}h</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Dipendente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tipo Turno
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ore Lavorate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Straordinari
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {timesheets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Nessuna registrazione trovata per questo periodo
                    </td>
                  </tr>
                ) : (
                  timesheets.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {entry.crew_members.nome} {entry.crew_members.cognome}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(entry.data).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {entry.tipo_turno}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {entry.ore_lavorate}h
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-orange-600">
                        {entry.ore_straordinario || 0}h
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
