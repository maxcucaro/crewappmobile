import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';
import { RefreshCw } from 'lucide-react';

type UnifiedRequest =
  | {
      id: string;
      kind: 'vacation';
      title: string;
      start_date?: string | null;
      end_date?: string | null;
      days?: number;
      status?: string | null;
      raw?: any;
      dateForFilter?: string | null;
    }
  | {
      id: string;
      kind: 'expense';
      title: string;
      amount: number;
      expense_date?: string | null;
      status?: string | null;
      raw?: any;
      dateForFilter?: string | null;
    }
  | {
      id: string;
      kind: 'straordinario';
      title: string;
      date?: string | null;
      hours?: number | null;
      status?: string | null;
      raw?: any;
      dateForFilter?: string | null;
    };

const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('it-IT') : '-');

const RiepilogoRichieste: React.FC = () => {
  const { user } = useAuth();
  const { showError } = useToastContext();

  const [loading, setLoading] = useState<boolean>(true);
  const [items, setItems] = useState<UnifiedRequest[]>([]);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    loadAll().catch((e) => {
      console.error('loadAll error', e);
      showError('Errore caricamento riepilogo');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [vac, exp, stra] = await Promise.all([
        loadVacations().catch((e) => {
          console.warn('loadVacations failed', e);
          return [] as UnifiedRequest[];
        }),
        loadExpenses().catch((e) => {
          console.warn('loadExpenses failed', e);
          return [] as UnifiedRequest[];
        }),
        loadStraordinari().catch((e) => {
          console.warn('loadStraordinari failed (maybe table missing)', e);
          return [] as UnifiedRequest[];
        })
      ]);

      // merge and sort by dateForFilter desc (most recent first)
      const merged = [...vac, ...exp, ...stra].sort((a, b) => {
        const da = a.dateForFilter ? new Date(a.dateForFilter).getTime() : 0;
        const db = b.dateForFilter ? new Date(b.dateForFilter).getTime() : 0;
        return db - da;
      });

      setItems(merged);
    } finally {
      setLoading(false);
    }
  }

  async function loadVacations(): Promise<UnifiedRequest[]> {
    if (!user?.id) return [];
    const out: UnifiedRequest[] = [];
    try {
      const { data, error } = await supabase
        .from('crew_richiesteferie_permessi')
        .select('*')
        .eq('dipendente_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      (data || []).forEach((r: any) => {
        out.push({
          id: String(r.id),
          kind: 'vacation',
          title: r.tipo_richiesta ?? 'Ferie/Permesso',
          start_date: r.data_inizio ?? r.start_date ?? null,
          end_date: r.data_fine ?? r.end_date ?? null,
          days: r.giorni_richiesti ?? null,
          status: r.stato ?? null,
          raw: r,
          dateForFilter: r.data_inizio ?? r.start_date ?? r.created_at ?? null
        });
      });
      return out;
    } catch (err) {
      console.error('loadVacations error', err);
      throw err;
    }
  }

  async function loadExpenses(): Promise<UnifiedRequest[]> {
    if (!user?.id) return [];
    const out: UnifiedRequest[] = [];
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('crew_id', user.id)
        .order('expense_date', { ascending: false })
        .limit(1000);
      if (error) throw error;
      (data || []).forEach((r: any) => {
        out.push({
          id: String(r.id),
          kind: 'expense',
          title: r.category ?? 'Spesa',
          amount: Number(r.amount ?? 0),
          expense_date: r.expense_date ?? null,
          status: r.status ?? null,
          raw: r,
          dateForFilter: r.expense_date ?? r.submitted_at ?? null
        });
      });
      return out;
    } catch (err) {
      console.error('loadExpenses error', err);
      throw err;
    }
  }

  // Try a couple of possible straordinari table names; if none exist return []
  async function loadStraordinari(): Promise<UnifiedRequest[]> {
    if (!user?.id) return [];
    const candidates = ['crew_richieste_straordinari', 'crew_straordinari', 'straordinari'];
    for (const table of candidates) {
      try {
        const { data, error } = await supabase.from(table).select('*').eq('dipendente_id', user.id).limit(1000);
        if (error) {
          // table may not exist or other error - try next candidate
          console.warn(`loadStraordinari: table ${table} query error`, error);
          continue;
        }
        if (!data) continue;
        return (data as any[]).map((r: any) => ({
          id: String(r.id),
          kind: 'straordinario',
          title: r.tipo ?? r.title ?? 'Straordinario',
          date: r.data ?? r.date ?? r.created_at ?? null,
          hours: r.ore ?? r.hours ?? null,
          status: r.stato ?? r.status ?? null,
          raw: r,
          dateForFilter: r.data ?? r.date ?? r.created_at ?? null
        }));
      } catch (err) {
        console.warn(`loadStraordinari: table ${table} fetch failed`, err);
        continue;
      }
    }
    return [];
  }

  function matchesFilters(item: UnifiedRequest) {
    // date filter
    if (startDate) {
      if (!item.dateForFilter) return false;
      if (new Date(item.dateForFilter) < new Date(startDate)) return false;
    }
    if (endDate) {
      if (!item.dateForFilter) return false;
      // include end day
      const itemDate = new Date(item.dateForFilter);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (itemDate > end) return false;
    }
    // text filter
    if (query) {
      const q = query.toLowerCase();
      const fieldsToSearch: string[] = [];
      if (item.kind === 'vacation') {
        fieldsToSearch.push(item.title, String(item.raw?.motivo ?? ''), String(item.raw?.azienda_id ?? ''), String(item.raw?.event_title ?? ''));
      } else if (item.kind === 'expense') {
        fieldsToSearch.push(item.title, String(item.raw?.description ?? ''), String(item.raw?.notes ?? ''), String(item.raw?.company_name ?? ''));
      } else {
        fieldsToSearch.push(item.title, String(item.raw?.motivo ?? ''), String(item.raw?.description ?? ''));
      }
      const hay = fieldsToSearch.filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  const filtered = items.filter(matchesFilters);

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Riepilogo Richieste</h2>
          <p className="text-sm text-gray-400">Visualizza tutte le tue richieste: ferie, note spese e straordinari</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            title="Aggiorna"
            onClick={() => loadAll().catch((e) => console.error(e))}
            className="p-2 rounded bg-gray-800 hover:bg-gray-700"
          >
            <RefreshCw />
          </button>
        </div>
      </div>

      <div className="bg-gray-800 p-3 rounded mb-4 grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-300">Da</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1" />
        </div>
        <div>
          <label className="text-sm text-gray-300">A</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1" />
        </div>
        <div>
          <label className="text-sm text-gray-300">Cerca</label>
          <input type="text" placeholder="Evento, descrizione..." value={query} onChange={(e) => setQuery(e.target.value)} className="mt-1 w-full bg-gray-900 border border-gray-700 rounded px-2 py-1" />
        </div>
      </div>

      <div>
        {loading ? (
          <div className="text-sm text-gray-400">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-500">Nessuna richiesta trovata</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((it) => (
              <div key={`${it.kind}_${it.id}`} className="bg-gray-800 p-3 rounded border border-gray-700 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm px-2 py-1 rounded-full bg-gray-700 text-gray-200 font-medium">{it.kind.toUpperCase()}</div>
                    <div className="font-medium text-white">{it.title}</div>
                  </div>

                  {it.kind === 'vacation' && (
                    <div className="text-sm text-gray-300 mt-2">
                      {formatDate(it.start_date)}{it.end_date ? ` — ${formatDate(it.end_date)}` : ''} {it.days ? ` • ${it.days} giorno/i` : ''}
                      {it.raw?.motivo ? <div className="mt-1">Motivo: {String(it.raw.motivo)}</div> : null}
                    </div>
                  )}

                  {it.kind === 'expense' && (
                    <div className="text-sm text-gray-300 mt-2">
                      {it.amount !== undefined ? <>€{Number(it.amount).toFixed(2)} • </> : null}
                      {formatDate(it.expense_date)} • {String(it.raw?.description ?? '')}
                    </div>
                  )}

                  {it.kind === 'straordinario' && (
                    <div className="text-sm text-gray-300 mt-2">
                      {formatDate(it.date)} {it.hours ? `• ${it.hours}h` : null}
                      {it.raw?.motivo ? <div className="mt-1">Motivo: {String(it.raw.motivo)}</div> : null}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className={`text-xs px-2 py-1 rounded-full ${it.status === 'approved' ? 'bg-green-100 text-green-800' : it.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {it.status === 'approved' ? 'Approvato' : it.status === 'rejected' ? 'Rifiutato' : it.status ?? 'In attesa'}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">ID: {it.id}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RiepilogoRichieste;