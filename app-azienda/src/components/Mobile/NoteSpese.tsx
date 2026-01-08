import React, { useEffect, useState, useRef } from 'react';
import { FileText, Upload, Camera, X } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../utils/supabase';

/**
 * NoteSpese.tsx - versione che usa warehouse_checkins.id (warehouse_checkin_id)
 * - Quando l'utente seleziona un turno di magazzino, invia warehouse_checkin_id = selected.sourceId
 * - Non invia warehouse_shift_id (per evitare vincoli errati verso altre tabelle)
 * - Se viene selezionato un evento, invia event_id come prima
 * - Mantiene la checkbox "Nota non collegata"
 *
 * Modifiche:
 * - loadRecentExpenses ora richiede esplicitamente i campi denormalizzati (event_title, warehouse_name, warehouse_shift_name, company_name)
 * - La lista recent mostra il nome leggibile della nota spesa (event_title o turno•magazzino o magazzino o company) invece degli UUID
 */

type AvailableEvent = {
  sourceId: string;
  refEventId?: string | null;
  refShiftId?: string | null;
  title: string;
  date?: string | null;
  location?: string | null;
  type: 'event' | 'warehouse';
};

const CATEGORY_OPTIONS = [
  { value: 'vitto', label: 'Vitto' },
  { value: 'alloggio', label: 'Alloggio' },
  { value: 'trasporto', label: 'Trasporto' },
  { value: 'materiali', label: 'Materiali' },
  { value: 'comunicazioni', label: 'Comunicazioni' },
  { value: 'altro', label: 'Altro' }
];

