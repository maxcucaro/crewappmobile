import React, { useState, useRef } from 'react';
import { Camera, Upload, Plus, DollarSign, FileText, MapPin, X, Check, Utensils, Car, Home, Wrench, Phone, Calendar, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CopyrightFooter } from '../UI/CopyrightFooter';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';
import { useGPSLocation } from '../../hooks/useGPSLocation';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import ExpenseReimbursement from './ExpenseReimbursement';
import RequestsManagement from './RequestsManagement';

interface ExpenseSubmission {
  id?: string;
  eventId: string;
  eventTitle: string;
  warehouseShiftId?: string;
  category: 'vitto' | 'alloggio' | 'trasporto' | 'materiali' | 'comunicazioni' | 'altro';
  amount: number;
  description: string;
  receipt: File | string | null;
  expenseDate: string;
  location?: string;
  notes?: string;
  status?: string;
  eventType?: 'event' | 'warehouse';
  paymentMethod?: 'cash' | 'electronic';
}

interface AvailableEvent {
  id: string;
  title: string;
  date: string | null;
  location: string;
  type: 'event' | 'warehouse';
  checkIn?: string | null;
}

const MobileExpenses: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const { currentLocation, getCurrentLocation } = useGPSLocation();
  const { isOnline, addOfflineData } = useOfflineSync();
  const [expenses, setExpenses] = useState<ExpenseSubmission[]>([]);
  const [availableEvents, setAvailableEvents] = useState<AvailableEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState<ExpenseSubmission>({
    eventId: '',
    eventTitle: '',
    category: 'vitto',
    amount: 0,
    description: '',
    receipt: null,
    expenseDate: new Date().toISOString().split('T')[0],
    location: '',
    paymentMethod: 'electronic'
  });
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (user?.id) {
      getCurrentLocation({ requiredAccuracy: 50, maxRetries: 2 });
      loadAvailableEvents();
      loadExpenses();
    }
  }, [user?.id]);

  // Load events and warehouse checkins that have a check-in (start_time / check_in_time).
  // Avoid nested relations to prevent PGRST200 when schema differs.
  const loadAvailableEvents = async () => {
    setLoading(true);
    try {
      console.log('📅 Caricamento eventi con check-in per note spese...');

      const { data: eventTimesheets, error: eventError } = await supabase
        .from('timesheet_entries')
        .select('id, event_id, start_time, date, event_title, event_location')
        .eq('crew_id', user?.id)
        .not('start_time', 'is', null)
        .order('start_time', { ascending: false })
        .limit(500);

      if (eventError) {
        console.warn('Errore caricamento timesheet_entries:', (eventError as any).message ?? eventError);
      }

      const { data: warehouseCheckins, error: warehouseError } = await supabase
        .from('warehouse_checkins')
        .select('id, shift_id, warehouse_id, check_in_time, date, warehouse_name, warehouse_address, company_name')
        .eq('crew_id', user?.id)
        .not('check_in_time', 'is', null)
        .order('check_in_time', { ascending: false })
        .limit(500);

      if (warehouseError) {
        console.warn('Errore caricamento warehouse_checkins:', (warehouseError as any).message ?? warehouseError);
      }

      const now = Date.now();
      const within48h = (dateStr?: string | null) => {
        if (!dateStr) return false;
        const d = new Date(dateStr).getTime();
        const diff = now - d;
        return diff >= 0 && diff <= 48 * 3600 * 1000;
      };

      const events = (eventTimesheets || []).map((ts: any) => ({
        id: String(ts.event_id ?? ts.id),
        title: ts.event_title ?? 'Evento',
        date: ts.date ?? ts.start_time ?? null,
        location: ts.event_location ?? 'Sede evento',
        type: 'event' as const,
        checkIn: ts.start_time ?? null
      })).filter(e => within48h(e.date));

      const whs = (warehouseCheckins || []).map((w: any) => ({
        id: String(w.shift_id ?? w.warehouse_id ?? w.id),
        title: w.company_name ? `Turno ${w.company_name}` : (w.warehouse_name ? `Turno ${w.warehouse_name}` : 'Turno Magazzino'),
        date: w.date ?? w.check_in_time ?? null,
        location: w.warehouse_address ?? 'Magazzino',
        type: 'warehouse' as const,
        checkIn: w.check_in_time ?? null
      })).filter(e => within48h(e.date));

      const combined = [...events, ...whs].sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      setAvailableEvents(combined);
      console.log('✅ Eventi con check-in disponibili per note spese:', {
        totale: combined.length,
        eventi: events.length,
        turniMagazzino: whs.length,
        ultimi48Ore: combined.length
      });
    } catch (err) {
      console.error('Errore nel caricamento eventi disponibili:', err);
      setAvailableEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadExpenses = async () => {
    try {
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('crew_id', user?.id)
        .order('expense_date', { ascending: false });

      if (expensesError) {
        console.error('Errore nel caricamento spese:', expensesError);
        setExpenses([]);
        return;
      }

      const mappedExpenses: ExpenseSubmission[] = (expensesData || []).map((expense: any) => ({
        id: expense.id,
        eventId: expense.event_id ?? '',
        eventTitle: expense.event_title ?? 'Spesa Generica',
        category: expense.category,
        amount: Number(expense.amount) || 0,
        description: expense.description,
        receipt: expense.receipt_url || null,
        expenseDate: expense.expense_date,
        location: expense.location,
        notes: expense.notes,
        status: expense.status,
        paymentMethod: expense.payment_method ?? 'electronic'
      }));

      setExpenses(mappedExpenses);
      
    } catch (error) {
      console.error('Errore nel caricamento spese:', error);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'vitto': return Utensils;
      case 'alloggio': return Home;
      case 'trasporto': return Car;
      case 'materiali': return Wrench;
      case 'comunicazioni': return Phone;
      default: return FileText;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      vitto: 'Vitto',
      alloggio: 'Alloggio',
      trasporto: 'Trasporto',
      materiali: 'Materiali',
      comunicazioni: 'Comunicazioni',
      altro: 'Altro'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'vitto': return 'from-orange-500 to-red-500';
      case 'alloggio': return 'from-blue-500 to-cyan-500';
      case 'trasporto': return 'from-green-500 to-emerald-500';
      case 'materiali': return 'from-purple-500 to-pink-500';
      case 'comunicazioni': return 'from-yellow-500 to-orange-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          let width = img.width;
          let height = img.height;
          const maxWidth = 1920;
          const maxHeight = 1920;

          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error('Errore compressione immagine'));
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => reject(new Error('Errore caricamento immagine'));
      };
      reader.onerror = () => reject(new Error('Errore lettura file'));
    });
  };

  const handleFileUpload = async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      try {
        const compressedFile = await compressImage(file);
        setFormData({ ...formData, receipt: compressedFile });

        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewImage(e.target?.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (error) {
        console.error('Errore compressione:', error);
        showError('Errore durante la compressione dell\'immagine');
      }
    } else {
      showError('Seleziona un file immagine valido');
    }
  };

  // helper: check 48h window
  const isWithin48Hours = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = now - d;
    return diff >= 0 && diff <= 48 * 3600 * 1000;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // receipt is OPTIONAL per requirement
    if (!formData.description || !formData.description.trim()) {
      showError('Descrizione obbligatoria');
      return;
    }
    if (!formData.amount || formData.amount <= 0) {
      showError('Inserisci un importo valido');
      return;
    }
    if (!formData.eventId && !formData.warehouseShiftId) {
      showError('Seleziona evento o turno valido (entro 48 ore)');
      return;
    }
    const selId = formData.eventId || formData.warehouseShiftId || '';
    const selected = availableEvents.find(a => a.id === selId);
    if (!selected || !isWithin48Hours(selected.date)) {
      showError('Evento/Turno non valido o oltre le 48 ore');
      return;
    }

    try {
      setLoading(true);
      let receiptUrl: string | null = null;

      if (formData.receipt instanceof File) {
        const file = formData.receipt;
        const fileExt = file.name.split('.').pop();
        const fileName = `${user?.id}/expenses/${Date.now()}.${fileExt || 'jpg'}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (uploadErr) {
          console.warn('Errore upload receipt:', uploadErr);
        } else if (uploadData?.path) {
          try {
            const publicResult: any = supabase.storage.from('receipts').getPublicUrl(uploadData.path);
            receiptUrl = publicResult.publicURL || publicResult.data?.publicUrl || null;
          } catch (e) {
            console.warn('Errore ottenimento publicUrl receipt:', e);
          }
        }
      } else if (typeof formData.receipt === 'string') {
        receiptUrl = formData.receipt;
      }

      const payload: any = {
        crew_id: user?.id,
        event_id: formData.eventId || null,
        warehouse_shift_id: formData.warehouseShiftId || null,
        category: formData.category,
        amount: formData.amount,
        description: formData.description,
        receipt_url: receiptUrl,
        expense_date: formData.expenseDate,
        location: currentLocation?.address || formData.location || 'Posizione non disponibile',
        notes: formData.notes || null,
        status: 'pending',
        payment_method: formData.paymentMethod || 'electronic'
      };

      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert(payload)
        .select()
        .single();

      if (isOnline) {
        if (expenseError) {
          console.error('Errore nell\'invio nota spesa:', expenseError);
          addOfflineData('expense', payload);
          showError('Errore invio - Nota spesa salvata offline');
        } else {
          showSuccess('Nota spesa inviata con successo!');
        }
      } else {
        addOfflineData('expense', payload);
        showSuccess('Nota spesa salvata offline - Verrà inviata quando torni online');
      }

      if (isOnline) {
        await loadExpenses();
      }

      setFormData({
        eventId: '',
        eventTitle: '',
        category: 'vitto',
        amount: 0,
        description: '',
        receipt: null,
        expenseDate: new Date().toISOString().split('T')[0],
        location: '',
        paymentMethod: 'electronic'
      });
      setPreviewImage(null);
      setShowForm(false);
    } catch (error) {
      console.error('Errore nell\'invio nota spesa:', error);
      showError('Errore durante l\'invio - Dati salvati offline');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Caricamento note spese...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="p-4 pb-20 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Richieste e Rimborsi</h1>
          <p className="text-gray-300">Gestisci note spese, ferie e straordinari</p>
        </div>

        {/* Current Location */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center space-x-3">
            <MapPin className={`h-5 w-5 ${
              currentLocation 
                ? (currentLocation.accuracy <= 20 ? 'text-green-400' : 'text-yellow-400')
                : 'text-red-400'
            }`} />
            <div>
              <h4 className="font-medium text-white">Posizione Attuale</h4>
              <p className="text-sm text-gray-300">{currentLocation?.address || 'Rilevamento in corso...'}</p>
            </div>
            <button
              onClick={() => getCurrentLocation({ requiredAccuracy: 20, maxRetries: 2 })}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Rimborso Spese Sostenute */}
        {/* Keep ExpenseReimbursement UI but hide its "New" button to avoid duplicates */}
        <ExpenseReimbursement showNewExpenseButton={false} />

        {/* Requests Management - Ferie/Permessi e Straordinari (hide duplicate button if any) */}
        <RequestsManagement showNewExpenseButton={false} />

        {/* Expense summary / New Expense (this is the single authoritative button) */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between">
          <div>
            <h4 className="text-white font-medium">Nota Spese</h4>
            <p className="text-gray-300 text-sm">Invia note spese associate ai tuoi turni o eventi (entro 48 ore).</p>
          </div>
          <div>
            <button
              onClick={() => { setShowForm(true); loadAvailableEvents(); }}
              className="bg-gradient-to-r from-green-600 to-emerald-500 text-white py-2 px-4 rounded-xl font-semibold"
            >
              Nuova Nota Spesa
            </button>
          </div>
        </div>

        {/* Existing expenses list (compact) */}
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-600" />
              <p>Nessuna nota spesa</p>
            </div>
          ) : (
            expenses.map(exp => {
              const Icon = getCategoryIcon(exp.category);
              return (
                <div key={exp.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 bg-gradient-to-br ${getCategoryColor(exp.category)} rounded-lg flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{getCategoryLabel(exp.category)}</h4>
                      <p className="text-sm text-gray-300">{exp.description}</p>
                      <p className="text-xs text-gray-400">{exp.eventTitle}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-lg font-bold text-green-400">€{exp.amount.toFixed(2)}</span>
                        <div className="text-right">
                          <span className="text-xs text-gray-400 block">{new Date(exp.expenseDate).toLocaleDateString('it-IT')}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            exp.status === 'approved' ? 'bg-green-100 text-green-800' :
                            exp.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {exp.status === 'approved' ? 'Approvata' : exp.status === 'rejected' ? 'Rifiutata' : 'In Attesa'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <CopyrightFooter />

        {/* Expense Form Modal (the single modal used by the page) */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 overflow-y-auto">
            <div className="p-4 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Nuova Nota Spesa</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setPreviewImage(null);
                  }}
                  className="bg-gray-700 p-2 rounded-lg"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Event Selection */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Evento o Turno *
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Mostrati solo i turni/eventi con check-in nelle ultime 48 ore</p>
                  <select
                    value={formData.eventId || formData.warehouseShiftId || ''}
                    onChange={(e) => {
                      const selectedEvent = availableEvents.find(ev => ev.id === e.target.value);
                      if (selectedEvent) {
                        const isWarehouse = selectedEvent.type === 'warehouse';
                        setFormData({
                          ...formData,
                          eventId: isWarehouse ? '' : selectedEvent.id,
                          warehouseShiftId: isWarehouse ? selectedEvent.id : undefined,
                          eventTitle: selectedEvent.title,
                          eventType: isWarehouse ? 'warehouse' : 'event'
                        });
                      }
                    }}
                    className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white"
                    required
                  >
                    <option value="">Seleziona evento o turno</option>
                    {availableEvents.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.type === 'warehouse' ? '[MAGAZZINO] ' : '[EVENTO] '}{event.title} - {event.date ? new Date(event.date).toLocaleDateString('it-IT') : '-'} - {event.location}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">Categoria Spesa</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'vitto', label: 'Vitto', icon: Utensils },
                      { value: 'trasporto', label: 'Trasporto', icon: Car },
                      { value: 'alloggio', label: 'Alloggio', icon: Home },
                      { value: 'materiali', label: 'Materiali', icon: Wrench },
                      { value: 'comunicazioni', label: 'Comunicazioni', icon: Phone },
                      { value: 'altro', label: 'Altro', icon: FileText }
                    ].map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat.value as any })}
                          className={`p-4 rounded-xl border text-center transition-all ${
                            formData.category === cat.value
                              ? 'border-blue-500 bg-blue-600 shadow-lg'
                              : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                          }`}
                        >
                          <Icon className="h-6 w-6 mx-auto mb-2" />
                          <span className="text-sm font-medium">{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Importo (€)</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-4 text-white text-xl font-bold text-center"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Descrizione</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white"
                    rows={3}
                    placeholder="Descrivi la spesa..."
                    required
                  />
                </div>

                {/* Receipt Upload */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">Scontrino/Ricevuta (opzionale)</label>
                  
                  {!previewImage ? (
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full bg-blue-600 text-white py-4 px-4 rounded-xl hover:bg-blue-700 flex items-center justify-center space-x-3 font-bold text-lg shadow-lg"
                      >
                        <Camera className="h-6 w-6" />
                        <span>📸 SCATTA FOTO SCONTRINO</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-gray-700 text-white py-3 px-4 rounded-xl hover:bg-gray-600 flex items-center justify-center space-x-2"
                      >
                        <Upload className="h-5 w-5" />
                        <span>Carica da Galleria</span>
                      </button>
                      
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        className="hidden"
                      />
                      
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        className="hidden"
                      />
                      <p className="text-xs text-gray-400 mt-1">Non obbligatorio</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative">
                        <img
                          src={previewImage}
                          alt="Anteprima scontrino"
                          className="w-full h-48 object-cover rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage(null);
                            setFormData({ ...formData, receipt: null });
                          }}
                          className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="bg-green-900 border border-green-700 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <Check className="h-5 w-5 text-green-400" />
                          <span className="text-green-100 font-medium">Scontrino caricato</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="pt-4 space-y-3">
                  {/* Validation Summary */}
                  <div className="bg-gray-700 rounded-lg p-3">
                    <h4 className="text-white font-medium mb-2">Riepilogo</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Categoria:</span>
                        <span className="text-white">{getCategoryLabel(formData.category)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Importo:</span>
                        <span className="text-green-400 font-bold">€{formData.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Data:</span>
                        <span className="text-white">{new Date(formData.expenseDate).toLocaleDateString('it-IT')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Posizione:</span>
                        <span className="text-cyan-400 text-xs">{currentLocation?.address || 'GPS non disponibile'}</span>
                      </div>
                      {formData.eventId && (
                        <div className="flex justify-between">
                          <span className="text-gray-300">Evento:</span>
                          <span className="text-blue-400 text-xs">{formData.eventTitle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-4 px-4 rounded-xl hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed font-bold text-lg shadow-lg flex items-center justify-center space-x-2"
                  >
                    <FileText className="h-6 w-6 inline mr-2" />
                    <span>INVIA NOTA SPESA</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setPreviewImage(null);
                    }}
                    className="w-full bg-gray-700 text-white py-3 px-4 rounded-xl hover:bg-gray-600"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileExpenses;