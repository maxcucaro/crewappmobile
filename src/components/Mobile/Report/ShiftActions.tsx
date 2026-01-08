import React, { useState, useEffect } from 'react';
import { Clock, Edit, Save, X, AlertCircle, Coffee } from 'lucide-react';
import { supabase } from '../../../lib/db';
import { useAuth } from '../../../context/AuthContext';
import { useToastContext } from '../../../context/ToastContext';
import { toItalianTime } from '../../../utils/dateUtils';

interface CompletedShift {
  id: string;
  turno_id: string;
  giorno_turno: string;
  nome_turno: string;
  check_in_turno: string;
  check_out_turno: string;
  conteggio_ore: number;
  buoni_pasto_assegnato: boolean;
  pasto_aziendale_usufruito: boolean;
  ore_straordinario?: number;
  ore_previste?: number;
  pausa_pranzo?: boolean;
  status?: string;
  is_rectified?: boolean;
  rectification_note?: string | null;
  original_check_in?: string;
  original_check_out?: string;
  original_pausa_pranzo?: boolean;
  rectified_check_in?: string;
  rectified_check_out?: string;
  rectified_pausa_pranzo?: boolean;
  auto_checkout?: boolean;
  [key: string]: any;
}

interface ShiftActionsProps {
  shift: CompletedShift;
  onUpdate: () => void;
  tableName?: 'warehouse_checkins' | 'extra_shifts_checkins';
}

const ShiftActions: React.FC<ShiftActionsProps> = ({ shift, onUpdate, tableName }) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editedCheckIn, setEditedCheckIn] = useState('');
  const [editedCheckOut, setEditedCheckOut] = useState('');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [breakCenaStart, setBreakCenaStart] = useState('');
  const [breakCenaEnd, setBreakCenaEnd] = useState('');
  const [rectificationNote, setRectificationNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOvertimeWarning, setShowOvertimeWarning] = useState(false);
  const [requestOvertime, setRequestOvertime] = useState(false);
  const [hasOvertimeInContract, setHasOvertimeInContract] = useState(true);

  // Local copy of the enriched row (loaded from warehouse_checkins_enriched)
  const [shiftRow, setShiftRow] = useState<any>(null);

  const calculateHours = (checkIn: string, checkOut: string, pausaInizio?: string, pausaFine?: string, pausaCenaInizio?: string, pausaCenaFine?: string): number => {
    if (!checkIn || !checkOut) return 0;

    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const inMinutes = inH * 60 + inM;
    const outMinutes = outH * 60 + outM;
    let hours = (outMinutes - inMinutes) / 60;

    // Sottrai la durata della pausa pranzo se specificata
    if (pausaInizio && pausaFine) {
      const [pausaInH, pausaInM] = pausaInizio.split(':').map(Number);
      const [pausaFinH, pausaFinM] = pausaFine.split(':').map(Number);
      const pausaInMinutes = pausaInH * 60 + pausaInM;
      const pausaFinMinutes = pausaFinH * 60 + pausaFinM;
      const pausaDuration = (pausaFinMinutes - pausaInMinutes) / 60;

      if (pausaDuration > 0) {
        hours -= pausaDuration;
      }
    }

    // Sottrai la durata della pausa cena se specificata
    if (pausaCenaInizio && pausaCenaFine) {
      const [pausaCenaInH, pausaCenaInM] = pausaCenaInizio.split(':').map(Number);
      const [pausaCenaFinH, pausaCenaFinM] = pausaCenaFine.split(':').map(Number);
      const pausaCenaInMinutes = pausaCenaInH * 60 + pausaCenaInM;
      const pausaCenaFinMinutes = pausaCenaFinH * 60 + pausaCenaFinM;
      const pausaCenaDuration = (pausaCenaFinMinutes - pausaCenaInMinutes) / 60;

      if (pausaCenaDuration > 0) {
        hours -= pausaCenaDuration;
      }
    }

    return hours;
  };

  // Determine if this is an extra shift
  const isExtraShift = tableName
    ? tableName === 'extra_shifts_checkins'
    : (!shift.turno_id || shift.turno_id === '' || shift.nome_turno === 'TURNO EXTRA');

  // Carica i dati del turno (inclusi quelli rettificati se esistono)
  useEffect(() => {
    const loadShiftData = async () => {
      try {
        // Load from the correct table based on shift type
        if (isExtraShift) {
          // Extra shift - load from extra_shifts_checkins
          const { data: shiftData, error } = await supabase
            .from('extra_shifts_checkins')
            .select('*')
            .eq('id', shift.id)
            .maybeSingle();

          if (error) throw error;

          if (shiftData) {
            setShiftRow(shiftData);
            const checkInTime = shiftData.rectified_check_in_time || shiftData.check_in_time;
            const checkOutTime = shiftData.rectified_check_out_time || shiftData.check_out_time;
            const breakStartTime = shiftData.rectified_break_start || shiftData.break_start_time;
            const breakEndTime = shiftData.rectified_break_end || shiftData.break_end_time;
            const breakCenaStartTime = shiftData.rectified_pausa_cena_inizio || shiftData.pausa_cena_inizio;
            const breakCenaEndTime = shiftData.rectified_pausa_cena_fine || shiftData.pausa_cena_fine;

            setEditedCheckIn(toItalianTime(checkInTime));
            setEditedCheckOut(toItalianTime(checkOutTime));
            setBreakStart(breakStartTime || '');
            setBreakEnd(breakEndTime || '');
            setBreakCenaStart(breakCenaStartTime || '');
            setBreakCenaEnd(breakCenaEndTime || '');
            setRectificationNote(shiftData.rectification_note || '');
          }
        } else {
          // Warehouse shift - use the enriched view
          const { data: shiftData, error } = await supabase
            .from('warehouse_checkins_enriched')
            .select('*')
            .eq('id', shift.id)
            .maybeSingle();

          if (error) throw error;

          if (shiftData) {
            setShiftRow(shiftData);
            const checkInTime = shiftData.rectified_check_in_time || shiftData.check_in_time;
            const checkOutTime = shiftData.rectified_check_out_time || shiftData.check_out_time;
            const breakStartTime = shiftData.rectified_break_start || shiftData.break_start_time || shiftData.break_start;
            const breakEndTime = shiftData.rectified_break_end || shiftData.break_end_time || shiftData.break_end;
            const breakCenaStartTime = shiftData.rectified_pausa_cena_inizio || shiftData.pausa_cena_inizio;
            const breakCenaEndTime = shiftData.rectified_pausa_cena_fine || shiftData.pausa_cena_fine;

            setEditedCheckIn(toItalianTime(checkInTime));
            setEditedCheckOut(toItalianTime(checkOutTime));
            setBreakStart(breakStartTime || '');
            setBreakEnd(breakEndTime || '');
            setBreakCenaStart(breakCenaStartTime || '');
            setBreakCenaEnd(breakCenaEndTime || '');
            setRectificationNote(shiftData.rectification_note || '');
          }
        }
      } catch (err) {
        console.error('Errore caricamento dati turno:', err);
      }
    };

    if (isEditing && shift.id) {
      loadShiftData();
    }
  }, [isEditing, shift.id, isExtraShift]);

  // Per ora gli straordinari sono sempre abilitati
  // TODO: Implementare la verifica del contratto quando sarà disponibile la colonna overtime_eligible
  useEffect(() => {
    setHasOvertimeInContract(true);
  }, []);

  // Controlla se le ore superano il turno previsto
  useEffect(() => {
    if (editedCheckIn && editedCheckOut) {
      const newHours = calculateHours(editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd);
      const expectedHours = shift.ore_previste || 8;

      if (newHours > expectedHours) {
        setShowOvertimeWarning(true);
      } else {
        setShowOvertimeWarning(false);
        setRequestOvertime(false);
      }
    }
  }, [editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd, shift.ore_previste]);

  const handleSave = async () => {
    console.log('🔍 Inizio salvataggio rettifica...');
    console.log('📝 Dati da salvare:', {
      editedCheckIn,
      editedCheckOut,
      breakStart,
      breakEnd,
      breakCenaStart,
      breakCenaEnd,
      rectificationNote,
      requestOvertime,
      shiftId: shift.id
    });

    // Validazioni
    if (!editedCheckIn || !editedCheckOut) {
      setError('Inserisci orari validi');
      return;
    }

    if (!rectificationNote || rectificationNote.trim().length < 10) {
      setError('La nota di rettifica è obbligatoria (minimo 10 caratteri)');
      return;
    }

    // Valida pausa pranzo se specificata
    if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
      setError('Specifica sia l\'inizio che la fine della pausa pranzo');
      return;
    }

    if (breakStart && breakEnd) {
      const [pausaInH, pausaInM] = breakStart.split(':').map(Number);
      const [pausaFinH, pausaFinM] = breakEnd.split(':').map(Number);
      if ((pausaFinH * 60 + pausaFinM) <= (pausaInH * 60 + pausaInM)) {
        setError('La fine della pausa pranzo deve essere dopo l\'inizio');
        return;
      }
    }

    // Valida pausa cena se specificata
    if ((breakCenaStart && !breakCenaEnd) || (!breakCenaStart && breakCenaEnd)) {
      setError('Specifica sia l\'inizio che la fine della pausa cena');
      return;
    }

    if (breakCenaStart && breakCenaEnd) {
      const [pausaCenaInH, pausaCenaInM] = breakCenaStart.split(':').map(Number);
      const [pausaCenaFinH, pausaCenaFinM] = breakCenaEnd.split(':').map(Number);
      if ((pausaCenaFinH * 60 + pausaCenaFinM) <= (pausaCenaInH * 60 + pausaCenaInM)) {
        setError('La fine della pausa cena deve essere dopo l\'inizio');
        return;
      }
    }

    const newHours = calculateHours(editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd);
    if (newHours <= 0) {
      setError('Le pause non possono coprire tutto il tempo di lavoro. Le ore effettive devono essere maggiori di zero.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const rectificationDate = new Date().toISOString();

      const updateData: any = {
        rectified_check_in_time: editedCheckIn,
        rectified_check_out_time: editedCheckOut,
        rectified_break_start: breakStart ? breakStart : null,
        rectified_break_end: breakEnd ? breakEnd : null,
        rectified_pausa_pranzo: (breakStart && breakEnd) ? true : false,
        rectified_pausa_pranzo_inizio: breakStart ? breakStart : null,
        rectified_pausa_pranzo_fine: breakEnd ? breakEnd : null,
        rectified_pausa_cena_inizio: breakCenaStart ? breakCenaStart : null,
        rectified_pausa_cena_fine: breakCenaEnd ? breakCenaEnd : null,
        rectified_total_hours: newHours,
        rectification_note: rectificationNote.trim(),
        rectified_by: user?.id,
        rectified_at: rectificationDate,
        overtime_requested: requestOvertime,
        total_hours: newHours,
        status: 'completed'
      };

      // Se il turno non aveva un checkout (era ancora aperto), aggiorna anche check_out_time compatto (HH:MM)
      if (!shift.check_out_turno || shift.status !== 'completed') {
        updateData.check_out_time = editedCheckOut; // formato HH:MM
      }

      // Update the correct table based on shift type
      const tableName = isExtraShift ? 'extra_shifts_checkins' : 'warehouse_checkins';

      console.log('💾 Invio update a Supabase:', { tableName, shiftId: shift.id, updateData });

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', shift.id);

      console.log('✅ Risposta Supabase:', { error: updateError });

      if (updateError) {
        console.error('❌ Errore Supabase:', updateError);
        throw updateError;
      }

      showSuccess('Rettifica salvata con successo!');
      setIsEditing(false);
      onUpdate();
    } catch (err: any) {
      console.error('❌ Errore aggiornamento turno:', err);
      const errorMessage = err.message || 'Errore nel salvataggio delle modifiche';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCheckIn(shift.check_in_turno?.substring(0, 5) || '');
    setEditedCheckOut(shift.check_out_turno?.substring(0, 5) || '');
    setBreakStart('');
    setBreakEnd('');
    setBreakCenaStart('');
    setBreakCenaEnd('');
    setRectificationNote('');
    setRequestOvertime(false);
    setShowOvertimeWarning(false);
    setError(null);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full mt-2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
      >
        <Edit className="h-4 w-4" />
        <span>Rettifica Orari Turno</span>
      </button>
    );
  }

  // Determine display type using loaded enriched row (shiftRow). If shiftRow not loaded yet fall back to shift prop.
  const determineShiftTypeLabel = () => {
    const notesVal = (shiftRow && shiftRow.notes) || (shift as any).notes || '';
    const warehouseName = (shiftRow && shiftRow.warehouse_name) || (shift as any).warehouse_name || (shift as any).nome_turno || '';
    const noteturno = (shiftRow && shiftRow.noteturno) || (shift as any).noteturno || '';

    if (typeof notesVal === 'string' && notesVal.toLowerCase().includes('turno extra')) {
      return { label: 'TURNO EXTRA', isExtra: true, subtitle: '' };
    }

    // Not "turno extra" -> assume magazzino shift, show warehouse name and/or noteturno
    const subtitleParts: string[] = [];
    if (warehouseName) subtitleParts.push(warehouseName);
    if (noteturno) subtitleParts.push(noteturno);
    const subtitle = subtitleParts.join(' • ');
    return { label: 'TURNO MAGAZZINO', isExtra: false, subtitle };
  };

  const shiftTypeInfo = determineShiftTypeLabel();

  return (
    <div className="mt-3 bg-gray-800 border border-gray-600 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-white mb-3 flex items-center space-x-2">
        <Edit className="h-4 w-4" />
        <span>Rettifica Orari</span>
      </h4>

      {/* New: display shift type and warehouse/name info */}
      <div className="mb-3">
        {shiftTypeInfo.isExtra ? (
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-700 text-white text-xs font-semibold">
            TURNO EXTRA
          </div>
        ) : (
          <div className="inline-flex flex-col px-3 py-2 rounded-lg bg-gray-700 text-white text-sm">
            <span className="font-semibold">Turno di Magazzino</span>
            {shiftTypeInfo.subtitle ? (
              <span className="text-xs text-gray-300 mt-1">{shiftTypeInfo.subtitle}</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Turno Aperto - Avviso */}
      {(!shift.original_check_out || shift.status !== 'completed') && (
        <div className="mb-4 bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-orange-200 mb-1">Turno Ancora Aperto</div>
              <div className="text-xs text-orange-300">
                Il checkout non è stato effettuato. Compilando questa rettifica il turno verrà automaticamente chiuso.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dati Originali */}
      {shift.original_check_in && (
        <div className="mb-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-3">
          <div className="text-xs font-semibold text-blue-200 mb-2">Dati Originali Registrati:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-blue-300">Check-in:</span>
              <div className="text-white font-semibold">{toItalianTime(shift.original_check_in)}</div>
            </div>
            <div>
              <span className="text-blue-300">Check-out:</span>
              <div className="text-white font-semibold">
                {shift.original_check_out ? (
                  <>
                    {toItalianTime(shift.original_check_out)}
                    {shift.auto_checkout && (
                      <span className="ml-1 text-xs bg-purple-800 text-purple-200 px-1 py-0.5 rounded">AUTO</span>
                    )}
                  </>
                ) : (
                  <span className="text-orange-400 italic">Non effettuato</span>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-blue-300">Pausa Pranzo:</span>
              <span className="ml-2 text-white font-semibold">
                {shift.original_pausa_pranzo ? 'Sì ✓' : 'No ✗'}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 bg-red-900 border border-red-700 rounded-lg p-2 flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-red-200">{error}</span>
        </div>
      )}

      <div className="space-y-3 mb-3">
        <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-3 mb-3">
          <div className="text-xs font-semibold text-green-200 mb-3">Nuovi Orari Rettificati:</div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Orario Entrata <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={editedCheckIn}
                onChange={(e) => setEditedCheckIn(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Orario Uscita <span className="text-red-400">*</span>
              </label>
              <input
                type="time"
                value={editedCheckOut}
                onChange={(e) => setEditedCheckOut(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-600 pt-3 mt-3">
          <label className="block text-xs font-medium text-gray-300 mb-2 flex items-center space-x-2">
            <Coffee className="h-4 w-4 text-cyan-400" />
            <span>Pausa Pranzo (opzionale):</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Inizio Pausa
              </label>
              <input
                type="time"
                value={breakStart}
                onChange={(e) => setBreakStart(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Fine Pausa
              </label>
              <input
                type="time"
                value={breakEnd}
                onChange={(e) => setBreakEnd(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            ℹ️ Lascia vuoto se non hai effettuato pausa pranzo
          </div>
        </div>

        <div className="border-t border-gray-600 pt-3 mt-3">
          <label className="block text-xs font-medium text-gray-300 mb-2 flex items-center space-x-2">
            <Coffee className="h-4 w-4 text-purple-400" />
            <span>Pausa Cena (opzionale):</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Inizio Pausa
              </label>
              <input
                type="time"
                value={breakCenaStart}
                onChange={(e) => setBreakCenaStart(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Fine Pausa
              </label>
              <input
                type="time"
                value={breakCenaEnd}
                onChange={(e) => setBreakCenaEnd(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            ℹ️ Lascia vuoto se non hai effettuato pausa cena
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">
            Nota Rettifica <span className="text-red-400">*</span>
          </label>
          <textarea
            value={rectificationNote}
            onChange={(e) => setRectificationNote(e.target.value)}
            placeholder="Specifica il motivo della rettifica (obbligatorio, min 10 caratteri)..."
            rows={3}
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
          />
          <div className="text-xs text-gray-400 mt-1">
            {rectificationNote.length}/10 caratteri minimi
          </div>
        </div>

        {editedCheckIn && editedCheckOut && (
          <div className="space-y-2">
            {showOvertimeWarning && hasOvertimeInContract && (
              <div className="bg-orange-900 border border-orange-700 rounded p-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-orange-200 mb-2">
                      Le ore superano il turno previsto ({shift.ore_previste || 8}h)
                    </div>
                    <label className="flex items-center space-x-2 text-xs text-orange-300">
                      <input
                        type="checkbox"
                        checked={requestOvertime}
                        onChange={(e) => setRequestOvertime(e.target.checked)}
                        className="rounded border-orange-600 bg-orange-800 text-orange-500 focus:ring-orange-500"
                      />
                      <span>Richiedi straordinari per le ore eccedenti</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-900 border border-blue-700 rounded p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-blue-200">Nuove ore totali:</span>
                <span className="font-bold text-blue-100 text-lg">
                  {calculateHours(editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd).toFixed(2)}h
                </span>
              </div>
              {(breakStart && breakEnd) || (breakCenaStart && breakCenaEnd) ? (
                <div className="text-xs text-blue-300 mt-1 space-y-0.5">
                  {breakStart && breakEnd && (
                    <div>Pausa pranzo: {breakStart} - {breakEnd}</div>
                  )}
                  {breakCenaStart && breakCenaEnd && (
                    <div>Pausa cena: {breakCenaStart} - {breakCenaEnd}</div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Pulsante Richiesta Straordinari - sempre visibile */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setRequestOvertime(!requestOvertime)}
            disabled={!hasOvertimeInContract}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              hasOvertimeInContract
                ? requestOvertime
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
            }`}
          >
            {hasOvertimeInContract ? (
              requestOvertime ? (
                <span className="flex items-center justify-center space-x-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Straordinari Richiesti</span>
                </span>
              ) : (
                <span>Richiedi Straordinari</span>
              )
            ) : (
              <span>Straordinari Non Previsti nel Contratto</span>
            )}
          </button>
          {!hasOvertimeInContract && (
            <p className="text-xs text-gray-500 mt-1 text-center">
              Il tuo contratto non prevede il pagamento degli straordinari
            </p>
          )}
        </div>
      </div>

      <div className="flex space-x-2 mt-4">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center space-x-1"
        >
          <X className="h-4 w-4" />
          <span>Annulla</span>
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center space-x-1"
        >
          {isSaving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              <span>Salvataggio...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Salva</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ShiftActions;