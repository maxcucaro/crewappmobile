import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';
import { Clock, RefreshCw } from 'lucide-react';

/**
 * Straordinari - richiesta straordinari con filtri per stato
 * 
 * Caratteristiche:
 * - Mostra turni con ore eccedenti richiedibili
 * - Permette di richiedere straordinari (multipli di 30 min)
 * - Mostra richieste esistenti filtrate per stato
 * - Permette modifica richieste in attesa
 */

type CandidateShift = {
  source: 'warehouse' | 'event';
  assignment_id: string;
  refShiftId?: string | null;
  refEventId?: string | null;
  date?: string | null;
  title: string;
  scheduledHours: number;
  workedHours: number;
  excessHours: number;
  requestableHours: number;
  raw?: any;
};

interface ExistingRequest {
  id: string;
  turno_id: string;
  warehouse_checkin_id?: string;
  shift_date?: string;
  ore_straordinario: number;
  overtime_minutes: number;
  hourly_rate?: number;
  total_amount?: number;
  note?: string;
  status: 'in_attesa' | 'approved' | 'rejected';
  created_at: string;
  title?: string;
  source?: 'event' | 'warehouse';
}

type FilterType = 'all' | 'da_richiedere' | 'in_attesa' | 'approved' | 'rejected';

// Utility: arrotonda i minuti per difetto a multipli di 30
function calculateRequestableMinutes(minutes: number): number {
  return Math.floor(minutes / 30) * 30;
}

// Utility: converte ore in minuti richiedibili
function calculateRequestableHours(hours: number): number {
  const minutes = Math.round(hours * 60);
  const requestableMinutes = calculateRequestableMinutes(minutes);
  return requestableMinutes / 60;
}

// Utility: formatta minuti in stringa "Xh Ymin"
function formatMinutesToHoursMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0 && minutes === 0) return '0min';
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

// Utility: converte ore decimali in minuti totali
function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

// Utility: converte interval PostgreSQL (formato "HH:MM:SS") in minuti
function intervalToMinutes(intervalStr: string | null | undefined): number {
  if (!intervalStr) return 0;
  
  // Formato: "HH:MM:SS" o "HH:MM:SS.microseconds"
  const match = intervalStr.match(/^(\d+):(\d+):(\d+)/);
  if (!match) return 0;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  return hours * 60 + minutes;
}

const Straordinari: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();

  const [loading, setLoading] = useState<boolean>(true);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<CandidateShift[]>([]);
  const [existingRequests, setExistingRequests] = useState<ExistingRequest[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  // modal / form
  const [showFormFor, setShowFormFor] = useState<CandidateShift | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ExistingRequest | null>(null);
  const [requestHours, setRequestHours] = useState<number>(0);
  const [requestMinutes, setRequestMinutes] = useState<number>(0);
  const [requestReason, setRequestReason] = useState<string>('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        await Promise.all([checkAuthorization(), loadCandidates()]);
      } catch (err) {
        console.error('init straordinari error', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function checkAuthorization() {
    try {
      // ID fisso del benefit straordinario
      const STRAORDINARIO_BENEFIT_ID = '539577f9-d1cb-438d-bf2f-61ef4db2317e';

      const { data: benefit, error } = await supabase
        .from('crew_benfit_straordinari')
        .select('straordinari_abilitati, importo_benefit, attivo')
        .eq('crew_id', user?.id)
        .eq('benefit_id', STRAORDINARIO_BENEFIT_ID)
        .maybeSingle();

      if (error) {
        console.error('Errore verifica autorizzazione straordinari:', error);
        setIsAuthorized(false);
        return;
      }

      // Autorizzato se trovato record con straordinari_abilitati = true
      // (il campo 'attivo' non viene considerato perché straordinari_abilitati è il flag specifico)
      if (benefit && benefit.straordinari_abilitati === true) {
        console.log('✅ Dipendente autorizzato agli straordinari - Tariffa oraria: €' + benefit.importo_benefit);
        setIsAuthorized(true);
      } else {
        console.log('❌ Dipendente NON autorizzato agli straordinari');
        setIsAuthorized(false);
      }
    } catch (err) {
      console.error('checkAuthorization error', err);
      setIsAuthorized(false);
    }
  }

  function parseDateTime(dateTimeStr?: string | null): Date | null {
    if (!dateTimeStr) return null;
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function durationHours(start?: string | null, end?: string | null): number | null {
    const s = parseDateTime(start);
    const e = parseDateTime(end);
    if (!s || !e) return null;
    const diffMs = e.getTime() - s.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  async function loadCandidates() {
    if (!user?.id) return [];
    const out: CandidateShift[] = [];

    // Load existing overtime requests WITH FULL DATA
    const enrichedExistingRequests: ExistingRequest[] = [];
    let existingRequestTurnoIds: string[] = [];
    
    try {
      const { data: existingReqs } = await supabase
        .from('richieste_straordinari_v2')
        .select('*')
        .eq('crewid', user.id)
        .order('created_at', { ascending: false });
      
      if (existingReqs && existingReqs.length > 0) {
        for (const req of existingReqs) {
          let title = 'Richiesta';
          let source: 'event' | 'warehouse' = 'warehouse';

          if (req.warehouse_checkin_id) {
            // Usa warehouse_checkins_enriched per avere più informazioni
            const { data: wc } = await supabase
              .from('warehouse_checkins_enriched')
              .select('warehouse_name, noteturno')
              .eq('id', req.warehouse_checkin_id)
              .maybeSingle();
            if (wc) {
              title = wc.warehouse_name || wc.noteturno || 'Turno Magazzino';
            }
          } else if (req.turno_id) {
            // Non possiamo caricare il nome dal turno_id perché la tabella turni non esiste
            title = `Turno ${req.shift_date ? new Date(req.shift_date).toLocaleDateString('it-IT') : 'Evento'}`;
            source = 'event';
          }

          enrichedExistingRequests.push({
            ...req,
            title,
            source
          });

          // Aggiungi sia turno_id che warehouse_checkin_id per escludere duplicati
          if (req.turno_id) {
            existingRequestTurnoIds.push(req.turno_id);
          }
          if (req.warehouse_checkin_id) {
            existingRequestTurnoIds.push(req.warehouse_checkin_id);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load existing overtime requests', e);
    }

    setExistingRequests(enrichedExistingRequests);

    // Load warehouse shifts with overtime
    try {
      const { data: overtimeShifts } = await supabase
        .from('warehouse_checkins')
        .select('*')
        .eq('crew_id', user.id)
        .eq('requisito_straordinari', true)
        .order('date', { ascending: false })
        .limit(50);

      if (overtimeShifts && overtimeShifts.length > 0) {
        overtimeShifts.forEach((wc: any) => {
          if (existingRequestTurnoIds.includes(wc.id)) {
            return; // Skip già richiesti
          }

          // Converti orario_di_lavoro_previsto da interval a minuti
          const scheduled = intervalToMinutes(wc.orario_di_lavoro_previsto);
          const worked = Number(wc.total_minutes) || 0;
          const excess = Math.max(0, worked - scheduled);
          
          console.log(`Shift ${wc.id}: scheduled=${scheduled}min, worked=${worked}min, excess=${excess}min`);

          if (excess < 30) {
            return; // Non richiedibile
          }

          const requestable = calculateRequestableMinutes(excess);
          if (requestable < 30) {
            return;
          }

          out.push({
            source: 'warehouse',
            assignment_id: wc.id,
            refShiftId: wc.id,
            date: wc.date,
            title: `Turno ${wc.date || 'Magazzino'}`,
            scheduledHours: scheduled / 60,
            workedHours: worked / 60,
            excessHours: excess / 60,
            requestableHours: requestable / 60,
            raw: wc
          });
        });
      }
    } catch (e) {
      console.warn('Failed to load warehouse overtime shifts', e);
    }

    setCandidates(out);
  }

  async function handleRequestSubmit(shift?: CandidateShift) {
    setSending(true);
    try {
      const totalMinutes = requestHours * 60 + requestMinutes;
      if (totalMinutes < 30) {
        showError('Il minimo richiedibile è 30 minuti.');
        setSending(false);
        return;
      }

      // Verifica che le note siano state inserite (obbligatorie)
      if (!requestReason || requestReason.trim() === '') {
        showError('Le note sono obbligatorie. Descrivi il motivo della richiesta.');
        setSending(false);
        return;
      }

      const totalHours = totalMinutes / 60;

      // Se stiamo modificando una richiesta esistente
      if (editingRequest) {
        const { error: updateErr } = await supabase
          .from('richieste_straordinari_v2')
          .update({
            ore_straordinario: totalHours,
            overtime_minutes: totalMinutes,
            note: requestReason || null,
          })
          .eq('id', editingRequest.id);

        if (updateErr) throw updateErr;

        showSuccess('Richiesta aggiornata con successo');
        setShowFormFor(null);
        setManualMode(false);
        setEditingRequest(null);
        setRequestHours(0);
        setRequestMinutes(0);
        setRequestReason('');
        await loadCandidates();
        setSending(false);
        return;
      }

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
          setSending(false);
          return;
        }

        if (!benefit) {
          showError('Non sei autorizzato a richiedere straordinari. Benefit straordinario non configurato.');
          setSending(false);
          return;
        }

        if (!benefit.straordinari_abilitati) {
          showError('Non sei autorizzato a richiedere straordinari. Benefit straordinario disabilitato.');
          setSending(false);
          return;
        }

        hourlyRate = Number(benefit.importo_benefit);
        if (hourlyRate <= 0) {
          showError('Tariffa straordinario non valida. Contatta l\'amministrazione.');
          setSending(false);
          return;
        }

        console.log(`✅ Tariffa straordinario: €${hourlyRate}/h`);
      } catch (err) {
        console.error('Errore recupero tariffa straordinario:', err);
        showError('Errore nel recupero della tariffa straordinario.');
        setSending(false);
        return;
      }

      // NUOVA RICHIESTA
      // Nota: total_amount NON viene inserito perché è una colonna GENERATED nel database
      // che calcola automaticamente: round((ore_straordinario * hourly_rate), 2)
      const payload: any = {
        crewid: user?.id,
        company_id: (user as any)?.user_metadata?.company_id,
        ore_straordinario: totalHours,
        overtime_minutes: totalMinutes,
        hourly_rate: hourlyRate,
        note: requestReason || null,
        status: 'in_attesa',
      };

      if (!manualMode && shift) {
        if (shift.source === 'warehouse' && shift.refShiftId) {
          payload.warehouse_checkin_id = shift.refShiftId;
          payload.turno_id = shift.refShiftId;
          if (shift.date) {
            payload.shift_date = shift.date;
          }
        }
        if (shift.source === 'event' && shift.refEventId) {
          payload.event_id = shift.refEventId;
          if (shift.date) {
            payload.shift_date = shift.date;
          }
        }
      }

      const { error } = await supabase.from('richieste_straordinari_v2').insert(payload);

      if (error) {
        console.error('Insert to richieste_straordinari_v2 failed', error);
        throw error;
      }

      showSuccess('Richiesta straordinario inviata');
      setShowFormFor(null);
      setManualMode(false);
      setEditingRequest(null);
      setRequestHours(0);
      setRequestMinutes(0);
      setRequestReason('');
      await loadCandidates();
    } catch (err: any) {
      console.error('handleRequestSubmit', err);
      showError(err?.message || 'Errore invio richiesta straordinario');
    } finally {
      setSending(false);
    }
  }

  async function handleRefresh() {
    try {
      await Promise.all([checkAuthorization(), loadCandidates()]);
      showSuccess('Aggiornato');
    } catch (err) {
      console.error('refresh straordinari error', err);
      showError('Errore aggiornamento');
    }
  }

  const openForm = (c?: CandidateShift) => {
    setShowFormFor(c ?? null);
    setEditingRequest(null);
    if (c) {
      const totalMinutes = hoursToMinutes(c.requestableHours);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setRequestHours(hours);
      setRequestMinutes(minutes);
    } else {
      setRequestHours(0);
      setRequestMinutes(0);
    }
  };

  const openEditForm = (req: ExistingRequest) => {
    setEditingRequest(req);
    setShowFormFor(null);
    setManualMode(false);
    
    const totalMinutes = req.overtime_minutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setRequestHours(hours);
    setRequestMinutes(minutes);
    setRequestReason(req.note || '');
  };

  // Filtri per le richieste
  const filteredRequests = existingRequests.filter(req => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'da_richiedere') return false;
    if (selectedFilter === 'in_attesa') return req.status === 'in_attesa';
    if (selectedFilter === 'approved') return req.status === 'approved';
    if (selectedFilter === 'rejected') return req.status === 'rejected';
    return true;
  });

  const showCandidates = selectedFilter === 'all' || selectedFilter === 'da_richiedere';

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Richieste Straordinari</h2>
          <p className="text-sm text-gray-400">Richiedi straordinario se autorizzato e se hai lavorato oltre le ore assegnate</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="p-2 rounded bg-gray-800 hover:bg-gray-700" title="Aggiorna">
            <RefreshCw />
          </button>
        </div>
      </div>

      {/* Controllo autorizzazione */}
      {isAuthorized === null ? (
        <div className="text-center py-12">
          <div className="text-sm text-gray-400">Verifica autorizzazione in corso...</div>
        </div>
      ) : isAuthorized === false ? (
        <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-300 mb-2">Accesso non autorizzato</h3>
              <p className="text-sm text-red-200 leading-relaxed mb-4">
                Non risulti autorizzato agli straordinari dal tuo contratto. 
                Per richiedere straordinari è necessario che il tuo profilo contrattuale includa questo benefit.
              </p>
              <p className="text-sm text-red-200/80">
                Se ritieni si tratti di un errore, contatta il tuo responsabile o l'ufficio HR.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4">
            <div className="text-sm text-green-300">Sei autorizzato agli straordinari.</div>
          </div>
    
          {/* Avviso importi indicativi */}
          <div className="mb-4 bg-blue-900/30 border border-blue-600/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-300 mb-1">Nota importante sugli importi</h4>
                <p className="text-sm text-blue-200 leading-relaxed">
                  Gli importi indicati per le ore straordinarie hanno carattere puramente orientativo e potrebbero subire variazioni. 
                  Stiamo lavorando per garantire la massima precisione nel calcolo delle tariffe. 
                  L'importo definitivo sarà confermato in fase di approvazione e liquidazione.
                </p>
              </div>
            </div>
          </div>

          {/* Filtri */}
          <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1.5 rounded text-sm ${
            selectedFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Tutte
        </button>
        <button
          onClick={() => setSelectedFilter('da_richiedere')}
          className={`px-3 py-1.5 rounded text-sm ${
            selectedFilter === 'da_richiedere'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Da Richiedere ({candidates.length})
        </button>
        <button
          onClick={() => setSelectedFilter('in_attesa')}
          className={`px-3 py-1.5 rounded text-sm ${
            selectedFilter === 'in_attesa'
              ? 'bg-yellow-600 text-black'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          In Attesa ({existingRequests.filter(r => r.status === 'in_attesa').length})
        </button>
        <button
          onClick={() => setSelectedFilter('approved')}
          className={`px-3 py-1.5 rounded text-sm ${
            selectedFilter === 'approved'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Approvate ({existingRequests.filter(r => r.status === 'approved').length})
        </button>
        <button
          onClick={() => setSelectedFilter('rejected')}
          className={`px-3 py-1.5 rounded text-sm ${
            selectedFilter === 'rejected'
              ? 'bg-red-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          Rifiutate ({existingRequests.filter(r => r.status === 'rejected').length})
        </button>
          </div>

          {/* Turni da richiedere */}
          {showCandidates && (
            <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Turni con ore eccedenti</h3>
          {loading ? (
            <div className="text-sm text-gray-400">Caricamento...</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-gray-500">Nessun turno con ore eccedenti rilevato.</div>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => (
                <div key={c.assignment_id} className="bg-gray-800 p-3 rounded border border-gray-700 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{c.title}</div>
                    <div className="text-sm text-gray-300">{c.date ? new Date(c.date).toLocaleDateString('it-IT') : '-'}</div>
                    <div className="text-sm text-gray-300 mt-2">
                      Previsto: {formatMinutesToHoursMinutes(hoursToMinutes(c.scheduledHours))} • Lavorato: {formatMinutesToHoursMinutes(hoursToMinutes(c.workedHours))}
                    </div>
                    <div className="text-sm font-semibold text-yellow-400 mt-1">
                      Richiedibili: {formatMinutesToHoursMinutes(hoursToMinutes(c.requestableHours))}
                      {c.excessHours !== c.requestableHours && (
                        <span className="text-xs text-gray-400 ml-1">(su {formatMinutesToHoursMinutes(hoursToMinutes(c.excessHours))} effettivi)</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <button onClick={() => openForm(c)} className="py-2 px-3 rounded bg-yellow-600 text-black mb-2">Richiedi</button>
                    <div className="text-xs text-gray-400">Fonte: {c.source === 'warehouse' ? 'Magazzino' : 'Evento'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
            </div>
          )}

          {/* Richieste esistenti */}
          {filteredRequests.length > 0 && (
            <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">
            {selectedFilter === 'in_attesa' && 'Richieste in Attesa'}
            {selectedFilter === 'approved' && 'Richieste Approvate'}
            {selectedFilter === 'rejected' && 'Richieste Rifiutate'}
            {selectedFilter === 'all' && 'Richieste Esistenti'}
            {selectedFilter === 'da_richiedere' && ''}
          </h3>
          <div className="space-y-3">
            {filteredRequests.map((req) => (
              <div key={req.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-white">{req.title}</div>
                    <div className="text-sm text-gray-300">
                      {req.shift_date ? new Date(req.shift_date).toLocaleDateString('it-IT') : '-'}
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${
                    req.status === 'in_attesa' ? 'bg-yellow-900/20 text-yellow-300 border border-yellow-600/30' :
                    req.status === 'approved' ? 'bg-green-900/20 text-green-300 border border-green-600/30' :
                    'bg-red-900/20 text-red-300 border border-red-600/30'
                  }`}>
                    {req.status === 'in_attesa' ? 'In Attesa' :
                     req.status === 'approved' ? 'Approvata' :
                     'Rifiutata'}
                  </div>
                </div>

                <div className="text-sm text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Ore richieste: {formatMinutesToHoursMinutes(req.overtime_minutes)}</span>
                  </div>
                  {req.total_amount && (
                    <div className="text-green-300 mt-1">
                      Importo: €{req.total_amount.toFixed(2)}
                    </div>
                  )}
                </div>

                {req.note && (
                  <div className="text-sm text-gray-400 italic mb-2">
                    Note: {req.note}
                  </div>
                )}

                <div className="flex gap-2 items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Fonte: {req.source === 'warehouse' ? 'Magazzino' : 'Evento'}
                  </div>
                  {req.status === 'in_attesa' && (
                    <button
                      onClick={() => openEditForm(req)}
                      className="py-1.5 px-3 rounded bg-blue-600 text-white text-sm"
                    >
                      Modifica
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

          {/* Richiesta manuale */}
          {showCandidates && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Richiesta manuale</h3>
              <p className="text-sm text-gray-400 mb-2">Se non vedi il turno ma sei autorizzato, puoi creare una richiesta manuale (ammessa solo se autorizzato).</p>
              <div className="flex gap-3">
                <button onClick={() => { setManualMode(true); openForm(undefined); }} className="py-2 px-3 rounded bg-blue-600 text-white">Crea richiesta manuale</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Form modal / panel */}
      {(showFormFor !== null || manualMode || editingRequest !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-gray-900 rounded p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">
                {editingRequest ? `Modifica Richiesta - ${editingRequest.title}` :
                 manualMode ? 'Richiesta Straordinario (manuale)' :
                 `Richiesta per ${showFormFor?.title}`}
              </h3>
              <button onClick={() => { 
                setShowFormFor(null); 
                setManualMode(false); 
                setEditingRequest(null);
                setRequestHours(0); 
                setRequestMinutes(0); 
                setRequestReason(''); 
              }} className="text-gray-400">Chiudi</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {!manualMode && !editingRequest && showFormFor && (
                <div className="bg-yellow-900/20 border border-yellow-600/30 rounded p-3 mb-2">
                  <div className="text-sm text-yellow-400 font-semibold">
                    Massimo richiedibile: {formatMinutesToHoursMinutes(hoursToMinutes(showFormFor.requestableHours))}
                  </div>
                  {showFormFor.excessHours !== showFormFor.requestableHours && (
                    <div className="text-xs text-gray-400 mt-1">
                      Ore effettive: {formatMinutesToHoursMinutes(hoursToMinutes(showFormFor.excessHours))} (arrotondato a multipli di 30 min)
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Ore e minuti da richiedere (tagli di 30 minuti)</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Ore</label>
                    <input
                      type="number"
                      min="0"
                      max={showFormFor ? Math.floor(hoursToMinutes(showFormFor.requestableHours) / 60) : 24}
                      value={requestHours}
                      onChange={(e) => setRequestHours(parseInt(e.target.value) || 0)}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center text-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Minuti</label>
                    <select
                      value={requestMinutes}
                      onChange={(e) => setRequestMinutes(parseInt(e.target.value))}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-center text-lg"
                    >
                      <option value="0">00</option>
                      <option value="30">30</option>
                    </select>
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-2 text-center">
                  Totale: {formatMinutesToHoursMinutes((requestHours * 60) + requestMinutes)}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300">
                  Note <span className="text-red-400">*</span>
                </label>
                <textarea 
                  value={requestReason} 
                  onChange={(e) => setRequestReason(e.target.value)} 
                  rows={3} 
                  placeholder="Descrivi il motivo della richiesta... (obbligatorio)" 
                  className={`mt-1 w-full bg-gray-800 border rounded px-2 py-2 ${
                    requestReason.trim() === '' ? 'border-red-600' : 'border-gray-700'
                  }`}
                  required
                />
                {requestReason.trim() === '' && (
                  <p className="text-xs text-red-400 mt-1">Le note sono obbligatorie</p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleRequestSubmit(showFormFor ?? undefined)} disabled={sending} className="flex-1 py-3 rounded bg-yellow-600 text-black">
                  {sending ? 'Invio...' : (editingRequest ? 'Aggiorna richiesta' : 'Invia richiesta')}
                </button>
                <button onClick={() => { 
                  setShowFormFor(null); 
                  setManualMode(false); 
                  setEditingRequest(null);
                }} className="px-4 py-3 rounded border border-gray-700">Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Straordinari;
