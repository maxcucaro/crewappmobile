import React, { useEffect, useState } from 'react';
import { Calendar, Clock, RefreshCw } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../utils/supabase';

type VacationType = 'vacation' | 'leave';

interface VacationLeaveRequest {
  id: string;
  tipo_richiesta?: string | null;
  data_inizio?: string | null;
  data_fine?: string | null;
  giorni_richiesti?: number | null;
  stato?: string | null;
  status?: string | null;
  motivo?: string | null;
  rejection_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  [k: string]: any;
}

const FeriePermessi: React.FC = () => {
  const { user } = useCompanyAuth();
  const { showSuccess, showError } = useToastContext();

  const [loading, setLoading] = useState<boolean>(true);
  const [sendingVacation, setSendingVacation] = useState<boolean>(false);
  const [vacationForm, setVacationForm] = useState({
    request_type: 'vacation' as VacationType,
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    reason: ''
  });
  const [vacationRequests, setVacationRequests] = useState<VacationLeaveRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      await loadVacationRequests();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadVacationRequests() {
    try {
      const { data, error } = await supabase
        .from('crew_richiesteferie_permessi')
        .select('*')
        .eq('dipendente_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.warn('Errore loadVacationRequests:', error);
        setVacationRequests([]);
        return;
      }

      setVacationRequests((data as any[]) || []);
    } catch (err) {
      console.error('Errore loadVacationRequests:', err);
      setVacationRequests([]);
    }
  }

  async function resolveCompanyId(): Promise<string | null> {
    try {
      const { data: cm } = await supabase.from('crew_members').select('company_id').eq('id', user?.id).maybeSingle();
      if ((cm as any)?.company_id) return String((cm as any).company_id);

      const { data: rrByAuth } = await supabase
        .from('registration_requests')
        .select('parent_company_id')
        .eq('auth_user_id', user?.id)
        .maybeSingle();
      if ((rrByAuth as any)?.parent_company_id) return String((rrByAuth as any).parent_company_id);

      const { data: u } = await supabase.from('users').select('email').eq('id', user?.id).maybeSingle();
      const email = (u as any)?.email ?? null;
      if (email) {
        const { data: rrByEmail } = await supabase
          .from('registration_requests')
          .select('parent_company_id')
          .ilike('email', email)
          .limit(1)
          .maybeSingle();
        if ((rrByEmail as any)?.parent_company_id) return String((rrByEmail as any).parent_company_id);
      }
      return null;
    } catch (err) {
      console.error('resolveCompanyId error:', err);
      return null;
    }
  }

  function calculateDays(start: string, end: string) {
    if (!start || !end) return 0;
    const a = new Date(start);
    const b = new Date(end);
    const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }

  function calculateHours(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const diffMinutes = endMinutes - startMinutes;
    return diffMinutes > 0 ? Number((diffMinutes / 60).toFixed(2)) : 0;
  }

  async function handleVacationSubmit() {
    if (!vacationForm.start_date) {
      showError('Inserisci la data di inizio');
      return;
    }
    if (vacationForm.request_type === 'vacation' && !vacationForm.end_date) {
      showError('Inserisci la data di fine per le ferie');
      return;
    }
    if (vacationForm.request_type === 'vacation' && new Date(vacationForm.end_date) < new Date(vacationForm.start_date)) {
      showError('La data di fine deve essere successiva alla data di inizio');
      return;
    }

    if (vacationForm.request_type === 'leave') {
      if (!vacationForm.start_time || !vacationForm.end_time) {
        showError('Inserisci orario di inizio e fine per il permesso');
        return;
      }
      if (vacationForm.start_time >= vacationForm.end_time) {
        showError('L\'orario di fine deve essere successivo all\'orario di inizio');
        return;
      }
    }

    setSendingVacation(true);
    try {
      const azienda = await resolveCompanyId();
      if (!azienda) {
        showError('Azienda non trovata per il tuo profilo. Contatta l\'amministratore.');
        setSendingVacation(false);
        return;
      }

      const payload: any = {
        azienda_id: azienda,
        dipendente_id: user?.id,
        tipo_richiesta: vacationForm.request_type === 'vacation' ? 'ferie' : 'permesso',
        data_inizio: vacationForm.start_date,
        motivo: vacationForm.reason || null,
        stato: 'in_attesa'
      };

      if (vacationForm.request_type === 'vacation') {
        payload.data_fine = vacationForm.end_date;
        payload.giorni_richiesti = calculateDays(vacationForm.start_date, vacationForm.end_date);
      } else {
        payload.data_fine = vacationForm.start_date;
        payload.orario_inizio = vacationForm.start_time;
        payload.orario_fine = vacationForm.end_time;
        payload.ore_richieste = calculateHours(vacationForm.start_time, vacationForm.end_time);
        payload.giorni_richiesti = 0;
      }

      const { error } = await supabase.from('crew_richiesteferie_permessi').insert(payload);
      if (error) throw error;

      showSuccess('Richiesta inviata');
      setVacationForm({ request_type: 'vacation', start_date: '', end_date: '', start_time: '', end_time: '', reason: '' });
      await loadVacationRequests();
    } catch (err: any) {
      console.error('Errore handleVacationSubmit:', err);
      showError(err?.message || 'Errore invio richiesta');
    } finally {
      setSendingVacation(false);
    }
  }

  function normalizeStatus(row: VacationLeaveRequest): string {
    const raw = (row.stato ?? row.status ?? row.state ?? row.stato_richiesta ?? null) as string | null;
    if (!raw) return 'in_attesa';
    const s = String(raw).toLowerCase();
    if (s.includes('approv') || s === 'approved' || s === 'accepted') return 'approved';
    if (s.includes('rifiut') || s === 'rejected' || s === 'refused') return 'rejected';
    if (s.includes('in_attesa') || s.includes('pending') || s.includes('in attesa')) return 'pending';
    return s;
  }

  function statusLabelAndClass(row: VacationLeaveRequest) {
    const st = normalizeStatus(row);
    if (st === 'approved') return { label: 'Approvata', className: 'bg-green-100 text-green-800' };
    if (st === 'rejected') return { label: 'Rifiutata', className: 'bg-red-100 text-red-800' };
    return { label: 'In attesa', className: 'bg-yellow-100 text-yellow-800' };
  }

  function formatDate(d?: string | null) {
    if (!d) return '-';
    try {
      return new Date(d).toLocaleDateString('it-IT');
    } catch {
      return d;
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await loadVacationRequests();
      showSuccess('Aggiornato');
    } catch (err) {
      console.error('refresh error', err);
      showError('Errore aggiornamento');
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Ferie e Permessi</h2>
          <p className="text-sm text-gray-400">Invia richieste e controlla lo stato</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} className="p-2 rounded bg-gray-800 hover:bg-gray-700 text-gray-200" title="Aggiorna">
            <RefreshCw />
          </button>
        </div>
      </div>

      {/* Responsive type selector: stacked on small screens, side-by-side on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => setVacationForm({ ...vacationForm, request_type: 'vacation' })}
          className={`w-full text-left py-3 px-3 rounded ${vacationForm.request_type === 'vacation' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}
        >
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 flex-shrink-0" />
            <div className="leading-snug">
              <div className="text-sm font-medium whitespace-normal break-words">Ferie</div>
              <div className="text-xs text-gray-300">Giorni interi</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => setVacationForm({ ...vacationForm, request_type: 'leave' })}
          className={`w-full text-left py-3 px-3 rounded ${vacationForm.request_type === 'leave' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-200'}`}
        >
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 flex-shrink-0" />
            <div className="leading-snug">
              <div className="text-sm font-medium whitespace-normal break-words">Permesso</div>
              <div className="text-xs text-gray-300">Ore / Mezze giornate</div>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-sm text-gray-300">Data Inizio *</label>
          <input
            type="date"
            value={vacationForm.start_date}
            onChange={(e) => setVacationForm({ ...vacationForm, start_date: e.target.value })}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm text-gray-300">{vacationForm.request_type === 'vacation' ? 'Data Fine *' : 'Data *'}</label>
          <input
            type="date"
            value={vacationForm.request_type === 'vacation' ? vacationForm.end_date : vacationForm.start_date}
            onChange={(e) => setVacationForm({
              ...vacationForm,
              end_date: vacationForm.request_type === 'vacation' ? e.target.value : vacationForm.end_date,
              start_date: vacationForm.request_type === 'leave' ? e.target.value : vacationForm.start_date
            })}
            className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2"
          />
        </div>
      </div>

      {vacationForm.request_type === 'leave' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-sm text-gray-300">Ora Inizio *</label>
            <input type="time" value={vacationForm.start_time} onChange={(e) => setVacationForm({ ...vacationForm, start_time: e.target.value })} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2" required />
          </div>
          <div>
            <label className="text-sm text-gray-300">Ora Fine *</label>
            <input type="time" value={vacationForm.end_time} onChange={(e) => setVacationForm({ ...vacationForm, end_time: e.target.value })} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2" required />
          </div>
        </div>
      )}

      <div className="mb-3">
        <label className="text-sm text-gray-300">Motivo (opzionale)</label>
        <textarea value={vacationForm.reason} onChange={(e) => setVacationForm({ ...vacationForm, reason: e.target.value })} rows={3} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2" placeholder={vacationForm.request_type === 'leave' ? 'Es: visita medica, commissione personale...' : 'Es: motivi personali, vacanza...'} />
      </div>

      <div className="flex space-x-3 mb-6">
        <button onClick={handleVacationSubmit} disabled={sendingVacation} className="flex-1 py-3 rounded bg-blue-600 text-white">
          {sendingVacation ? 'Invio...' : 'Invia Richiesta'}
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Richieste Inviate</h3>
        <div className="space-y-3">
          {vacationRequests.length === 0 ? (
            <div className="text-sm text-gray-500">Nessuna richiesta inviata</div>
          ) : vacationRequests.map((r) => {
            const raw = r as any;
            const st = normalizeStatus(r);
            const { label, className } = statusLabelAndClass(r);
            const rejection = r.rejection_reason ?? r.rifiuto ?? r.motivo_rifiuto ?? raw?.rejection_reason ?? null;
            const approver = r.approved_by ?? raw?.approved_by ?? null;
            const approvedAt = r.approved_at ?? raw?.approved_at ?? null;
            const tipoRichiesta = r.tipo_richiesta ?? raw?.tipo_richiesta ?? 'Ferie/Permesso';
            const isPermesso = tipoRichiesta.toLowerCase().includes('permess');
            const orarioInizio = raw?.orario_inizio ?? null;
            const orarioFine = raw?.orario_fine ?? null;
            const oreRichieste = raw?.ore_richieste ?? null;

            return (
              <div key={r.id} className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-white capitalize">{tipoRichiesta}</div>
                    <div className="text-sm text-gray-300">
                      {formatDate(r.data_inizio ?? raw?.data_inizio ?? raw?.start_date ?? null)}
                      {!isPermesso && (r.data_fine || raw?.data_fine) ? ` — ${formatDate(r.data_fine ?? raw?.data_fine ?? raw?.end_date ?? null)}` : ''}
                      {!isPermesso && r.giorni_richiesti ? ` • ${r.giorni_richiesti} giorno/i` : ''}
                      {isPermesso && orarioInizio && orarioFine && <span> • {orarioInizio.substring(0, 5)} - {orarioFine.substring(0, 5)}</span>}
                      {isPermesso && oreRichieste && <span> • {oreRichieste} ore</span>}
                    </div>
                    {r.motivo && <div className="text-sm text-gray-300 mt-2">Motivo: {r.motivo}</div>}
                    {rejection && <div className="text-sm text-red-300 mt-2">Motivo rifiuto: {rejection}</div>}
                    {approver && <div className="text-xs text-gray-400 mt-2">Approvata da: {approver} {approvedAt ? `• ${formatDate(approvedAt)}` : ''}</div>}
                  </div>
                  <div className="text-right ml-2">
                    <div className={`text-xs px-2 py-1 rounded-full ${className}`}>{label}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FeriePermessi;