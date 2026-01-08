import React, { useState, useRef } from 'react';
import { Camera, Upload, Plus, Calendar, DollarSign, FileText, MapPin, Clock, AlertTriangle, CheckCircle, X, Eye, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToastContext } from '../../context/ToastContext';
import { supabase } from '../../lib/db';

interface ExpenseSubmission {
  id?: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  category: 'vitto' | 'alloggio' | 'trasporto' | 'materiali' | 'comunicazioni' | 'altro';
  amount: number;
  description: string;
  receipt: File | string;
  expenseDate: string;
  location?: string;
  notes?: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  companyId: string;
  companyName: string;
  budget?: number;
  expenseLimits?: EventExpenseLimit[];
}

interface EventExpenseLimit {
  category: 'vitto' | 'alloggio' | 'trasporto' | 'materiali' | 'comunicazioni' | 'altro';
  dailyLimit: number;
  eventLimit: number;
  notes?: string;
}

const ExpenseSubmission: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToastContext();
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [submittedExpenses, setSubmittedExpenses] = useState<ExpenseSubmission[]>([]);

  // Carica i dati reali dal database
  React.useEffect(() => {
    const loadExpenseData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        // Prima carica il profilo del dipendente per sapere l'azienda
        const { data: userData, error: userError } = await supabase
          .from('registration_requests')
          .select('*')
          .eq('auth_user_id', user?.id)
          .maybeSingle();

        if (userError) {
          console.error('Errore nel caricamento profilo dipendente:', userError);
          setAvailableEvents([]);
          return;
        }

        if (!userData) {
          console.log('⚠️ Dipendente non trovato');
          setAvailableEvents([]);
          return;
        }

        setUserProfile(userData);

        if (!userData.parent_company_id) {
          console.log('⚠️ Non è un dipendente (no parent_company_id)');
          setAvailableEvents([]);
          return;
        }

        // Carica TUTTI gli eventi dell'azienda (eventi normali)
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select(`
            *,
            regaziendasoftware!company_id(ragione_sociale)
          `)
          .eq('company_id', userData.parent_company_id)
          .in('status', ['published', 'in_progress', 'completed'])
          .order('start_date', { ascending: false });

        // Carica i turni di magazzino assegnati al dipendente
        const { data: warehouseShifts, error: warehouseError } = await supabase
          .from('crew_assegnazione_turni')
          .select('*')
          .eq('dipendente_id', user.id)
          .order('data_turno', { ascending: false });

        if (eventsError) {
          console.error('Errore nel caricamento eventi azienda:', eventsError);
        }

        if (warehouseError) {
          console.error('Errore nel caricamento turni magazzino:', warehouseError);
        }

        // Combina eventi e turni magazzino
        const mappedEvents: Event[] = [];

        // Aggiungi eventi normali
        if (eventsData) {
          eventsData.forEach(event => {
            mappedEvents.push({
              id: event.id,
              title: event.title,
              date: event.start_date,
              location: event.location || 'Sede aziendale',
              companyId: event.company_id,
              companyName: event.regaziendasoftware?.ragione_sociale || 'La Mia Azienda',
              expenseLimits: [
                { category: 'vitto', dailyLimit: 30, eventLimit: 150 },
                { category: 'alloggio', dailyLimit: 100, eventLimit: 300 },
                { category: 'trasporto', dailyLimit: 50, eventLimit: 200 },
                { category: 'materiali', dailyLimit: 50, eventLimit: 250 },
                { category: 'comunicazioni', dailyLimit: 20, eventLimit: 50 },
                { category: 'altro', dailyLimit: 40, eventLimit: 100 }
              ]
            });
          });
        }

        // Aggiungi turni magazzino
        if (warehouseShifts) {
          warehouseShifts.forEach(shift => {
            mappedEvents.push({
              id: `warehouse_${shift.id}`,
              title: `Turno ${shift.nome_magazzino || 'Magazzino'}`,
              date: shift.data_turno,
              location: shift.indirizzo_magazzino || shift.nome_magazzino || 'Magazzino',
              companyId: userData.parent_company_id,
              companyName: shift.nome_azienda || 'La Mia Azienda',
              expenseLimits: [
                { category: 'vitto', dailyLimit: 30, eventLimit: 150 },
                { category: 'alloggio', dailyLimit: 100, eventLimit: 300 },
                { category: 'trasporto', dailyLimit: 50, eventLimit: 200 },
                { category: 'materiali', dailyLimit: 50, eventLimit: 250 },
                { category: 'comunicazioni', dailyLimit: 20, eventLimit: 50 },
                { category: 'altro', dailyLimit: 40, eventLimit: 100 }
              ]
            });
          });
        }

        // Ordina per data decrescente
        mappedEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setAvailableEvents(mappedEvents);
        
        // Carica le spese già inviate
        const { data: expensesData, error: expensesError } = await supabase
          .from('expenses')
          .select(`
            *,
            events!event_id(title, start_date, location)
          `)
          .eq('crew_id', user.id)
          .order('expense_date', { ascending: false });
        
        if (expensesError) {
          console.error('Errore nel caricamento spese:', expensesError);
          setSubmittedExpenses([]);
        } else {
          // Mappa le spese dal database
          const mappedExpenses: ExpenseSubmission[] = (expensesData || []).map(expense => ({
            id: expense.id,
            eventId: expense.event_id,
            eventTitle: expense.crew_events?.title || 'Evento Sconosciuto',
            eventDate: expense.crew_events?.start_date || expense.expense_date,
            category: expense.category,
            amount: expense.amount,
            description: expense.description,
            receipt: expense.receipt_url || '',
            expenseDate: expense.expense_date,
            location: expense.location || expense.crew_events?.location,
            notes: expense.notes
          }));
          
          setSubmittedExpenses(mappedExpenses);
        }
      } catch (error) {
        console.error('Errore nel caricamento dati spese:', error);
        setAvailableEvents([]);
        setSubmittedExpenses([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadExpenseData();
  }, [user?.id]);

  const [currentExpense, setCurrentExpense] = useState<ExpenseSubmission>({
    eventId: '',
    eventTitle: '',
    eventDate: '',
    category: 'vitto',
    amount: 0,
    description: '',
    receipt: '',
    expenseDate: new Date().toISOString().split('T')[0],
    location: ''
  });

  const [showForm, setShowForm] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const getCategoryIcon = (category: string) => {
    const icons = {
      vitto: 'V',
      alloggio: 'A',
      trasporto: 'T',
      materiali: 'M',
      comunicazioni: 'C',
      altro: 'O'
    };
    return icons[category as keyof typeof icons] || 'O';
  };

  const getEventLimit = (eventId: string, category: string): EventExpenseLimit | null => {
    const event = availableEvents.find(e => e.id === eventId);
    if (!event?.expenseLimits) return null;
    return event.expenseLimits.find(l => l.category === category) || null;
  };

  const isWithinTimeLimit = (eventDate: string): boolean => {
    const event = new Date(eventDate);
    const now = new Date();
    const diffHours = (now.getTime() - event.getTime()) / (1000 * 60 * 60);
    return diffHours <= 48;
  };

  const isWithinBudgetLimit = (eventId: string, category: string, amount: number): boolean => {
    const limit = getEventLimit(eventId, category);
    return limit ? amount <= limit.dailyLimit : true;
  };

  const handleEventChange = (eventId: string) => {
    const event = availableEvents.find(e => e.id === eventId);
    if (event) {
      setCurrentExpense({
        ...currentExpense,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        location: event.location
      });
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
                console.log(`Immagine compressa: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
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
        setCurrentExpense({ ...currentExpense, receipt: compressedFile });

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
      showError('Per favore seleziona un file immagine valido');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentExpense.receipt) {
      showError('È obbligatorio caricare lo scontrino');
      return;
    }

    if (!isWithinTimeLimit(currentExpense.eventDate)) {
      if (!confirm('Stai inviando la nota spesa oltre 48 ore dalla data dell\'evento. Vuoi continuare?')) {
        return;
      }
    }

    // Salva nel database
    saveExpenseToDatabase();
  };

  const saveExpenseToDatabase = async () => {
    try {
      if (!user?.id || !currentExpense.eventId) {
        showError('Dati mancanti per il salvataggio');
        return;
      }

      console.log('💾 Salvando nota spesa nel database...');
      console.log('📋 Dati spesa:', {
        crew_id: user.id,
        auth_user_id: user.id,
        event_id: currentExpense.eventId,
        category: currentExpense.category,
        amount: currentExpense.amount,
        description: currentExpense.description,
        expense_date: currentExpense.expenseDate,
        location: currentExpense.location,
        notes: currentExpense.notes
      });

      // Prima verifica se esiste in crew_members
      const { data: crewMemberData, error: crewMemberError } = await supabase
        .from('crew_members')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      
      if (crewMemberError) {
        console.error('❌ Errore verifica crew_member:', crewMemberError);
      }
      
      if (!crewMemberData) {
        console.error('❌ Utente non trovato in crew_members. ID:', user.id);
        showError('Errore: Il tuo profilo non è stato trovato nella tabella crew. Contatta l\'amministratore.');
        return;
      }
      
      console.log('✅ Crew member trovato:', crewMemberData);

      // In un'app reale, qui caricheresti il file su Supabase Storage
      let receiptUrl = '';
      if (currentExpense.receipt instanceof File) {
        // Simula upload file - in produzione useresti Supabase Storage
        receiptUrl = `/expenses/${currentExpense.receipt.name}`;
        console.log('📎 File scontrino simulato:', receiptUrl);
      } else {
        receiptUrl = currentExpense.receipt as string;
      }

      // Inserisci nella tabella expenses
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          crew_id: user.id, // Questo potrebbe causare problemi se user.id non è in crew_members
          event_id: currentExpense.eventId,
          category: currentExpense.category,
          amount: currentExpense.amount,
          description: currentExpense.description,
          receipt_url: receiptUrl,
          expense_date: currentExpense.expenseDate,
          location: currentExpense.location,
          notes: currentExpense.notes,
          status: 'pending',
          is_within_time_limit: withinTimeLimit,
          is_within_budget_limit: withinBudgetLimit
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Errore inserimento nota spesa:', error);
        console.error('❌ Dettagli errore:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('✅ Nota spesa salvata con successo:', data);

      // Aggiorna la lista locale
      const newExpense: ExpenseSubmission = {
        id: data.id,
        eventId: currentExpense.eventId,
        eventTitle: currentExpense.eventTitle,
        eventDate: currentExpense.eventDate,
        category: currentExpense.category,
        amount: currentExpense.amount,
        description: currentExpense.description,
        receipt: receiptUrl,
        expenseDate: currentExpense.expenseDate,
        location: currentExpense.location,
        notes: currentExpense.notes
      };

      setSubmittedExpenses([newExpense, ...submittedExpenses]);
      
      // Reset form
      setCurrentExpense({
        eventId: '',
        eventTitle: '',
        eventDate: '',
        category: 'vitto',
        amount: 0,
        description: '',
        receipt: '',
        expenseDate: new Date().toISOString().split('T')[0],
        location: ''
      });
      setPreviewImage(null);
      setShowForm(false);
      
      showSuccess('Nota Spesa Inviata', 'La nota spesa è stata inviata con successo e sarà revisionata dall\'azienda');

    } catch (error) {
      console.error('❌ Errore nel salvataggio nota spesa:', error);
      showError('Errore Invio', 'Si è verificato un errore durante l\'invio della nota spesa. Riprova.');
    }
  };

  const selectedEvent = availableEvents.find(e => e.id === currentExpense.eventId);
  const currentLimit = getEventLimit(currentExpense.eventId, currentExpense.category);
  const withinTimeLimit = isWithinTimeLimit(currentExpense.eventDate);
  const withinBudgetLimit = isWithinBudgetLimit(currentExpense.eventId, currentExpense.category, currentExpense.amount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Le Mie Note Spese</h1>
          <p className="text-gray-600">Invia le tue note spese per ottenere il rimborso</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuova Nota Spesa</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Note Spese per Dipendenti</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Eventi e Turni:</strong> Puoi inserire note spese per eventi aziendali e turni di magazzino assegnati</li>
              <li>• <strong>Turni magazzino:</strong> I tuoi turni sono inclusi automaticamente nella lista</li>
              <li>• <strong>Tempo limite:</strong> Invia entro 48 ore dalla giornata lavorativa</li>
              <li>• <strong>Scontrino obbligatorio:</strong> Carica sempre la foto dello scontrino</li>
              <li>• <strong>Limiti specifici:</strong> Ogni evento/turno ha limiti diversi impostati dall'azienda</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Available Events with Limits */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Eventi e Turni Disponibili</h3>
        {availableEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessun evento o turno disponibile</p>
            <p className="text-sm mt-1">Non ci sono eventi aziendali o turni magazzino assegnati al momento</p>
          </div>
        ) : (
          <div className="space-y-4">
            {availableEvents.map((event) => {
              const isWarehouse = event.id.toString().startsWith('warehouse_');
              return (
                <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">{event.title}</h4>
                        {isWarehouse && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Building2 className="h-3 w-3 mr-1" />
                            Turno Magazzino
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(event.date).toLocaleDateString('it-IT')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Building2 className="h-4 w-4" />
                          <span>{event.companyName}</span>
                        </div>
                      </div>
                    </div>
                    {event.budget && (
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Budget Totale</div>
                        <div className="text-lg font-bold text-green-600">€{event.budget}</div>
                      </div>
                    )}
                  </div>

                {event.expenseLimits && event.expenseLimits.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Limiti Spese per questo Evento:</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {event.expenseLimits.map((limit) => (
                        <div key={limit.category} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm">{getCategoryIcon(limit.category)}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {getCategoryLabel(limit.category)}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            <div>Max giornaliero: <span className="font-medium text-green-600">€{limit.dailyLimit}</span></div>
                            <div>Max evento: <span className="font-medium text-blue-600">€{limit.eventLimit}</span></div>
                            {limit.notes && (
                              <div className="mt-1 text-gray-500 italic">{limit.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submitted Expenses */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Note Spese Inviate ({submittedExpenses.length})</h3>
        </div>
        
        {submittedExpenses.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Nessuna nota spesa inviata</p>
            <p className="text-sm mt-1">Clicca su "Nuova Nota Spesa" per iniziare</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {submittedExpenses.map((expense) => {
              return (
                <div key={expense.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-lg">{getCategoryIcon(expense.category)}</span>
                        <h4 className="font-medium text-gray-900">{expense.eventTitle}</h4>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          In Attesa
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Evento:</span> {expense.eventTitle}
                        </div>
                        <div>
                          <span className="font-medium">Categoria:</span> {getCategoryLabel(expense.category)}
                        </div>
                        <div>
                          <span className="font-medium">Data spesa:</span> {new Date(expense.expenseDate).toLocaleDateString('it-IT')}
                        </div>
                        <div>
                          <span className="font-medium">Località:</span> {expense.location}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-2">{expense.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">€{expense.amount.toFixed(2)}</div>
                      <div className="text-sm text-gray-500">
                        {new Date(expense.expenseDate).toLocaleDateString('it-IT')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Nuova Nota Spesa</h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setPreviewImage(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Event Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Evento *</label>
                  <select
                    value={currentExpense.eventId}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  >
                    <option value="">Seleziona un evento o turno</option>
                    {availableEvents.map((event) => {
                      const isWarehouse = event.id.toString().startsWith('warehouse_');
                      return (
                        <option key={event.id} value={event.id}>
                          {isWarehouse ? '[MAGAZZINO] ' : '[EVENTO] '}{event.title} - {new Date(event.date).toLocaleDateString('it-IT')} - {event.location}
                        </option>
                      );
                    })}
                  </select>
                  {selectedEvent?.budget && (
                    <p className="text-sm text-gray-600 mt-1">
                      Evento aziendale: {selectedEvent.companyName}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
                    <select
                      value={currentExpense.category}
                      onChange={(e) => setCurrentExpense({ ...currentExpense, category: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      required
                    >
                      <option value="vitto">Vitto</option>
                      <option value="alloggio">Alloggio</option>
                      <option value="trasporto">Trasporto</option>
                      <option value="materiali">Materiali</option>
                      <option value="comunicazioni">Comunicazioni</option>
                      <option value="altro">Altro</option>
                    </select>
                    {currentLimit && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                        <div className="font-medium text-blue-900">Limiti per questo evento:</div>
                        <div className="text-blue-800">
                          Giornaliero: €{currentLimit.dailyLimit} | Evento: €{currentLimit.eventLimit}
                        </div>
                        {currentLimit.notes && (
                          <div className="text-blue-700 italic mt-1">{currentLimit.notes}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Importo (€) *</label>
                    <input
                      type="number"
                      value={currentExpense.amount}
                      onChange={(e) => setCurrentExpense({ ...currentExpense, amount: Number(e.target.value) })}
                      className={`w-full border rounded-md px-3 py-2 ${
                        !withinBudgetLimit ? 'border-red-300 bg-red-50' : 'border-gray-300'
                      }`}
                      min="0"
                      step="0.01"
                      required
                    />
                    {!withinBudgetLimit && currentLimit && (
                      <p className="text-xs text-red-600 mt-1">
                        Importo superiore al limite giornaliero per questo evento (€{currentLimit.dailyLimit})
                      </p>
                    )}
                  </div>
                </div>

                {/* Expense Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data della Spesa *</label>
                  <input
                    type="date"
                    value={currentExpense.expenseDate}
                    onChange={(e) => setCurrentExpense({ ...currentExpense, expenseDate: e.target.value })}
                    className={`w-full border rounded-md px-3 py-2 ${
                      !withinTimeLimit ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                    }`}
                    required
                  />
                  {!withinTimeLimit && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ Oltre 48 ore dalla data dell'evento - potrebbe richiedere approvazione speciale
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione *</label>
                  <textarea
                    value={currentExpense.description}
                    onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={3}
                    placeholder="Descrivi il motivo della spesa..."
                    required
                  />
                </div>

                {/* Receipt Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scontrino/Ricevuta *</label>
                  
                  {!previewImage ? (
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center ${
                        dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 mb-4">Carica la foto dello scontrino</p>
                      
                      <div className="flex justify-center space-x-4">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                        >
                          <Camera className="h-4 w-4" />
                          <span>Scatta Foto</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center space-x-2"
                        >
                          <Upload className="h-4 w-4" />
                          <span>Carica File</span>
                        </button>
                      </div>
                      
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
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="border border-gray-300 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Anteprima Scontrino</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewImage(null);
                            setCurrentExpense({ ...currentExpense, receipt: '' });
                          }}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <img
                        src={previewImage}
                        alt="Anteprima scontrino"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note aggiuntive</label>
                  <textarea
                    value={currentExpense.notes || ''}
                    onChange={(e) => setCurrentExpense({ ...currentExpense, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    rows={2}
                    placeholder="Note aggiuntive (opzionale)..."
                  />
                </div>

                {/* Validation Summary */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Riepilogo Validazione</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center space-x-2">
                      {withinTimeLimit ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                      <span className={withinTimeLimit ? 'text-green-700' : 'text-orange-700'}>
                        {withinTimeLimit ? 'Entro 48 ore' : 'Oltre 48 ore dalla data evento'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {withinBudgetLimit ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={withinBudgetLimit ? 'text-green-700' : 'text-red-700'}>
                        {withinBudgetLimit ? 'Entro i limiti dell\'evento' : 'Oltre i limiti dell\'evento'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {currentExpense.receipt ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                      <span className={currentExpense.receipt ? 'text-green-700' : 'text-red-700'}>
                        {currentExpense.receipt ? 'Scontrino caricato' : 'Scontrino obbligatorio'}
                      </span>
                    </div>

                    {selectedEvent && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="text-xs text-gray-600">
                          <div><strong>Evento:</strong> {selectedEvent.title}</div>
                          <div><strong>Azienda:</strong> {selectedEvent.companyName}</div>
                          {currentLimit && (
                            <div><strong>Limite categoria:</strong> €{currentLimit.dailyLimit}/giorno, €{currentLimit.eventLimit}/evento</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setPreviewImage(null);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Invia Nota Spesa
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Copyright */}
      <div className="text-center text-gray-500 text-xs py-4">
        <p>© 2025 ControlStage - Crew App Mobile V. 1.0.0</p>
        <p>Tutti i diritti riservati - Software realizzato da ControlStage</p>
      </div>
    </div>
  );
};

export default ExpenseSubmission;