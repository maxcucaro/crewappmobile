import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/db';
import { useAuth } from '../../../context/AuthContext';

interface RectifyTimeModalProps {
  event: {
    id: string;
    evento_id: string;
    nome_evento: string;
    giorno_inizio_evento: string;
    giorno_fine_evento: string;
  };
  existingTimesheet?: {
    id: string;
    start_time: string;
    end_time?: string;
    total_hours?: number;
    break_time?: number;
    notedipendente?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const RectifyTimeModal: React.FC<RectifyTimeModalProps> = ({
  event,
  existingTimesheet,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const [startTime, setStartTime] = useState(existingTimesheet?.start_time || '');
  const [endTime, setEndTime] = useState(existingTimesheet?.end_time || '');
  const [breakMinutes, setBreakMinutes] = useState(existingTimesheet?.break_time || 0);
  const [employeeNotes, setEmployeeNotes] = useState(existingTimesheet?.notedipendente || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateHours = (start: string, end: string, breakMins: number): number => {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes;
    const netMinutes = Math.max(0, diffMinutes - breakMins);
    return netMinutes / 60;
  };

  const totalHours = calculateHours(startTime, endTime, breakMinutes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!startTime || !endTime) {
      setError('Inserisci sia orario di check-in che di check-out');
      return;
    }

    if (totalHours <= 0) {
      setError('L\'orario di check-out deve essere successivo al check-in');
      return;
    }

    if (!notes || notes.trim().length === 0) {
      setError('La motivazione della rettifica è obbligatoria');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (existingTimesheet) {
        // UPDATE: Salva gli originali e i rettificati
        const updateData = {
          original_start_time: existingTimesheet.start_time,
          original_end_time: existingTimesheet.end_time,
          rectified_start_time: startTime,
          rectified_end_time: endTime,
          start_time: startTime,
          end_time: endTime,
          total_hours: totalHours,
          break_time: breakMinutes,
          notedipendente: employeeNotes.trim() || null,
          is_rectified: true,
          rectified_by: user?.id,
          rectified_at: new Date().toISOString(),
          rectification_notes: notes.trim()
        };

        const { error: updateError } = await supabase
          .from('timesheet_entries')
          .update(updateData)
          .eq('id', existingTimesheet.id);

        if (updateError) throw updateError;
      } else {
        // INSERT: Nuovo timesheet rettificato (senza check-in/out precedente)
        const insertData = {
          crew_id: user?.id,
          event_id: event.evento_id,
          date: event.giorno_inizio_evento,
          start_time: startTime,
          end_time: endTime,
          rectified_start_time: startTime,
          rectified_end_time: endTime,
          total_hours: totalHours,
          break_time: breakMinutes,
          notedipendente: employeeNotes.trim() || null,
          status: 'submitted',
          tracking_type: 'hours',
          is_rectified: true,
          rectified_by: user?.id,
          rectified_at: new Date().toISOString(),
          rectification_notes: notes.trim(),
          retention_percentage: 0,
          gross_amount: 0,
          net_amount: 0
        };

        const { error: insertError } = await supabase
          .from('timesheet_entries')
          .insert([insertData]);

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Errore salvataggio rettifica:', err);
      setError(err.message || 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700 flex flex-col max-h-[90vh]">
        {/* Header Fisso */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800 rounded-t-xl flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-white">Rettifica Orario</h3>
            <p className="text-xs text-gray-400">{event.nome_evento}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Contenuto Scrollabile */}
          <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <div className="bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-2 flex items-start space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-orange-200">
              Questa operazione registra un orario rettificato manualmente.
            </div>
          </div>

          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Check-in
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Check-out
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {startTime && endTime && (
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-2">
              <div className="text-xs text-blue-200">
                <span className="font-medium">Lorde:</span> {calculateHours(startTime, endTime, 0).toFixed(2)}h
                {breakMinutes > 0 && (
                  <>
                    <span className="mx-1">•</span>
                    <span className="font-medium">Pausa:</span> {breakMinutes}min
                    <span className="mx-1">•</span>
                    <span className="font-medium">Nette:</span> {totalHours.toFixed(2)}h
                  </>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Pausa (minuti)
            </label>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setBreakMinutes(Math.max(0, breakMinutes - 15))}
                className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
              >
                -15
              </button>
              <div className="flex-1 text-center bg-gradient-to-r from-blue-600 to-blue-700 rounded py-1 px-2">
                <span className="text-xl font-bold text-white">{breakMinutes}</span>
                <span className="text-xs text-blue-100 ml-1">min</span>
              </div>
              <button
                type="button"
                onClick={() => setBreakMinutes(breakMinutes + 15)}
                className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
              >
                +15
              </button>
            </div>
            <div className="flex space-x-1 mt-1">
              <button type="button" onClick={() => setBreakMinutes(30)} className="flex-1 px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600">30</button>
              <button type="button" onClick={() => setBreakMinutes(60)} className="flex-1 px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600">60</button>
              <button type="button" onClick={() => setBreakMinutes(0)} className="flex-1 px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-600">0</button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Nota Dipendente
            </label>
            <textarea
              value={employeeNotes}
              onChange={(e) => setEmployeeNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Note personali..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Motivazione Rettifica <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Motivo della rettifica..."
              required
            />
          </div>
          </div>

          {/* Footer Fisso con Pulsanti */}
          <div className="flex space-x-2 p-3 border-t border-gray-700 bg-gray-800 rounded-b-xl flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !startTime || !endTime || !notes.trim()}
              className="flex-1 py-2 px-3 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvataggio...' : existingTimesheet ? 'Aggiorna' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RectifyTimeModal;
