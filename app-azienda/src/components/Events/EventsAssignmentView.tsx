import React, { useState, useEffect } from 'react';
import { Calendar, Users, MapPin, Clock, DollarSign, Info, X, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { supabase } from '../../utils/supabase';

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  address: string;
  call_time: string;
  description: string;
  type: string;
}

interface CrewMember {
  id: string;
  full_name: string;
  email: string;
  tipologia_registrazione: string;
  company_name?: string;
  visibile_in_eventi?: boolean;
}

interface DaySchedule {
  date: string;
  call_time: string;
}

interface CrewBenefit {
  benefit_id: string;
  benefit_nome: string;
  benefit_importo: number;
  benefit_categoria: string;
  enabled: boolean;
}

interface Assignment {
  note_assegnazione: string;
  pausa_pranzo: boolean;
  benefits: CrewBenefit[];
}

const EventsAssignmentView: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedCrew, setSelectedCrew] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [eventTariff, setEventTariff] = useState<number>(0);
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [existingAssignments, setExistingAssignments] = useState<string[]>([]);

  useEffect(() => {
    if (companyProfile?.id) {
      loadData();
    }
  }, [companyProfile]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      const [eventsResult, crewResult] = await Promise.all([
        supabase
          .from('crew_events')
          .select('*')
          .eq('company_id', companyProfile!.id)
          .gte('end_date', today)
          .order('start_date', { ascending: true }),

        supabase
          .from('registration_requests')
          .select(`
            id,
            full_name,
            email,
            tipologia_registrazione,
            company_name
          `)
          .eq('parent_company_id', companyProfile!.id)
          .eq('status', 'approved')
          .in('tipologia_registrazione', ['dipendente', 'freelance'])
          .order('full_name', { ascending: true })
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (crewResult.error) throw crewResult.error;

      const crewData = crewResult.data || [];

      const crewWithRoles = await Promise.all(
        crewData.map(async (crew) => {
          const { data: roleData } = await supabase
            .from('crew_ruoli')
            .select('visibile_in_eventi')
            .eq('dipendente_id', crew.id)
            .eq('azienda_id', companyProfile!.id)
            .eq('attivo', true)
            .maybeSingle();

          return {
            ...crew,
            visibile_in_eventi: roleData?.visibile_in_eventi ?? true
          };
        })
      );

      const filteredCrew = crewWithRoles.filter(crew => crew.visibile_in_eventi);

      setEvents(eventsResult.data || []);
      setCrewMembers(filteredCrew);
    } catch (err: any) {
      console.error('Errore caricamento dati:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateDaySchedules = (startDate: string, endDate: string, defaultCallTime: string) => {
    const schedules: DaySchedule[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      schedules.push({
        date: d.toISOString().split('T')[0],
        call_time: defaultCallTime || '09:00'
      });
    }

    return schedules;
  };

  const handleSelectEvent = async (event: Event) => {
    setSelectedEvent(event);
    setSelectedCrew([]);
    setAssignments(new Map());
    setEventTariff(0);
    setDaySchedules(generateDaySchedules(event.start_date, event.end_date, event.call_time || '09:00'));
    setShowAssignmentForm(false);
    setError(null);
    setSuccess(null);

    try {
      const { data: existingData, error: loadError } = await supabase
        .from('crew_event_assegnazione')
        .select('dipendente_freelance_id')
        .eq('evento_id', event.id);

      if (loadError) {
        console.error('Errore caricamento assegnazioni:', loadError);
        throw loadError;
      }

      const assignedCrewIds = existingData?.map(a => a.dipendente_freelance_id) || [];
      console.log('Assegnazioni esistenti caricate:', assignedCrewIds.length, assignedCrewIds);
      setExistingAssignments(assignedCrewIds);
    } catch (err: any) {
      console.error('Errore caricamento assegnazioni esistenti:', err);
    }
  };

  const handleToggleCrew = async (crewId: string) => {
    if (selectedCrew.includes(crewId)) {
      const newMap = new Map(assignments);
      newMap.delete(crewId);
      setAssignments(newMap);
      setSelectedCrew(prev => prev.filter(id => id !== crewId));
    } else {
      try {
        const [assignmentData, tariffeData, mealData] = await Promise.all([
          supabase
            .from('crew_assegnazionetariffa')
            .select('tariffe_ids, tariffe_personalizzate')
            .eq('dipendente_id', crewId)
            .eq('azienda_id', companyProfile!.id)
            .eq('attivo', true)
            .maybeSingle(),

          supabase
            .from('crew_tariffe')
            .select('id, nome_tariffa, importo, categoria')
            .eq('azienda_id', companyProfile!.id)
            .eq('attivo', true),

          supabase
            .from('employee_meal_benefits')
            .select('*')
            .eq('dipendente_id', crewId)
            .eq('azienda_id', companyProfile!.id)
            .eq('attivo', true)
            .maybeSingle()
        ]);

        const eventBenefitIds = (selectedEvent as any)?.benefits_evento_ids || [];
        const employeeTariffIds = assignmentData.data?.tariffe_ids || [];
        const commonBenefitIds = employeeTariffIds.filter((id: string) =>
          eventBenefitIds.includes(id)
        );

        const tariffePersonalizzate = assignmentData.data?.tariffe_personalizzate || {};
        const benefits: CrewBenefit[] = [];

        for (const tariffId of commonBenefitIds) {
          const tariffa = tariffeData.data?.find((t: any) => t.id === tariffId);
          if (tariffa) {
            const importoPersonalizzato = tariffePersonalizzate[tariffId];
            benefits.push({
              benefit_id: tariffa.id,
              benefit_nome: tariffa.nome_tariffa,
              benefit_importo: importoPersonalizzato !== undefined ? importoPersonalizzato : tariffa.importo,
              benefit_categoria: tariffa.categoria,
              enabled: false
            });
          }
        }

        const newMap = new Map(assignments);
        newMap.set(crewId, {
          pausa_pranzo: true,
          note_assegnazione: '',
          benefits
        });
        setAssignments(newMap);
        setSelectedCrew(prev => [...prev, crewId]);
      } catch (err: any) {
        console.error('Errore caricamento benefits dipendente:', err);
        setError('Errore caricamento benefits dipendente');
      }
    }
  };

  const handleUpdateAssignment = (crewId: string, field: keyof Assignment, value: any) => {
    const newMap = new Map(assignments);
    const current = newMap.get(crewId) || { pausa_pranzo: true, note_assegnazione: '', benefits: [] };
    newMap.set(crewId, { ...current, [field]: value });
    setAssignments(newMap);
  };

  const handleToggleBenefit = (crewId: string, benefitId: string) => {
    const assignment = assignments.get(crewId);
    if (!assignment) return;

    const updatedBenefits = assignment.benefits.map(b =>
      b.benefit_id === benefitId ? { ...b, enabled: !b.enabled } : b
    );

    handleUpdateAssignment(crewId, 'benefits', updatedBenefits);
  };

  const handleUpdateBenefitPrice = (crewId: string, benefitId: string, newPrice: number) => {
    const assignment = assignments.get(crewId);
    if (!assignment) return;

    const updatedBenefits = assignment.benefits.map(b =>
      b.benefit_id === benefitId ? { ...b, benefit_importo: newPrice } : b
    );

    handleUpdateAssignment(crewId, 'benefits', updatedBenefits);
  };

  const handleUpdateDaySchedule = (index: number, field: 'call_time', value: string) => {
    const newSchedules = [...daySchedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    setDaySchedules(newSchedules);
  };

  const handleSaveAssignments = async () => {
    if (!selectedEvent || selectedCrew.length === 0) {
      setError('Seleziona un evento e almeno un membro della crew');
      return;
    }

    const newCrewToAssign = selectedCrew.filter(id => !existingAssignments.includes(id));

    if (newCrewToAssign.length === 0) {
      setError('Nessun nuovo membro da assegnare. Tutti i selezionati sono già assegnati.');
      return;
    }

    if (eventTariff <= 0) {
      setError('Inserisci la tariffa dell\'evento');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyProfile!.id)
        .single();

      for (const crewId of newCrewToAssign) {
        const { data: conflicts } = await supabase
          .from('crew_richiesteferie_permessi')
          .select('id, tipo_richiesta')
          .eq('dipendente_id', crewId)
          .eq('status', 'approved')
          .lte('data_inizio', selectedEvent.end_date)
          .gte('data_fine', selectedEvent.start_date);

        if (conflicts && conflicts.length > 0) {
          const crew = crewMembers.find(c => c.id === crewId)!;
          setError(`${crew.full_name} ha conflitti: ${conflicts.map(c => c.tipo_richiesta).join(', ')}`);
          setSaving(false);
          return;
        }
      }

      const assignmentsToInsert = await Promise.all(newCrewToAssign.map(async (crewId) => {
        const crew = crewMembers.find(c => c.id === crewId)!;
        const assignment = assignments.get(crewId)!;

        const enabledBenefits = assignment.benefits.filter(b => b.enabled);
        const totalBonus = enabledBenefits.reduce((sum, b) => sum + b.benefit_importo, 0);

        const benefitsStoricizzati = enabledBenefits.map(b => ({
          id: b.benefit_id,
          nome: b.benefit_nome,
          importo: b.benefit_importo,
          categoria: b.benefit_categoria
        }));

        const benefitsEventoIds = enabledBenefits.map(b => b.benefit_id);

        const event = selectedEvent as any;
        const hasDiariaEvento = event.diaria_abilitata && event.diaria_tipo === 'evento';
        const hasDiariaTrasferta = event.diaria_abilitata && event.diaria_tipo === 'trasferta';

        if (hasDiariaEvento || hasDiariaTrasferta) {
          const { data: mealData } = await supabase
            .from('employee_meal_benefits')
            .select('*')
            .eq('dipendente_id', crewId)
            .eq('azienda_id', companyProfile!.id)
            .eq('attivo', true)
            .maybeSingle();

          if (mealData) {
            if (hasDiariaEvento && mealData.diaria_eventi_enabled) {
              benefitsStoricizzati.push({
                id: 'diaria_eventi',
                nome: 'Diaria Eventi',
                importo: mealData.diaria_eventi_value,
                categoria: 'diaria'
              });
            }
            if (hasDiariaTrasferta && mealData.diaria_trasferta_enabled) {
              benefitsStoricizzati.push({
                id: 'diaria_trasferta',
                nome: 'Diaria Trasferta',
                importo: mealData.diaria_trasferta_value,
                categoria: 'diaria'
              });
            }
          }
        }

        const giorni: string[] = [];
        const start = new Date(selectedEvent.start_date);
        const end = new Date(selectedEvent.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          giorni.push(d.toISOString().split('T')[0]);
        }

        return {
          azienda_id: companyProfile!.id,
          nome_azienda: companyData?.name || '',
          dipendente_freelance_id: crewId,
          nome_dipendente_freelance: crew.full_name,
          evento_id: selectedEvent.id,
          nome_evento: selectedEvent.title,
          giorno_inizio_evento: selectedEvent.start_date,
          giorno_fine_evento: selectedEvent.end_date,
          evento_localita: selectedEvent.location || '',
          evento_indirizzo: selectedEvent.address || '',
          evento_orario_convocazione: daySchedules.length === 1 ? daySchedules[0].call_time : null,
          evento_descrizione: selectedEvent.description || '',
          tariffa_evento_assegnata: eventTariff,
          bonus_previsti: totalBonus,
          bonus_diaria: hasDiariaEvento,
          bonus_trasferta: hasDiariaTrasferta,
          pausa_pranzo: assignment.pausa_pranzo,
          note_assegnazione: assignment.note_assegnazione || '',
          benefits_evento_ids: benefitsEventoIds,
          benefits_storicizzati: benefitsStoricizzati.length > 0 ? benefitsStoricizzati : null,
          giorni_assegnati: giorni
        };
      }));

      const { error: insertError } = await supabase
        .from('crew_event_assegnazione')
        .insert(assignmentsToInsert);

      if (insertError) throw insertError;

      setSuccess(`${newCrewToAssign.length} nuovi membri della crew assegnati con successo!`);
      setSelectedEvent(null);
      setSelectedCrew([]);
      setAssignments(new Map());
      setEventTariff(0);
      setDaySchedules([]);
      setExistingAssignments([]);
      setShowAssignmentForm(false);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Errore salvataggio assegnazioni:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  const isMultiDay = selectedEvent && selectedEvent.start_date !== selectedEvent.end_date;

  return (
    <div className="space-y-6 p-4 pb-24">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-500 font-medium">Errore</p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-green-500 font-medium">{success}</p>
        </div>
      )}

      {!selectedEvent ? (
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Seleziona un Evento</h2>

          {events.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Nessun evento disponibile</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map(event => (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white text-lg">{event.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      event.type === 'event' ? 'bg-blue-500/20 text-blue-400' :
                      event.type === 'event_travel' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-gray-600/20 text-gray-400'
                    }`}>
                      {event.type === 'event' ? 'Evento' :
                       event.type === 'event_travel' ? 'Trasferta' : 'Altro'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(event.start_date).toLocaleDateString('it-IT')}
                        {event.start_date !== event.end_date && (
                          <> - {new Date(event.end_date).toLocaleDateString('it-IT')}</>
                        )}
                      </span>
                    </div>

                    {event.call_time && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Clock className="h-4 w-4" />
                        <span>Convocazione: {event.call_time}</span>
                      </div>
                    )}

                    {event.location && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Assegna Crew</h2>
            <button
              onClick={() => {
                setSelectedEvent(null);
                setSelectedCrew([]);
                setAssignments(new Map());
                setEventTariff(0);
                setDaySchedules([]);
                setExistingAssignments([]);
              }}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <h3 className="font-semibold text-white mb-3">{selectedEvent.title}</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {new Date(selectedEvent.start_date).toLocaleDateString('it-IT')}
                  {selectedEvent.start_date !== selectedEvent.end_date && (
                    <> - {new Date(selectedEvent.end_date).toLocaleDateString('it-IT')}</>
                  )}
                </span>
              </div>
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <label className="block text-sm font-medium text-white mb-2">
              <DollarSign className="h-4 w-4 inline mr-1" />
              Tariffa Evento (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={eventTariff || ''}
              onChange={(e) => setEventTariff(parseFloat(e.target.value) || 0)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white text-lg"
              placeholder="0.00"
            />
          </div>

          {isMultiDay && (
            <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Orari di Convocazione per Giorno
              </h3>
              <div className="space-y-3">
                {daySchedules.map((schedule, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">
                        {new Date(schedule.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </label>
                      <input
                        type="time"
                        value={schedule.call_time}
                        onChange={(e) => handleUpdateDaySchedule(index, 'call_time', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Seleziona Membri della Crew ({selectedCrew.length} selezionati)
              </h3>
              {existingAssignments.length > 0 && (
                <span className="text-sm text-green-400">
                  {existingAssignments.length} già assegnati
                </span>
              )}
            </div>

            {existingAssignments.length > 0 && (
              <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 mb-4 flex items-start gap-2">
                <Info className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-300 font-medium">
                  {existingAssignments.length} dipendenti già assegnati a questo evento (evidenziati in verde)
                </p>
              </div>
            )}

            {crewMembers.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-6 text-center">
                <p className="text-gray-400">Nessun membro disponibile</p>
              </div>
            ) : (
              <div className="space-y-2">
                {crewMembers.map(crew => {
                  const isAlreadyAssigned = existingAssignments.includes(crew.id);
                  const isSelected = selectedCrew.includes(crew.id);

                  return (
                    <button
                      key={crew.id}
                      onClick={() => !isAlreadyAssigned && handleToggleCrew(crew.id)}
                      disabled={isAlreadyAssigned}
                      className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                        isAlreadyAssigned
                          ? 'bg-green-600/30 border-green-500 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-500/20 border-blue-500/50'
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isAlreadyAssigned
                            ? 'bg-green-500'
                            : isSelected
                            ? 'bg-blue-500'
                            : 'bg-gray-700'
                        }`}>
                          {isAlreadyAssigned || isSelected ? (
                            <CheckCircle className="h-6 w-6 text-white" />
                          ) : (
                            <Users className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className={`font-semibold ${isAlreadyAssigned ? 'text-green-300' : 'text-white'}`}>
                            {crew.full_name}
                          </p>
                          <p className={`text-sm ${isAlreadyAssigned ? 'text-green-400 font-medium' : 'text-gray-400'} capitalize`}>
                            {isAlreadyAssigned ? '✓ Già assegnato' : crew.tipologia_registrazione}
                          </p>
                        </div>
                      </div>
                      {isAlreadyAssigned && (
                        <span className="text-sm text-green-300 font-bold bg-green-500/20 px-3 py-1 rounded-full">
                          ASSEGNATO
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedCrew.length > 0 && (
            <>
              <button
                onClick={() => setShowAssignmentForm(!showAssignmentForm)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium mb-4 flex items-center justify-center gap-2"
              >
                <Info className="h-5 w-5" />
                {showAssignmentForm ? 'Nascondi Dettagli' : 'Configura Benefit e Dettagli'}
              </button>

              {showAssignmentForm && (
                <div className="space-y-4 mb-6">
                  {selectedCrew.map(crewId => {
                    const crew = crewMembers.find(c => c.id === crewId)!;
                    const assignment = assignments.get(crewId)!;
                    const enabledBenefits = assignment.benefits.filter(b => b.enabled);
                    const totalBonus = enabledBenefits.reduce((sum, b) => sum + b.benefit_importo, 0);

                    return (
                      <div key={crewId} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <h4 className="font-medium text-white mb-4 flex items-center justify-between">
                          <span>{crew.full_name}</span>
                          {totalBonus > 0 && (
                            <span className="text-sm text-green-400">
                              +€{totalBonus.toFixed(2)} bonus
                            </span>
                          )}
                        </h4>

                        {assignment.benefits.length > 0 && (
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-white mb-3">
                              Benefit dal Contratto
                            </label>
                            <div className="space-y-2">
                              {assignment.benefits.map(benefit => (
                                <div key={benefit.benefit_id} className="bg-gray-900 rounded-lg p-3">
                                  <div className="flex items-start gap-3">
                                    <input
                                      type="checkbox"
                                      checked={benefit.enabled}
                                      onChange={() => handleToggleBenefit(crewId, benefit.benefit_id)}
                                      className="w-5 h-5 rounded border-gray-700 bg-gray-800 mt-0.5 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex-1 min-w-0">
                                          <p className={`text-sm font-medium ${benefit.enabled ? 'text-white' : 'text-gray-400'}`}>
                                            {benefit.benefit_nome}
                                          </p>
                                          <p className="text-xs text-gray-500 capitalize">{benefit.benefit_categoria.replace(/_/g, ' ')}</p>
                                        </div>
                                      </div>
                                      {benefit.enabled && (
                                        <div className="mt-2">
                                          <label className="block text-xs text-gray-400 mb-1">Importo (€)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={benefit.benefit_importo}
                                            onChange={(e) => handleUpdateBenefitPrice(crewId, benefit.benefit_id, parseFloat(e.target.value) || 0)}
                                            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <label className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={assignment.pausa_pranzo}
                              onChange={(e) => handleUpdateAssignment(crewId, 'pausa_pranzo', e.target.checked)}
                              className="w-5 h-5 rounded border-gray-700 bg-gray-900"
                            />
                            <span className="text-white">Pausa Pranzo</span>
                          </label>

                          <div>
                            <label className="block text-sm text-gray-400 mb-2">Note</label>
                            <textarea
                              value={assignment.note_assegnazione}
                              onChange={(e) => handleUpdateAssignment(crewId, 'note_assegnazione', e.target.value)}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white h-20 resize-none"
                              placeholder="Note aggiuntive..."
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleSaveAssignments}
                disabled={saving || eventTariff <= 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-lg font-medium text-lg flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Salvataggio...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    <span>
                      Conferma Assegnazioni ({selectedCrew.length} selezionati
                      {existingAssignments.length > 0 && `, ${selectedCrew.filter(id => !existingAssignments.includes(id)).length} nuovi`})
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EventsAssignmentView;
