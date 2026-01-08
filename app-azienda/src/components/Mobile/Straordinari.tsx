import React, { useEffect, useState } from 'react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../utils/supabase';
import { Clock, RefreshCw } from 'lucide-react';

/**
 * Straordinari - richiesta straordinari
 *
 * Requisiti:
 * - Lo straordinario può essere richiesto solo se il dipendente è autorizzato (benefit nel contratto)
 *   - Tentiamo di leggere campi possibili nella tabella crew_members / registration_requests per determinare il permesso
 * - Lo straordinario può essere richiesto quando l'utente ha lavorato più delle ore previste per il turno assegnato
 *   - Carichiamo assegnazioni turno (crew_assegnazione_turni) e checkin/checkout (warehouse_checkins / timesheet_entries)
 *   - Calcoliamo hours_scheduled e hours_worked -> excess = worked - scheduled
 * - UI:
 *   - Lista turni candidati con excess > 0, mostrando scheduled / worked / excess
 *   - Pulsante per aprire modal/form per richiedere straordinario (max = excess)
 *   - Possibilità di inserire richiesta manuale se autorizzato (anche senza turno rilevabile)
 *
 * Nota:
 * - Il codice è difensivo: cerca nomi di colonna alternativi, gestisce assenze e mostra messaggi chiari.
 * - Inserimento usa tabella preferita 'crew_richieste_straordinari' (se non esiste prova 'straordinari' o 'crew_straordinari').
 */

type CandidateShift = {
  source: 'warehouse' | 'event';
  assignment_id: string; // id of crew_assegnazione_turni or timesheet_entries row
  refShiftId?: string | null; // crew_assegnazione_turni.id (for warehouse)
  refEventId?: string | null; // crew_events.id (for event)
  date?: string | null;
  title: string;
  scheduledHours: number; // hours expected for the shift
  workedHours: number; // computed actual worked hours
  excessHours: number; // worked - scheduled (only positive shown)
  raw?: any;
};

