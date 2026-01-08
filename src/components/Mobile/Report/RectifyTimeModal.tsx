import React, { useState } from 'react';
import { X, Clock, AlertTriangle } from 'lucide-react';
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
    end_time: string;
    total_hours: number;
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
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateHours = (start: string, end: string): number => {
    if (!start || !end) return 0;

    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    const diffMinutes = endMinutes - startMinutes;
    return Math.max(0, diffMinutes / 60);
  };

  const totalHours = calculateHours(startTime, endTime);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-white">Rettifica Orario</h3>
            <p className="text-sm text-gray-400">{event.nome_evento}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-3 flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-200">
              Questa operazione registra un orario rettificato manualmente.
              Verrà segnalato come rettifica nel sistema.
            </div>
          </div>

          {error && (
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Orario Check-in
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Orario Check-out
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {startTime && endTime && (
            <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3">
              <div className="text-sm text-blue-200">
                <span className="font-medium">Ore totali:</span> {totalHours.toFixed(2)}h
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Motivazione Rettifica <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Spiega il motivo della rettifica (es: dimenticato check-in, errore nell'orario, ecc...)"
              required
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading || !startTime || !endTime || !notes.trim()}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