const NoteSpese: React.FC = () => {
  const { user } = useCompanyAuth();
  const { showSuccess, showError } = useToastContext();

  const [availableEvents, setAvailableEvents] = useState<AvailableEvent[]>([]);
  const [noEventsFound, setNoEventsFound] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    selectedSourceId: '',
    category: 'vitto',
    amount: '',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'electronic' as 'electronic' | 'cash',
    receiptFile: null as File | null,
    allowStandalone: false // allow creating expense without selecting an event
  });

  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    loadRecentExpenses();
    loadAvailableEvents().catch((e) => {
      console.warn('loadAvailableEvents initial failed', e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadRecentExpenses() {
    if (!user?.id) return;
    try {
      // Request denormalized fields so the client can show human-readable names instead of UUIDs
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          category,
          description,
          amount,
          event_id,
          event_title,
          warehouse_checkin_id,
          warehouse_name,
          warehouse_shift_id,
          warehouse_shift_name,
          company_id,
          company_name,
          expense_date,
          status,
          submitted_at
        `)
        .eq('crew_id', user.id)
        .order('expense_date', { ascending: false })
        .limit(6);

      if (error) {
        console.warn('loadRecentExpenses error', error);
        setRecent([]);
        return;
      }
      setRecent((data as any[]) || []);
    } catch (err) {
      console.error('loadRecentExpenses', err);
      setRecent([]);
    }
  }

  async function loadAvailableEvents() {
    if (!user?.id) {
      setAvailableEvents([]);
      setNoEventsFound(true);
      return [];
    }

    const candidates: string[] = [];
    try {
      const { data: rr } = await supabase
        .from('registration_requests')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (rr && (rr as any).id) candidates.push(String((rr as any).id));
    } catch (e) {
      // ignore
    }
    candidates.push(user.id);

    const combined: AvailableEvent[] = [];

    for (const crewId of Array.from(new Set(candidates))) {
      try {
        const { data: te } = await supabase
          .from('timesheet_entries')
          .select('id, event_id, date, start_time')
          .eq('crew_id', crewId)
          .order('start_time', { ascending: false })
          .limit(500);
        const { data: wh } = await supabase
          .from('warehouse_checkins')
          .select('id, warehouse_id, shift_id, date, check_in_time')
          .eq('crew_id', crewId)
          .order('check_in_time', { ascending: false })
          .limit(500);

        const eventIds = Array.from(new Set(((te as any[]) || []).map((r: any) => r.event_id).filter(Boolean)));
        const warehouseIds = Array.from(new Set(((wh as any[]) || []).map((r: any) => r.warehouse_id).filter(Boolean)));

        const evMap: Record<string, any> = {};
        if (eventIds.length > 0) {
          try {
            const { data: evRows } = await supabase.from('crew_events').select('*').in('id', eventIds);
            (evRows || []).forEach((er: any) => (evMap[String(er.id)] = er));
          } catch (e) {
            /* ignore */
          }
        }

        const whMap: Record<string, any> = {};
        if (warehouseIds.length > 0) {
          try {
            const { data: whRows } = await supabase.from('warehouses').select('*').in('id', warehouseIds);
            (whRows || []).forEach((wr: any) => (whMap[String(wr.id)] = wr));
          } catch (e) {
            /* ignore */
          }
        }

        (te || []).forEach((r: any) => {
          const ev = evMap[String(r.event_id)] || {};
          const title = ev.title ?? ev.name ?? ev.event_title ?? 'Evento';
          combined.push({
            sourceId: String(r.id),
            refEventId: r.event_id ?? null,
            refShiftId: null,
            title,
            date: r.date ?? r.start_time ?? null,
            location: ev.location ?? ev.address ?? null,
            type: 'event' as const
          });
        });

        (wh || []).forEach((r: any) => {
          const wr = whMap[String(r.warehouse_id)] || {};
          const title = wr.title ?? wr.name ?? wr.warehouse_name ?? 'Magazzino';
          combined.push({
            sourceId: String(r.id),        // warehouse_checkins.id
            refEventId: null,
            refShiftId: r.shift_id ?? null,
            title,
            date: r.date ?? r.check_in_time ?? null,
            location: wr.address ?? wr.warehouse_address ?? null,
            type: 'warehouse' as const
          });
        });
      } catch (err) {
        console.warn('partial loadAvailableEvents fail for', crewId, err);
      }
    }

    combined.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });

    setAvailableEvents(combined);
    setNoEventsFound(combined.length === 0);
    return combined;
  }

  function handleFileSelected(file: File | null) {
    setForm({ ...form, receiptFile: file });
    if (!file) {
      setPreviewImage(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPreviewImage(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreviewImage(String(e.target?.result || null));
    reader.readAsDataURL(file);
  }

  async function uploadReceipt(file: File) {
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user?.id}/receipts/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage.from('receipts').upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadErr) {
        console.warn('upload error', uploadErr);
        return null;
      }
      try {
        const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(uploadData.path);
        return (urlData as any)?.publicURL ?? (urlData as any)?.publicUrl ?? null;
      } catch (e) {
        console.warn('getPublicUrl failed', e);
        return null;
      }
    } catch (err) {
      console.error('uploadReceipt', err);
      return null;
    }
  }

  // doInsert handles the actual insertion.
  async function doInsert(selected: AvailableEvent | null, forceStandalone = false) {
    setSending(true);
    try {
      const amount = parseFloat(form.amount);
      let receiptUrl: string | null = null;
      if (form.receiptFile) {
        const uploaded = await uploadReceipt(form.receiptFile);
        if (uploaded) receiptUrl = uploaded;
      }

      let companyId: string | null = null;
      try {
        const { data: cm } = await supabase.from('crew_members').select('company_id').eq('id', user.id).maybeSingle();
        companyId = (cm as any)?.company_id ?? null;
      } catch (e) {
        // ignore
      }

      // If warehouse selected, set warehouse_checkin_id; otherwise set event_id.
      const warehouse_checkin_id = selected && selected.type === 'warehouse' ? selected.sourceId : null;
      const event_id = selected && selected.type === 'event' ? selected.refEventId : null;

      const notes = form.description ?? '';

      const basePayload: any = {
        crew_id: user.id,
        event_id: event_id,
        // do not set warehouse_shift_id (kept null)
        warehouse_shift_id: null,
        // set warehouse_checkin_id when applicable (you added this column)
        warehouse_checkin_id: warehouse_checkin_id,
        expense_date: form.expenseDate,
        category: form.category,
        amount,
        description: form.description,
        notes,
        receipt_url: receiptUrl,
        status: 'pending',
        company_id: companyId
      };

      if (forceStandalone || form.allowStandalone) {
        basePayload.event_id = null;
        basePayload.warehouse_shift_id = null;
        basePayload.warehouse_checkin_id = null;
      }

      console.debug('NoteSpese: inserting expense payload', { selected, basePayload });

      const res = await supabase.from('expenses').insert(basePayload);
      if (res.error) {
        console.error('expenses insert error', res.error);
        showError((res.error as any).message ?? 'Errore invio nota spesa');
        return;
      }

      showSuccess('Nota spesa inviata');
      setShowModal(false);
      setForm({
        selectedSourceId: '',
        category: 'vitto',
        amount: '',
        description: '',
        expenseDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'electronic',
        receiptFile: null,
        allowStandalone: false
      });
      setPreviewImage(null);
      await loadRecentExpenses();
    } catch (err: any) {
      console.error('doInsert error', err);
      showError(err?.message || 'Errore invio nota spesa');
    } finally {
      setSending(false);
    }
  }

  // Main submit handler
  async function handleSubmit() {
    try {
      if (!user?.id) {
        showError('Utente non autenticato');
        return;
      }

      await loadAvailableEvents().catch(() => { /* non fatal */ });

      if (!form.allowStandalone && !form.selectedSourceId) {
        showError('Seleziona un evento o turno oppure abilita "Nota non collegata"');
        return;
      }

      if (!form.description || !form.amount) {
        showError('Compila descrizione e importo');
        return;
      }
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        showError('Inserisci un importo valido');
        return;
      }

      const selected = availableEvents.find((e) => e.sourceId === form.selectedSourceId) ?? null;
      if (form.selectedSourceId && !selected) {
        showError('Evento/turno non valido');
        return;
      }

      await doInsert(selected, false);
    } catch (err: any) {
      console.error('handleSubmit unexpected', err);
      showError(err?.message || 'Errore invio nota spesa');
    }
  }

  const displayTitleFor = (r: any) => {
    const has = (v?: any) => v !== null && v !== undefined && String(v).trim() !== '';
    if (has(r.event_title)) return r.event_title;
    if (has(r.warehouse_shift_name)) {
      return r.warehouse_shift_name + (has(r.warehouse_name) ? ' • ' + r.warehouse_name : '');
    }
    if (has(r.warehouse_name)) return r.warehouse_name;
    if (has(r.company_name)) return r.company_name;
    // fallbacks for older data if denormalized fields are not set
    if (has(r.event_id)) return String(r.event_id);
    if (has(r.warehouse_checkin_id)) return String(r.warehouse_checkin_id);
    return '';
  };

  const formatDate = (d: any) => {
    try {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('it-IT');
    } catch {
      return String(d);
    }
  };

  return (
    <div className="bg-gray-900 p-4 rounded border border-gray-700">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
        <div>
          <h2 className="text-xl font-semibold">Note Spese</h2>
          <p className="text-sm text-gray-400">Invia le tue spese associate a eventi/turni</p>
        </div>
        <div className="w-full sm:w-auto">
          <button
            onClick={() => { setShowModal(true); loadAvailableEvents().catch(()=>{}); }}
            className="w-full sm:w-auto py-3 px-4 rounded bg-green-600 text-white text-sm font-medium"
          >
            <FileText className="inline mr-2" /> Nuova Nota Spesa
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm text-gray-300 mb-2">Note spese recenti</h3>
        {recent.length === 0 ? (
          <div className="text-sm text-gray-500">Nessuna nota spesa recente</div>
        ) : (
          <div className="space-y-3">
            {recent.map((r) => (
              <div key={r.id} className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{r.category}</div>
                  <div className="text-sm text-gray-300 truncate">{r.description}</div>
                  {/* Use denormalized human-readable title instead of raw IDs */}
                  <div className="text-xs text-gray-400 mt-1">
                    {displayTitleFor(r)} • {formatDate(r.expense_date)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-green-400 font-semibold">€{Number(r.amount || 0).toFixed(2)}</div>
                  <div className={`text-xs mt-1 ${r.status === 'approved' ? 'text-green-300' : r.status === 'rejected' ? 'text-red-300' : 'text-yellow-300'}`}>
                    {r.status === 'approved' ? 'Approvata' : r.status === 'rejected' ? 'Rifiutata' : 'In attesa'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full h-full sm:h-auto max-w-full sm:max-w-lg bg-gray-900 rounded-none sm:rounded p-4 sm:p-6 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Nuova Nota Spesa</h3>
              <button onClick={() => { setShowModal(false); setPreviewImage(null); }} className="text-gray-400">
                <X />
              </button>
            </div>

            {noEventsFound && (
              <div className="mb-3 p-2 rounded bg-yellow-900/20 border border-yellow-700 text-yellow-200 text-sm">
                Nessun evento/turno trovato per il tuo account. Puoi comunque compilare la nota spesa abilitando "Nota non collegata".
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-300">Turno / Evento</label>
                <select
                  value={form.selectedSourceId}
                  onChange={(e) => setForm({ ...form, selectedSourceId: e.target.value })}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="">{availableEvents.length === 0 ? 'Nessun evento disponibile' : 'Seleziona evento/turno'}</option>
                  {availableEvents.map((a) => (
                    <option key={a.sourceId} value={a.sourceId}>
                      {a.type === 'warehouse' ? '[MAG] ' : '[EV] '}{a.title} — {a.date ? new Date(a.date).toLocaleDateString('it-IT') : '-'}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="standalone"
                    type="checkbox"
                    checked={form.allowStandalone}
                    onChange={(e) => setForm({ ...form, allowStandalone: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <label htmlFor="standalone" className="text-sm text-gray-300">Nota non collegata (crea nota senza evento)</label>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300">Categoria</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                  {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-300">Importo (€)</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-gray-300">Data Spesa</label>
                <input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
              </div>

              <div className="sm:col-span-2">
                <label className="text-sm text-gray-300">Descrizione</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="text-sm text-gray-300">Metodo di pagamento</label>
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as 'electronic' | 'cash' })} className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
                  <option value="electronic">Pagamento Elettronico</option>
                  <option value="cash">Contanti</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-300">Scontrino (opzionale)</label>
                <div className="mt-1 flex gap-2">
                  <button type="button" onClick={() => cameraRef.current?.click()} className="flex-1 bg-gray-800 border border-gray-700 rounded py-2 text-gray-200 text-sm">
                    <Camera className="inline mr-2" /> Scatta
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 bg-gray-800 border border-gray-700 rounded py-2 text-gray-200 text-sm">
                    <Upload className="inline mr-2" /> Carica
                  </button>
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)} className="hidden" />
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)} className="hidden" />
                </div>
              </div>

              {previewImage && (
                <div className="sm:col-span-2">
                  <img src={previewImage} alt="Anteprima" className="w-full h-40 object-cover rounded" />
                  <div className="mt-2 text-right"><button onClick={() => handleFileSelected(null)} className="text-sm text-red-400">Rimuovi immagine</button></div>
                </div>
              )}

              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3 mt-3">
                <button onClick={handleSubmit} disabled={sending} className="w-full sm:w-auto flex-1 py-3 rounded bg-green-600 text-white text-sm">
                  {sending ? 'Invio...' : 'Invia Nota Spesa'}
                </button>
                <button onClick={() => setShowModal(false)} className="w-full sm:w-auto px-4 py-3 rounded border border-gray-700 text-sm">Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteSpese;