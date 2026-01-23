import React, { useState, useEffect } from 'react';
import { Clock, Edit, Save, X, AlertCircle, Coffee, CheckCircle } from 'lucide-react';
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
  
  // Overtime request modal state
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [overtimeMinutes, setOvertimeMinutes] = useState(0);
  const [overtimeNote, setOvertimeNote] = useState('');
  const [submittingOvertime, setSubmittingOvertime] = useState(false);
  const [maxOvertimeMinutes, setMaxOvertimeMinutes] = useState(0);
  const [existingOvertimeRequest, setExistingOvertimeRequest] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Local copy of the enriched row (loaded from warehouse_checkins_enriched)
  const [shiftRow, setShiftRow] = useState<any>(null);
  
  // Note del turno (modificabili)
  const [shiftNotes, setShiftNotes] = useState('');

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

  // Converte ore decimali in formato HH:MM
  const formatHoursAsTime = (decimalHours: number): string => {
    const totalMinutes = Math.round(decimalHours * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Utility: arrotonda i minuti per difetto a multipli di 30
  const calculateRequestableMinutes = (minutes: number): number => {
    return Math.floor(minutes / 30) * 30;
  };

  // Utility: formatta minuti in stringa "Xh Ymin"
  const formatMinutesToHoursMinutes = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0 && minutes === 0) return '0min';
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}min`;
  };

  // Determine if this is an extra shift
  const isExtraShift = tableName
    ? tableName === 'extra_shifts_checkins'
    : (!shift.turno_id || shift.turno_id === '' || shift.nome_turno === 'TURNO EXTRA');

  // Carica SEMPRE i dati del turno e richiesta straordinari (anche quando non è in editing)
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
            setShiftNotes(shiftData.notes || '');
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
            const breakStartTime = shiftData.rectified_pausa_pranzo_inizio || shiftData.pausa_pranzo_inizio || shiftData.break_start_time || shiftData.break_start;
            const breakEndTime = shiftData.rectified_pausa_pranzo_fine || shiftData.pausa_pranzo_fine || shiftData.break_end_time || shiftData.break_end;
            const breakCenaStartTime = shiftData.rectified_pausa_cena_inizio || shiftData.pausa_cena_inizio;
            const breakCenaEndTime = shiftData.rectified_pausa_cena_fine || shiftData.pausa_cena_fine;

            setEditedCheckIn(toItalianTime(checkInTime));
            setEditedCheckOut(toItalianTime(checkOutTime));
            setBreakStart(breakStartTime || '');
            setBreakEnd(breakEndTime || '');
            setBreakCenaStart(breakCenaStartTime || '');
            setBreakCenaEnd(breakCenaEndTime || '');
            setRectificationNote(shiftData.rectification_note || '');
            setShiftNotes(shiftData.notes || '');
          }
        }
        
        // Carica company_id dal profilo utente
        if (user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile?.company_id) {
            setCompanyId(profile.company_id);
          }
        }
        
        // Verifica se esiste già una richiesta straordinari per questo turno
        const { data: existingRequest } = await supabase
          .from('richieste_straordinari_v2')
          .select('*')
          .eq('warehouse_checkin_id', shift.id)
          .maybeSingle();
        
        if (existingRequest) {
          setExistingOvertimeRequest(existingRequest);
          // Precompila i campi del modal con i dati esistenti
          const hours = Math.floor(existingRequest.overtime_minutes / 60);
          const minutes = existingRequest.overtime_minutes % 60;
          setOvertimeHours(hours);
          setOvertimeMinutes(minutes);
          setOvertimeNote(existingRequest.note || '');
        }
      } catch (err) {
        console.error('Errore caricamento dati turno:', err);
      }
    };

    // CARICA SEMPRE, non solo quando isEditing=true
    if (shift.id) {
      loadShiftData();
    }
  }, [shift.id, isExtraShift, user?.id]);

  // Verifica autorizzazione straordinari dal benefit specifico
  useEffect(() => {
    const checkOvertimeAuthorization = async () => {
      if (!user?.id) {
        setHasOvertimeInContract(false);
        return;
      }

      try {
        // ID fisso del benefit straordinario
        const STRAORDINARIO_BENEFIT_ID = '539577f9-d1cb-438d-bf2f-61ef4db2317e';

        const { data: benefit, error } = await supabase
          .from('crew_benfit_straordinari')
          .select('straordinari_abilitati, importo_benefit, attivo')
          .eq('crew_id', user.id)
          .eq('benefit_id', STRAORDINARIO_BENEFIT_ID)
          .maybeSingle();

        if (error) {
          console.error('Errore verifica autorizzazione straordinari:', error);
          setHasOvertimeInContract(false);
          return;
        }

        // Autorizzato se trovato record con straordinari_abilitati = true
        // (il campo 'attivo' non viene considerato perché straordinari_abilitati è il flag specifico)
        if (benefit && benefit.straordinari_abilitati === true) {
          console.log('✅ Dipendente autorizzato agli straordinari - Tariffa oraria: €' + benefit.importo_benefit);
          setHasOvertimeInContract(true);
        } else {
          console.log('❌ Dipendente NON autorizzato agli straordinari');
          setHasOvertimeInContract(false);
        }
      } catch (err) {
        console.error('Errore verifica autorizzazione straordinari:', err);
        setHasOvertimeInContract(false);
      }
    };

    checkOvertimeAuthorization();
  }, [user?.id]);

  // Controlla se le ore superano il turno previsto
  useEffect(() => {
    if (editedCheckIn && editedCheckOut) {
      const newHours = calculateHours(editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd);
      const expectedHours = shift.ore_previste || 8;

      if (newHours > expectedHours) {
        setShowOvertimeWarning(true);
        // Calcola i minuti straordinari arrotondati per difetto a multipli di 30
        const overtimeHoursRaw = newHours - expectedHours;
        const overtimeMinutesRaw = Math.round(overtimeHoursRaw * 60);
        const requestableMinutes = calculateRequestableMinutes(overtimeMinutesRaw);
        setMaxOvertimeMinutes(requestableMinutes);
        
        // Imposta valori iniziali per il form straordinari
        const hours = Math.floor(requestableMinutes / 60);
        const minutes = requestableMinutes % 60;
        setOvertimeHours(hours);
        setOvertimeMinutes(minutes);
      } else {
        setShowOvertimeWarning(false);
        setRequestOvertime(false);
        setMaxOvertimeMinutes(0);
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

      // La rettifica è stata salvata con successo
      showSuccess('Rettifica salvata con successo!');
      setIsEditing(false);
      onUpdate();
      setIsSaving(false);
    } catch (err: any) {
      console.error('❌ Errore aggiornamento turno:', err);
      const errorMessage = err.message || 'Errore nel salvataggio delle modifiche';
      setError(errorMessage);
      showError(errorMessage);
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

  const handleOvertimeSubmit = async () => {
    if (!user?.id) {
      showError('Utente non autenticato');
      return;
    }

    const totalMinutesRequested = (overtimeHours * 60) + overtimeMinutes;

    // Validazioni
    if (totalMinutesRequested <= 0) {
      showError('Inserisci almeno 30 minuti di straordinario');
      return;
    }

    if (totalMinutesRequested % 30 !== 0) {
      showError('Le ore straordinarie devono essere richieste con tagli di 30 minuti');
      return;
    }

    if (totalMinutesRequested > maxOvertimeMinutes) {
      showError(`Puoi richiedere al massimo ${formatMinutesToHoursMinutes(maxOvertimeMinutes)}`);
      return;
    }

    if (!overtimeNote || overtimeNote.trim().length < 10) {
      showError('Le note sono obbligatorie (minimo 10 caratteri)');
      return;
    }

    setSubmittingOvertime(true);

    try {
      // Prima salva la rettifica (sempre, perché potrebbe includere modifiche alle note)
      const rectificationDate = new Date().toISOString();
      const newHours = calculateHours(editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd);

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
        notes: shiftNotes.trim() || null,
        rectified_by: user?.id,
        rectified_at: rectificationDate,
        overtime_requested: true,
        total_hours: newHours,
        status: 'completed'
      };

      if (!shift.check_out_turno || shift.status !== 'completed') {
        updateData.check_out_time = editedCheckOut;
      }

      const tableName = isExtraShift ? 'extra_shifts_checkins' : 'warehouse_checkins';

      const { error: updateError } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', shift.id);

      if (updateError) throw updateError;

      // RECUPERA TARIFFA STRAORDINARIO DAL BENEFIT
      let hourlyRate = 0;

      try {
        // ID fisso del benefit straordinario
        const STRAORDINARIO_BENEFIT_ID = '539577f9-d1cb-438d-bf2f-61ef4db2317e';

        const { data: benefit, error: benefitError } = await supabase
          .from('crew_benfit_straordinari')
          .select('importo_benefit, straordinari_abilitati, attivo')
          .eq('crew_id', user?.id)
          .eq('benefit_id', STRAORDINARIO_BENEFIT_ID)
          .maybeSingle();

        if (benefitError) {
          console.error('Errore recupero benefit straordinario:', benefitError);
          showError('Errore nel recupero della tariffa straordinario.');
          setSubmittingOvertime(false);
          return;
        }

        if (!benefit) {
          showError('Non sei autorizzato a richiedere straordinari. Benefit straordinario non configurato.');
          setSubmittingOvertime(false);
          return;
        }

        if (!benefit.straordinari_abilitati) {
          showError('Non sei autorizzato a richiedere straordinari. Benefit straordinario disabilitato.');
          setSubmittingOvertime(false);
          return;
        }

        hourlyRate = Number(benefit.importo_benefit);
        if (hourlyRate <= 0) {
          showError('Tariffa straordinario non valida. Contatta l\'amministrazione.');
          setSubmittingOvertime(false);
          return;
        }

        console.log(`✅ Tariffa straordinario: €${hourlyRate}/h`);
      } catch (err) {
        console.error('Errore recupero tariffa straordinario:', err);
        showError('Errore nel recupero della tariffa straordinario.');
        setSubmittingOvertime(false);
        return;
      }

      // Poi crea o aggiorna la richiesta straordinario
      // Nota: total_amount NON viene inserito perché è una colonna GENERATED nel database
      // che calcola automaticamente: round((ore_straordinario * hourly_rate), 2)
      const payload: any = {
        crewid: user.id,
        ore_straordinario: totalMinutesRequested / 60,
        overtime_minutes: totalMinutesRequested,
        note: overtimeNote.trim(),
        status: 'in_attesa',
        hourly_rate: hourlyRate,
        warehouse_checkin_id: shift.id,
        shift_date: shift.giorno_turno || null,
        updated_at: new Date().toISOString()
      };

      // Aggiungi company_id
      if (companyId) {
        payload.company_id = companyId;
      }

      // Add turno_id: use assegnazione_id, shift_id, or turno_id from shift data
      const turnoId = shiftRow?.assegnazione_id || shiftRow?.shift_id || shift.turno_id || (shift as any).shift_id;
      if (turnoId) {
        payload.turno_id = turnoId;
      }

      // Verifica se esiste già una richiesta
      if (existingOvertimeRequest) {
        // UPDATE della richiesta esistente
        console.log('📝 Aggiornamento richiesta straordinario esistente:', existingOvertimeRequest.id, payload);
        
        const { error } = await supabase
          .from('richieste_straordinari_v2')
          .update(payload)
          .eq('id', existingOvertimeRequest.id);

        if (error) {
          console.error('❌ Errore aggiornamento straordinario:', error);
          throw error;
        }
        
        showSuccess('Rettifica e richiesta straordinario aggiornate con successo!');
      } else {
        // INSERT nuova richiesta
        console.log('💾 Creazione nuova richiesta straordinario:', payload);

        const { error } = await supabase.from('richieste_straordinari_v2').insert(payload);

        if (error) {
          console.error('❌ Errore inserimento straordinario:', error);
          throw error;
        }
        
        showSuccess('Rettifica e richiesta straordinario salvate con successo!');
      }

      setShowOvertimeModal(false);
      setIsEditing(false);
      setOvertimeNote('');
      setRequestOvertime(false);
      onUpdate();
    } catch (err: any) {
      console.error('❌ Errore richiesta straordinario:', err);
      showError(err?.message || 'Errore nell\'invio della richiesta straordinario');
    } finally {
      setSubmittingOvertime(false);
    }
  };

  const handleOvertimeCancel = () => {
    setShowOvertimeModal(false);
    setOvertimeNote('');
    setRequestOvertime(false);
    // Non chiudiamo l'editing mode, permettiamo all'utente di modificare ancora
  };

  if (!isEditing) {
    return (
      <div className="mt-2 space-y-2">
        {existingOvertimeRequest && (
          <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-yellow-400 mb-1">
                  Straordinari Richiesti
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <div>
                    <span className="font-semibold">Ore richieste:</span> {formatMinutesToHoursMinutes(existingOvertimeRequest.overtime_minutes)}
                  </div>
                  <div>
                    <span className="font-semibold">Stato:</span>{' '}
                    <span className={`font-semibold ${
                      existingOvertimeRequest.status === 'in_attesa' ? 'text-yellow-300' :
                      existingOvertimeRequest.status === 'approved' ? 'text-green-300' :
                      'text-red-300'
                    }`}>
                      {existingOvertimeRequest.status === 'in_attesa' ? 'In Attesa' :
                       existingOvertimeRequest.status === 'approved' ? 'Approvata' :
                       'Rifiutata'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold">Importo:</span> €{existingOvertimeRequest.total_amount}
                  </div>
                  {existingOvertimeRequest.note && (
                    <div className="mt-2 pt-2 border-t border-yellow-700/30">
                      <div className="font-semibold mb-1">Note:</div>
                      <div className="text-gray-400 italic">"{existingOvertimeRequest.note}"</div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-yellow-500 mt-2">
                  ℹ️ Clicca su "Rettifica Orari Turno" per modificare la richiesta
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
        >
          <Edit className="h-4 w-4" />
          <span>Rettifica Orari Turno</span>
        </button>
      </div>
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
    <>
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

        <div className="border-t border-gray-600 pt-3 mt-3">
          <label className="block text-xs font-medium text-gray-300 mb-2">
            📝 Note del Turno (opzionale)
          </label>
          <textarea
            value={shiftNotes}
            onChange={(e) => setShiftNotes(e.target.value)}
            placeholder="Note o commenti sul turno lasciate durante il check-in..."
            rows={4}
            className="w-full bg-gray-700 border-2 border-cyan-700 rounded px-3 py-2 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
          />
          <div className="text-xs text-cyan-300 mt-1">
            ℹ️ Queste sono le note che hai inserito durante il turno. Puoi modificarle qui.
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
                  {formatHoursAsTime(calculateHours(editedCheckIn, editedCheckOut, breakStart, breakEnd, breakCenaStart, breakCenaEnd))}
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
            onClick={() => {
              if (!existingOvertimeRequest && maxOvertimeMinutes > 0) {
                // Solo se NON esiste già una richiesta, apri il modal
                setRequestOvertime(true);
                setShowOvertimeModal(true);
              }
            }}
            disabled={!hasOvertimeInContract || existingOvertimeRequest !== null}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              !hasOvertimeInContract
                ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                : existingOvertimeRequest
                  ? 'bg-green-600 text-white cursor-not-allowed'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
            }`}
          >
            {!hasOvertimeInContract ? (
              <span>Straordinari Non Previsti nel Contratto</span>
            ) : existingOvertimeRequest ? (
              <span className="flex items-center justify-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>RICHIESTA INVIATA</span>
              </span>
            ) : (
              <span>Richiedi Straordinari</span>
            )}
          </button>
          {!hasOvertimeInContract ? (
            <p className="text-xs text-gray-500 mt-1 text-center">
              Il tuo contratto non prevede il pagamento degli straordinari
            </p>
          ) : existingOvertimeRequest ? (
            <p className="text-xs text-green-400 mt-1 text-center">
              {formatMinutesToHoursMinutes(existingOvertimeRequest.overtime_minutes)} • {existingOvertimeRequest.status === 'in_attesa' ? 'In attesa di approvazione' : existingOvertimeRequest.status === 'approved' ? 'Approvata' : 'Rifiutata'}
            </p>
          ) : null}
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

    {/* Modal per richiesta straordinari */}
    {showOvertimeModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-lg bg-gray-900 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              {existingOvertimeRequest ? 'Modifica Richiesta Straordinario' : 'Richiesta Straordinario'}
            </h3>
            <button 
              onClick={handleOvertimeCancel} 
              className="text-gray-400 hover:text-white"
              disabled={submittingOvertime}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3">
              <div className="text-sm text-yellow-400 font-semibold">
                Massimo richiedibile: {formatMinutesToHoursMinutes(maxOvertimeMinutes)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Calcolato in base alle ore lavorate e al turno previsto ({shift.ore_previste || 8}h)
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-2 block font-medium">
                Ore e minuti da richiedere (tagli di 30 minuti) <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Ore</label>
                  <input
                    type="number"
                    min="0"
                    max={Math.floor(maxOvertimeMinutes / 60)}
                    value={overtimeHours}
                    onChange={(e) => setOvertimeHours(parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center text-lg text-white"
                    disabled={submittingOvertime}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Minuti</label>
                  <select
                    value={overtimeMinutes}
                    onChange={(e) => setOvertimeMinutes(parseInt(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center text-lg text-white"
                    disabled={submittingOvertime}
                  >
                    <option value="0">00</option>
                    <option value="30">30</option>
                  </select>
                </div>
              </div>
              <div className="text-xs text-gray-400 mt-2 text-center">
                Totale: {formatMinutesToHoursMinutes((overtimeHours * 60) + overtimeMinutes)}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-300 mb-2 block font-medium">
                Motivazione richiesta <span className="text-red-400">*</span>
              </label>
              <textarea
                value={overtimeNote}
                onChange={(e) => setOvertimeNote(e.target.value)}
                rows={4}
                placeholder="Descrivi il motivo della richiesta straordinario (minimo 10 caratteri)..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                disabled={submittingOvertime}
              />
              <div className="text-xs text-gray-400 mt-1">
                {overtimeNote.length}/10 caratteri minimi
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleOvertimeCancel}
                disabled={submittingOvertime}
                className="flex-1 bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Annulla</span>
              </button>
              <button
                onClick={handleOvertimeSubmit}
                disabled={submittingOvertime}
                className="flex-1 bg-yellow-600 text-black py-3 rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center justify-center space-x-2 font-semibold"
              >
                {submittingOvertime ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black" />
                    <span>Invio...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Invia richiesta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default ShiftActions;