const Straordinari: React.FC = () => {
  const { user } = useCompanyAuth();
  const { showSuccess, showError } = useToastContext();

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null = unknown/loading
  const [candidates, setCandidates] = useState<CandidateShift[]>([]);

  // modal / form
  const [showFormFor, setShowFormFor] = useState<CandidateShift | null>(null);
  const [manualMode, setManualMode] = useState(false); // allow manual request (if authorized)
  const [requestHours, setRequestHours] = useState<string>('0.00');
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
    // Check if user has overtime benefits assigned via crew_tariffe
    try {
      // 1) Load tariffe assignments
      const { data: assignments } = await supabase
        .from('crew_assegnazionetariffa')
        .select('tariffe_ids')
        .eq('dipendente_id', user?.id)
        .eq('attivo', true);

      if (assignments && assignments.length > 0) {
        // 2) Collect all tariffe IDs
        const allTariffeIds: string[] = [];
        assignments.forEach((assignment: any) => {
          if (assignment.tariffe_ids && assignment.tariffe_ids.length > 0) {
            allTariffeIds.push(...assignment.tariffe_ids);
          }
        });

        if (allTariffeIds.length > 0) {
          // 3) Load tariffe details
          const { data: tariffe } = await supabase
            .from('crew_tariffe')
            .select('tipo_calcolo, categoria')
            .in('id', allTariffeIds)
            .eq('attivo', true);

          // 4) Check if any tariffa is for overtime
          if (tariffe && tariffe.length > 0) {
            const hasOvertimeBenefit = tariffe.some((t: any) =>
              t.tipo_calcolo?.includes('straordinario') ||
              t.categoria?.includes('straordinario')
            );

            if (hasOvertimeBenefit) {
              setIsAuthorized(true);
              return true;
            }
          }
        }
      }
    } catch (e) {
      console.error('Error checking overtime authorization via tariffe', e);
    }

    // Fallback: check old boolean fields
    try {
      const { data: cm } = await supabase.from('crew_members').select('benefit_straordinari').eq('id', user?.id).maybeSingle();
      if (cm && (cm as any).benefit_straordinari) {
        setIsAuthorized(true);
        return true;
      }
    } catch (e) {
      // ignore
    }

    try {
      const { data: rr } = await supabase.from('registration_requests').select('benefit_straordinari').eq('auth_user_id', user?.id).maybeSingle();
      if (rr && (rr as any).benefit_straordinari) {
        setIsAuthorized(true);
        return true;
      }
    } catch (e) {
      // ignore
    }

    // Not authorized
    setIsAuthorized(false);
    return false;
  }

  // utility: parse hh:mm or timestamp strings and compute difference in hours
  function parseDateTime(val?: string | null) {
    if (!val) return null;
    const d = new Date(val);
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

    // Load warehouse shifts with overtime (requisito_straordinari = true)
    try {
      const { data: overtimeShifts } = await supabase
        .from('warehouse_checkins')
        .select(`
          id,
          date,
          check_in_time,
          check_out_time,
          net_hours,
          overtime_hours,
          "oraro in eccesso",
          shift_id,
          assegnazione_id,
          notes
        `)
        .eq('crew_id', user.id)
        .eq('requisito_straordinari', true)
        .order('date', { ascending: false })
        .limit(100);

      for (const shift of (overtimeShifts || []) as any[]) {
        try {
          // Parse excess hours from interval format or numeric field
          let excessHours = 0;

          // Try overtime_hours first (numeric)
          if (shift.overtime_hours) {
            excessHours = Number(shift.overtime_hours);
          }
          // Try "oraro in eccesso" (interval)
          else if (shift['oraro in eccesso']) {
            const interval = shift['oraro in eccesso'];
            // Parse PostgreSQL interval format (e.g., "02:30:00")
            const match = interval.match(/(\d+):(\d+):(\d+)/);
            if (match) {
              const hours = parseInt(match[1], 10);
              const minutes = parseInt(match[2], 10);
              excessHours = hours + (minutes / 60);
            }
          }

          // Only include if there are actual excess hours
          if (excessHours > 0) {
            // Calculate total worked hours
            const workedHours = shift.net_hours ? Number(shift.net_hours) : null;
            const scheduledHours = workedHours ? Math.round((workedHours - excessHours) * 100) / 100 : 8;

            out.push({
              source: 'warehouse',
              assignment_id: shift.assegnazione_id || shift.shift_id || shift.id,
              refShiftId: shift.shift_id || shift.id,
              date: shift.date,
              title: `Turno Magazzino ${shift.date}`,
              scheduledHours,
              workedHours: workedHours || scheduledHours + excessHours,
              excessHours: Math.round(excessHours * 100) / 100,
              raw: shift
            });
          }
        } catch (e) {
          console.warn('Error processing overtime shift', shift, e);
          continue;
        }
      }
    } catch (e) {
      console.warn('Failed to load warehouse overtime shifts', e);
    }

    // Also try to find event-based overtime (rare): if timesheet_entries show worked > event scheduled (we attempt)
    try {
      const { data: teAll } = await supabase
        .from('timesheet_entries')
        .select('id, event_id, start_time, end_time, date')
        .eq('crew_id', user.id)
        .order('date', { ascending: false })
        .limit(500);
      if (teAll) {
        // group by event_id and date and try to compare with crew_events scheduled duration if available
        for (const t of teAll as any[]) {
          try {
            const worked = durationHours(t.start_time, t.end_time);
            if (!worked || !t.event_id) continue;
            // fetch event info
            const { data: ev } = await supabase.from('crew_events').select('*').eq('id', t.event_id).maybeSingle();
            // try to get scheduled hours from event (duration_ore / durata_ore / start_time & end_time)
            let scheduled = null as number | null;
            if (ev) {
              if ((ev as any).durata_ore) scheduled = Number((ev as any).durata_ore);
              else if ((ev as any).duration_hours) scheduled = Number((ev as any).duration_hours);
              else if ((ev as any).start_time && (ev as any).end_time) {
                scheduled = durationHours((ev as any).start_time, (ev as any).end_time);
              }
            }
            if (!scheduled) scheduled = 8;
            const excess = Math.round(Math.max(0, worked - scheduled) * 100) / 100;
            if (excess > 0) {
              out.push({
                source: 'event',
                assignment_id: t.id,
                refEventId: t.event_id,
                date: t.date ?? null,
                title: (ev && ((ev as any).title || (ev as any).name)) || `Evento ${t.event_id}`,
                scheduledHours: scheduled,
                workedHours: Math.round(worked * 100) / 100,
                excessHours: excess,
                raw: { timesheet: t, event: ev }
              });
            }
          } catch (e) {
            // ignore per-entry errors
          }
        }
      }
    } catch (e) {
      console.warn('timesheet_entries load failed', e);
    }

    // sort by excess desc then date desc
    out.sort((a, b) => {
      if (b.excessHours !== a.excessHours) return b.excessHours - a.excessHours;
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    setCandidates(out);
    return out;
  }

  async function handleRequestSubmit(shift?: CandidateShift) {
    if (!user?.id) {
      showError('Utente non autenticato');
      return;
    }
    // determine hours to request
    const hours = parseFloat(requestHours);
    if (isNaN(hours) || hours <= 0) {
      showError('Inserisci un numero di ore valido');
      return;
    }

    // if shift provided, enforce max <= excessHours
    if (shift) {
      if (hours > shift.excessHours + 0.001) {
        showError(`Puoi richiedere al massimo ${shift.excessHours} ore per questo turno`);
        return;
      }
    }

    if (!isAuthorized) {
      showError('Non sei autorizzato agli straordinari');
      return;
    }

    setSending(true);
    try {
      // Build payload for richieste_straordinari_v2 table
      const payload: any = {
        crewid: user.id,
        ore_straordinario: hours,
        note: requestReason || null,
        status: 'in_attesa'
      };

      // attach shift/event references if available
      if (shift) {
        if (shift.source === 'warehouse' && shift.refShiftId) {
          payload.turno_id = shift.refShiftId;
        }
        if (shift.source === 'event' && shift.refEventId) {
          payload.event_id = shift.refEventId;
        }
      }

      // Insert into richieste_straordinari_v2
      const { error } = await supabase.from('richieste_straordinari_v2').insert(payload);

      if (error) {
        console.error('Insert to richieste_straordinari_v2 failed', error);
        throw error;
      }

      showSuccess('Richiesta straordinario inviata');
      // reset form / close modal
      setShowFormFor(null);
      setManualMode(false);
      setRequestHours('0.00');
      setRequestReason('');
      // refresh candidates list to reflect that a request was made (may or may not change)
      await loadCandidates();
    } catch (err: any) {
      console.error('handleRequestSubmit', err);
      showError(err?.message || 'Errore invio richiesta straordinario');
    } finally {
      setSending(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([checkAuthorization(), loadCandidates()]);
      showSuccess('Aggiornato');
    } catch (err) {
      console.error('refresh straordinari error', err);
      showError('Errore aggiornamento');
    } finally {
      setRefreshing(false);
    }
  }

  // UI helpers
  const openForm = (c?: CandidateShift) => {
    setShowFormFor(c ?? null);
    if (c) setRequestHours(String(c.excessHours));
    else setRequestHours('0.00');
  };

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

      <div className="mb-4">
        {isAuthorized === null ? (
          <div className="text-sm text-gray-400">Verifica autorizzazione...</div>
        ) : isAuthorized === false ? (
          <div className="text-sm text-red-300">Non risulti autorizzato agli straordinari dal tuo contratto.</div>
        ) : (
          <div className="text-sm text-green-300">Sei autorizzato agli straordinari.</div>
        )}
      </div>

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
                  <div className="text-sm text-gray-300 mt-2">Previsto: {c.scheduledHours}h • Lavorato: {c.workedHours}h • Eccedenza: {c.excessHours}h</div>
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

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Richiesta manuale</h3>
        <p className="text-sm text-gray-400 mb-2">Se non vedi il turno ma sei autorizzato, puoi creare una richiesta manuale (ammessa solo se autorizzato).</p>
        <div className="flex gap-3">
          <button onClick={() => { setManualMode(true); openForm(undefined); }} className="py-2 px-3 rounded bg-blue-600 text-white">Crea richiesta manuale</button>
        </div>
      </div>

      {/* Form modal / panel */}
      {(showFormFor !== null || manualMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg bg-gray-900 rounded p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">{manualMode ? 'Richiesta Straordinario (manuale)' : `Richiesta per ${showFormFor?.title}`}</h3>
              <button onClick={() => { setShowFormFor(null); setManualMode(false); setRequestHours('0.00'); setRequestReason(''); }} className="text-gray-400">Chiudi</button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {!manualMode && showFormFor && (
                <div>
                  <div className="text-sm text-gray-300">Massimo ore richiedibili: {showFormFor.excessHours}h</div>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-300">Ore da richiedere</label>
                <input type="number" step="0.25" min="0" value={requestHours} onChange={(e) => setRequestHours(e.target.value)} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2" />
              </div>

              <div>
                <label className="text-sm text-gray-300">Note</label>
                <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)} rows={3} placeholder="Descrivi il motivo della richiesta..." className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-2 py-2" />
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleRequestSubmit(showFormFor ?? undefined)} disabled={sending} className="flex-1 py-3 rounded bg-yellow-600 text-black">
                  {sending ? 'Invio...' : 'Invia richiesta'}
                </button>
                <button onClick={() => { setShowFormFor(null); setManualMode(false); }} className="px-4 py-3 rounded border border-gray-700">Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Straordinari;