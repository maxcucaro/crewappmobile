import React, { useState, useEffect } from 'react';
import {
  Calendar, Users, MapPin, Clock, DollarSign, Plus, X, CheckCircle,
  AlertCircle, Edit, Trash2, Save, FileText, Navigation, ChevronDown,
  ChevronUp, Eye, Settings, Search
} from 'lucide-react';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { supabase } from '../../utils/supabase';

interface EventDayConfig {
  giorno: number;
  nome: string;
  data: string;
  orario_convocazione: string;
  tariffe_abilitate: string[];
  bonus_previsti: number;
}

interface EventTemp {
  id_gruppo_evento: string;
  company_id: string;
  title: string;
  description: string;
  type: string;
  start_date: string;
  end_date: string;
  location: string;
  address: string;
  required_crew: number;
  giorni_config: EventDayConfig[];
  status: string;
  link_scheda_tecnica?: string;
  link_mappa_gps?: string;
  required_crew_per_day?: Record<string, number>;
}

interface Event {
  id: string;
  company_id: string;
  title: string;
  start_date: string;
  end_date: string;
  location: string;
  call_time: string;
  event_group_code?: string;
  is_multi_day_event: boolean;
  day_number?: number;
  day_name?: string;
  benefits_evento_ids?: string[];
  diaria_abilitata: boolean;
  diaria_tipo?: string;
  buoni_pasto_evento: boolean;
  buoni_pasto_valore?: number;
}

interface CrewMember {
  id: string;
  full_name: string;
  email: string;
  tipologia_registrazione: string;
  company_name?: string;
}

interface TariffaBenefit {
  id: string;
  nome: string;
  importo: number;
  categoria: string;
}

interface MealBenefit {
  buoni_pasto_enabled: boolean;
  buoni_pasto_value: number;
  diaria_eventi_enabled: boolean;
  diaria_eventi_value: number;
  diaria_trasferta_enabled: boolean;
  diaria_trasferta_value: number;
}

interface Assignment {
  crew_id: string;
  tariffe_ids: string[];
  tariffe_disponibili: TariffaBenefit[];
  diaria_enabled: boolean;
  diaria_tipo?: string;
  buoni_pasto_enabled: boolean;
  note: string;
  orario_convocazione: string;
  is_existing: boolean;
}

interface CrewMemberStatus {
  crew: CrewMember;
  status: 'assigned' | 'available' | 'unavailable';
  reason?: string;
  assignment?: Assignment;
}

const CompanyEventsManagement: React.FC = () => {
  const { companyProfile } = useCompanyAuth();
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'assign'>('list');
  const [eventsDraft, setEventsDraft] = useState<EventTemp[]>([]);
  const [eventsConfirmed, setEventsConfirmed] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventTemp | Event | null>(null);
  const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
  const [availableTariffs, setAvailableTariffs] = useState<TariffaBenefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'event',
    start_date: '',
    end_date: '',
    location: '',
    address: '',
    required_crew: 1,
    link_scheda_tecnica: '',
    link_mappa_gps: '',
  });

  const [dayConfigs, setDayConfigs] = useState<EventDayConfig[]>([]);
  const [assignments, setAssignments] = useState<Map<string, Assignment>>(new Map());
  const [crewStatuses, setCrewStatuses] = useState<CrewMemberStatus[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConfirmedEvent, setEditingConfirmedEvent] = useState<Event | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    type: 'event',
    start_date: '',
    end_date: '',
    location: '',
    visibility: 'public',
    benefits_evento_ids: [] as string[]
  });

  useEffect(() => {
    if (companyProfile?.id) {
      loadData();
    }
  }, [companyProfile]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [draftsResult, eventsResult, crewResult, tariffsResult] = await Promise.all([
        supabase
          .from('crew_events_temp')
          .select('*')
          .eq('company_id', companyProfile!.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('crew_events')
          .select('*')
          .eq('company_id', companyProfile!.id)
          .gte('end_date', new Date().toISOString().split('T')[0])
          .order('start_date', { ascending: true }),

        supabase
          .from('registration_requests')
          .select('id, full_name, email, tipologia_registrazione, company_name')
          .eq('parent_company_id', companyProfile!.id)
          .eq('status', 'approved')
          .in('tipologia_registrazione', ['dipendente', 'freelance'])
          .order('full_name', { ascending: true }),

        supabase
          .from('crew_tariffe')
          .select('id, nome_tariffa, importo, tipo_calcolo, categoria')
          .eq('azienda_id', companyProfile!.id)
          .eq('attivo', true)
      ]);

      if (draftsResult.error) throw draftsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (crewResult.error) throw crewResult.error;

      const requestsData = crewResult.data || [];

      const crewWithRoles = await Promise.all(
        requestsData.map(async (crew) => {
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

      setEventsDraft(draftsResult.data || []);
      setEventsConfirmed(eventsResult.data || []);
      setCrewMembers(filteredCrew);

      if (!tariffsResult.error && tariffsResult.data) {
        const tariffs: TariffaBenefit[] = tariffsResult.data.map((tariff: any) => ({
          id: tariff.id,
          nome: tariff.nome_tariffa,
          importo: parseFloat(tariff.importo) || 0,
          categoria: tariff.categoria || 'altro'
        }));
        setAvailableTariffs(tariffs);
      }
    } catch (err: any) {
      console.error('Errore caricamento dati:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateDayConfigs = (startDate: string, endDate: string) => {
    const configs: EventDayConfig[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let dayNum = 1;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      configs.push({
        giorno: dayNum,
        nome: dayNum === 1 ? 'Giorno 1' : `Giorno ${dayNum}`,
        data: d.toISOString().split('T')[0],
        orario_convocazione: '09:00',
        tariffe_abilitate: [],
        bonus_previsti: 0
      });
      dayNum++;
    }

    return configs;
  };

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };

      if (newData.start_date && newData.end_date) {
        const configs = generateDayConfigs(newData.start_date, newData.end_date);
        setDayConfigs(configs);
      }

      return newData;
    });
  };

  const updateDayConfig = (index: number, field: keyof EventDayConfig, value: any) => {
    setDayConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toggleTariffaInDay = (dayIndex: number, tariffaId: string) => {
    console.log('Toggle tariffa:', { dayIndex, tariffaId });
    setDayConfigs(prev => {
      const updated = [...prev];
      const tariffe = updated[dayIndex].tariffe_abilitate;

      if (tariffe.includes(tariffaId)) {
        updated[dayIndex].tariffe_abilitate = tariffe.filter(id => id !== tariffaId);
        console.log('Rimossa tariffa:', tariffaId);
      } else {
        updated[dayIndex].tariffe_abilitate = [...tariffe, tariffaId];
        console.log('Aggiunta tariffa:', tariffaId);
      }

      console.log('Tariffe aggiornate per giorno', dayIndex, ':', updated[dayIndex].tariffe_abilitate);
      return updated;
    });
  };

  const handleSaveDraft = async () => {
    try {
      if (!formData.title || !formData.start_date || !formData.end_date) {
        setError('Compila tutti i campi obbligatori');
        return;
      }

      setLoading(true);
      setError(null);

      const eventId = editingDraftId || `evt-${Date.now()}`;

      const draftData = {
        id_gruppo_evento: eventId,
        company_id: companyProfile!.id,
        ...formData,
        giorni_config: dayConfigs,
        status: 'draft',
        required_crew_per_day: dayConfigs.reduce((acc, day) => {
          acc[day.data] = formData.required_crew;
          return acc;
        }, {} as Record<string, number>)
      };

      if (editingDraftId) {
        const { error: updateError } = await supabase
          .from('crew_events_temp')
          .update(draftData)
          .eq('id_gruppo_evento', editingDraftId);

        if (updateError) throw updateError;
        setSuccess('Bozza aggiornata con successo!');
      } else {
        const { error: insertError } = await supabase
          .from('crew_events_temp')
          .insert(draftData);

        if (insertError) throw insertError;
        setSuccess('Bozza salvata con successo!');
      }

      await loadData();
      resetForm();
      setView('list');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Errore salvataggio bozza:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEvent = async (draft: EventTemp) => {
    try {
      setLoading(true);
      setError(null);

      const isMultiDay = draft.giorni_config.length > 1;
      const totalDays = draft.giorni_config.length;
      const eventsToCreate = [];

      for (const dayConfig of draft.giorni_config) {
        const eventData = {
          company_id: draft.company_id,
          title: isMultiDay ? `${draft.title} - ${dayConfig.nome}` : draft.title,
          description: draft.description,
          type: draft.type,
          start_date: dayConfig.data,
          end_date: dayConfig.data,
          location: draft.location,
          address: draft.address,
          call_time: dayConfig.orario_convocazione,
          event_group_code: draft.id_gruppo_evento,
          is_multi_day_event: false,
          parent_event_id: null,
          day_number: 1,
          total_days: 1,
          day_name: dayConfig.nome,
          benefits_evento_ids: dayConfig.tariffe_abilitate.filter(t => t !== 'diaria_eventi' && t !== 'diaria_trasferta'),
          diaria_abilitata: dayConfig.tariffe_abilitate.includes('diaria_eventi') || dayConfig.tariffe_abilitate.includes('diaria_trasferta'),
          diaria_tipo: dayConfig.tariffe_abilitate.includes('diaria_eventi') ? 'evento' :
                      dayConfig.tariffe_abilitate.includes('diaria_trasferta') ? 'trasferta' : null,
          buoni_pasto_evento: false,
          status: 'published',
          is_confirmed: true,
          link_scheda_tecnica: draft.link_scheda_tecnica,
          link_mappa_gps: draft.link_mappa_gps
        };

        eventsToCreate.push(eventData);
      }

      const { error: insertError } = await supabase
        .from('crew_events')
        .insert(eventsToCreate);

      if (insertError) throw insertError;

      const { error: deleteError } = await supabase
        .from('crew_events_temp')
        .delete()
        .eq('id_gruppo_evento', draft.id_gruppo_evento);

      if (deleteError) throw deleteError;

      setSuccess(`Evento confermato! Creati ${eventsToCreate.length} giorni.`);
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Errore conferma evento:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async (eventId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa bozza?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('crew_events_temp')
        .delete()
        .eq('id_gruppo_evento', eventId);

      if (error) throw error;

      setSuccess('Bozza eliminata');
      await loadData();
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditDraft = (draft: EventTemp) => {
    setFormData({
      title: draft.title,
      description: draft.description,
      type: draft.type,
      start_date: draft.start_date,
      end_date: draft.end_date,
      location: draft.location,
      address: draft.address,
      required_crew: draft.required_crew,
      link_scheda_tecnica: draft.link_scheda_tecnica || '',
      link_mappa_gps: draft.link_mappa_gps || ''
    });
    setDayConfigs(draft.giorni_config);
    setEditingDraftId(draft.id_gruppo_evento);
    setView('create');
  };

  const handleDeleteConfirmedEvent = async (groupCode: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo evento? Verranno eliminate anche tutte le assegnazioni crew associate.')) return;

    try {
      setLoading(true);

      const eventsToDelete = eventsConfirmed.filter(e => (e.event_group_code || e.id) === groupCode);
      const eventIds = eventsToDelete.map(e => e.id);

      const { error: deleteAssignmentsError } = await supabase
        .from('crew_event_assegnazione')
        .delete()
        .in('evento_id', eventIds);

      if (deleteAssignmentsError) throw deleteAssignmentsError;

      const { error: deleteEventsError } = await supabase
        .from('crew_events')
        .delete()
        .in('id', eventIds);

      if (deleteEventsError) throw deleteEventsError;

      setSuccess('Evento eliminato con successo!');
      await loadData();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Errore eliminazione evento:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditConfirmedEvent = (groupCode: string) => {
    const events = eventsConfirmed.filter(e => (e.event_group_code || e.id) === groupCode);
    const mainEvent = events[0];

    setEditingConfirmedEvent(mainEvent);
    setEditFormData({
      title: mainEvent.title.split(' - ')[0],
      type: mainEvent.type || 'event',
      start_date: mainEvent.start_date,
      end_date: events.length > 1 ? events[events.length - 1].end_date : mainEvent.end_date,
      location: mainEvent.location || '',
      visibility: mainEvent.visibility || 'public',
      benefits_evento_ids: mainEvent.benefits_evento_ids || []
    });
    setView('edit');
  };

  const handleSaveConfirmedEvent = async () => {
    try {
      if (!editingConfirmedEvent) return;

      setLoading(true);
      setError(null);

      const groupCode = editingConfirmedEvent.event_group_code || editingConfirmedEvent.id;
      const eventsToUpdate = eventsConfirmed.filter(e => (e.event_group_code || e.id) === groupCode);

      for (const event of eventsToUpdate) {
        const updateData: any = {
          type: editFormData.type,
          location: editFormData.location,
          visibility: editFormData.visibility,
          benefits_evento_ids: editFormData.benefits_evento_ids,
          updated_at: new Date().toISOString()
        };

        if (eventsToUpdate.length === 1) {
          updateData.title = editFormData.title;
          updateData.start_date = editFormData.start_date;
          updateData.end_date = editFormData.end_date;
        } else {
          const titleBase = editFormData.title.split(' - ')[0];
          updateData.title = `${titleBase} - ${event.day_name}`;
        }

        const { error: updateError } = await supabase
          .from('crew_events')
          .update(updateData)
          .eq('id', event.id);

        if (updateError) throw updateError;
      }

      setSuccess('Evento aggiornato con successo!');
      await loadData();
      setEditingConfirmedEvent(null);
      setView('list');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Errore aggiornamento evento:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCrewBenefits = async (crewId: string, eventBenefitIds: string[]) => {
    try {
      const [assignmentData, tariffeResult, mealResult] = await Promise.all([
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

      const employeeTariffIds = assignmentData.data?.tariffe_ids || [];
      const commonBenefitIds = employeeTariffIds.filter((id: string) =>
        eventBenefitIds.includes(id)
      );

      const tariffePersonalizzate = assignmentData.data?.tariffe_personalizzate || {};
      const tariffeDisponibili: TariffaBenefit[] = [];

      for (const tariffId of commonBenefitIds) {
        const tariffa = tariffeResult.data?.find((t: any) => t.id === tariffId);
        if (tariffa) {
          const importoPersonalizzato = tariffePersonalizzate[tariffId];
          tariffeDisponibili.push({
            id: tariffa.id,
            nome: tariffa.nome_tariffa,
            importo: importoPersonalizzato !== undefined ? importoPersonalizzato : tariffa.importo,
            categoria: tariffa.categoria
          });
        }
      }

      return {
        tariffe_ids: commonBenefitIds,
        tariffe_disponibili: tariffeDisponibili,
        meal_benefits: mealResult.data as MealBenefit | null
      };
    } catch (err) {
      console.error('Errore caricamento benefits:', err);
      return { tariffe_ids: [], tariffe_disponibili: [], meal_benefits: null };
    }
  };

  const handleSelectCrewForAssignment = async (event: Event) => {
    setSelectedEvent(event);
    setView('assign');

    try {
      setLoading(true);

      const { data: existingAssignments, error } = await supabase
        .from('crew_event_assegnazione')
        .select('*')
        .eq('evento_id', event.id);

      if (error) {
        console.error('Errore caricamento assegnazioni:', error);
        setAssignments(new Map());
        setCrewStatuses([]);
        return;
      }

      const assignmentsMap = new Map<string, Assignment>();
      const statuses: CrewMemberStatus[] = [];

      const assignedCrewIds = new Set(existingAssignments?.map(a => a.dipendente_freelance_id) || []);
      const unassignedCrew = crewMembers.filter(c => !assignedCrewIds.has(c.id));

      const conflictChecks = unassignedCrew.map(crew =>
        supabase
          .from('crew_richiesteferie_permessi')
          .select('id, tipo_richiesta')
          .eq('dipendente_id', crew.id)
          .eq('status', 'approved')
          .lte('data_inizio', event.end_date)
          .gte('data_fine', event.start_date)
          .then(result => ({ crew, conflicts: result.data || [] }))
      );

      const conflictResults = await Promise.all(conflictChecks);

      const benefitLoads = (existingAssignments || []).map(async (existingAssignment) => {
        const crew = crewMembers.find(c => c.id === existingAssignment.dipendente_freelance_id);
        if (!crew) return null;

        let tariffeDisponibili: TariffaBenefit[] = [];

        if (existingAssignment.benefits_storicizzati && Array.isArray(existingAssignment.benefits_storicizzati)) {
          tariffeDisponibili = existingAssignment.benefits_storicizzati;
        } else {
          const eventBenefitIds = event?.benefits_evento_ids || [];
          const benefits = await loadCrewBenefits(crew.id, eventBenefitIds);
          tariffeDisponibili = benefits.tariffe_disponibili;
        }

        const assignment: Assignment = {
          crew_id: crew.id,
          tariffe_ids: existingAssignment.benefits_evento_ids || [],
          tariffe_disponibili: tariffeDisponibili,
          diaria_enabled: existingAssignment.diaria_abilitata || false,
          diaria_tipo: existingAssignment.diaria_tipo || undefined,
          buoni_pasto_enabled: existingAssignment.buoni_pasto_abilitati || false,
          note: existingAssignment.note_assegnazione || '',
          orario_convocazione: existingAssignment.orario_convocazione || event.call_time || '',
          is_existing: true
        };

        return { crew, assignment };
      });

      const assignedResults = await Promise.all(benefitLoads);

      for (const result of assignedResults) {
        if (result) {
          assignmentsMap.set(result.crew.id, result.assignment);
          statuses.push({
            crew: result.crew,
            status: 'assigned',
            assignment: result.assignment
          });
        }
      }

      for (const { crew, conflicts } of conflictResults) {
        if (conflicts.length > 0) {
          statuses.push({
            crew,
            status: 'unavailable',
            reason: conflicts.map(c => c.tipo_richiesta).join(', ')
          });
        } else {
          statuses.push({
            crew,
            status: 'available'
          });
        }
      }

      setAssignments(assignmentsMap);
      setCrewStatuses(statuses);
    } catch (err) {
      console.error('Errore:', err);
      setAssignments(new Map());
      setCrewStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleCrewAssignment = async (crewId: string) => {
    const crewStatus = crewStatuses.find(s => s.crew.id === crewId);
    if (!crewStatus) return;

    if (crewStatus.status === 'unavailable') {
      setError(`${crewStatus.crew.full_name} non è disponibile: ${crewStatus.reason}`);
      return;
    }

    const newAssignments = new Map(assignments);
    const newStatuses = [...crewStatuses];
    const statusIndex = newStatuses.findIndex(s => s.crew.id === crewId);

    if (crewStatus.status === 'assigned') {
      newAssignments.delete(crewId);
      newStatuses[statusIndex] = {
        ...newStatuses[statusIndex],
        status: 'available',
        assignment: undefined
      };
    } else {
      const event = selectedEvent as Event;
      const eventBenefitIds = event?.benefits_evento_ids || [];
      const benefits = await loadCrewBenefits(crewId, eventBenefitIds);

      const assignment: Assignment = {
        crew_id: crewId,
        tariffe_ids: benefits.tariffe_ids,
        tariffe_disponibili: benefits.tariffe_disponibili,
        diaria_enabled: false,
        buoni_pasto_enabled: false,
        note: '',
        orario_convocazione: '',
        is_existing: false
      };

      newAssignments.set(crewId, assignment);
      newStatuses[statusIndex] = {
        ...newStatuses[statusIndex],
        status: 'assigned',
        assignment
      };
    }

    setAssignments(newAssignments);
    setCrewStatuses(newStatuses);
    setError(null);
  };

  const updateAssignment = (crewId: string, field: keyof Assignment, value: any) => {
    const newAssignments = new Map(assignments);
    const current = newAssignments.get(crewId);

    if (current) {
      const updated = { ...current, [field]: value };
      newAssignments.set(crewId, updated);
      setAssignments(newAssignments);

      const newStatuses = crewStatuses.map(status => {
        if (status.crew.id === crewId && status.status === 'assigned') {
          return { ...status, assignment: updated };
        }
        return status;
      });
      setCrewStatuses(newStatuses);
    }
  };

  const updateBenefitPrice = (crewId: string, benefitId: string, newPrice: number) => {
    const newAssignments = new Map(assignments);
    const current = newAssignments.get(crewId);

    if (current) {
      const updatedTariffe = current.tariffe_disponibili.map(tariff =>
        tariff.id === benefitId ? { ...tariff, importo: newPrice } : tariff
      );

      const updated = { ...current, tariffe_disponibili: updatedTariffe };
      newAssignments.set(crewId, updated);
      setAssignments(newAssignments);

      const newStatuses = crewStatuses.map(status => {
        if (status.crew.id === crewId && status.status === 'assigned') {
          return { ...status, assignment: updated };
        }
        return status;
      });
      setCrewStatuses(newStatuses);
    }
  };

  const handleSaveAssignments = async () => {
    try {
      setLoading(true);
      setError(null);

      const event = selectedEvent as Event;
      if (!event) return;

      await supabase
        .from('crew_event_assegnazione')
        .delete()
        .eq('evento_id', event.id);

      if (assignments.size === 0) {
        setSuccess('Assegnazioni aggiornate con successo!');
        setView('list');
        setSelectedEvent(null);
        setCrewStatuses([]);
        setTimeout(() => setSuccess(null), 3000);
        return;
      }

      const assignmentsToInsert = await Promise.all(Array.from(assignments).map(async ([crewId, assignment]) => {
        const crew = crewMembers.find(c => c.id === crewId);
        if (!crew) return null;

        const benefitsStoricizzati = assignment.tariffe_disponibili.map(tariff => ({
          id: tariff.id,
          nome: tariff.nome,
          importo: tariff.importo,
          categoria: tariff.categoria
        }));

        const hasDiariaEvento = event.diaria_abilitata && event.diaria_tipo === 'evento';
        const hasDiariaTrasferta = event.diaria_abilitata && event.diaria_tipo === 'trasferta';

        const giorni: string[] = [];
        const start = new Date(event.start_date);
        const end = new Date(event.end_date);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          giorni.push(d.toISOString().split('T')[0]);
        }

        return {
          azienda_id: companyProfile!.id,
          nome_azienda: companyProfile!.name || '',
          dipendente_freelance_id: crewId,
          nome_dipendente_freelance: crew.full_name,
          evento_id: event.id,
          nome_evento: event.title,
          giorno_inizio_evento: event.start_date,
          giorno_fine_evento: event.end_date,
          evento_localita: event.location,
          evento_orario_convocazione: event.call_time,
          orario_convocazione: assignment.orario_convocazione || null,
          bonus_diaria: hasDiariaEvento,
          bonus_trasferta: hasDiariaTrasferta,
          note_assegnazione: assignment.note,
          benefits_evento_ids: assignment.tariffe_ids,
          benefits_storicizzati: benefitsStoricizzati.length > 0 ? benefitsStoricizzati : null,
          giorni_assegnati: giorni,
          link_scheda_tecnica: event.link_scheda_tecnica,
          link_mappa_gps: event.link_mappa_gps
        };
      }));

      const validAssignments = assignmentsToInsert.filter(a => a !== null);

      const { error: insertError } = await supabase
        .from('crew_event_assegnazione')
        .insert(validAssignments);

      if (insertError) throw insertError;

      setSuccess(`${validAssignments.length} membri assegnati con successo!`);
      setView('list');
      setSelectedEvent(null);
      setAssignments(new Map());
      setCrewStatuses([]);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Errore salvataggio assegnazioni:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'event',
      start_date: '',
      end_date: '',
      location: '',
      address: '',
      required_crew: 1,
      link_scheda_tecnica: '',
      link_mappa_gps: ''
    });
    setDayConfigs([]);
    setEditingDraftId(null);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading && view === 'list') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-6 p-4 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">{editingDraftId ? 'Modifica Evento' : 'Nuovo Evento'}</h2>
          <button onClick={() => { resetForm(); setView('list'); }} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Titolo *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="Nome evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Descrizione</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white h-24 resize-none"
              placeholder="Descrizione evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Tipo</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            >
              <option value="event">Evento</option>
              <option value="event_travel">Trasferta</option>
              <option value="training">Formazione</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Data Inizio *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleDateChange('start_date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Data Fine *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleDateChange('end_date', e.target.value)}
                min={formData.start_date}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Località</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="Città"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Indirizzo</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="Via, numero civico"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Crew Richiesta</label>
            <input
              type="number"
              min="1"
              value={formData.required_crew}
              onChange={(e) => setFormData(prev => ({ ...prev, required_crew: parseInt(e.target.value) || 1 }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <FileText className="h-4 w-4 inline mr-1" />
              Link Scheda Tecnica
            </label>
            <input
              type="url"
              value={formData.link_scheda_tecnica}
              onChange={(e) => setFormData(prev => ({ ...prev, link_scheda_tecnica: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <Navigation className="h-4 w-4 inline mr-1" />
              Link Mappa GPS
            </label>
            <input
              type="url"
              value={formData.link_mappa_gps}
              onChange={(e) => setFormData(prev => ({ ...prev, link_mappa_gps: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="https://maps.google.com/..."
            />
          </div>

          {dayConfigs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">
                Configurazione Giorni ({dayConfigs.length})
              </h3>

              {dayConfigs.map((day, index) => (
                <div key={index} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <button
                    onClick={() => toggleSection(`day-${index}`)}
                    className="w-full flex items-center justify-between mb-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {day.giorno}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-white">{day.nome}</p>
                        <p className="text-sm text-gray-400">
                          {new Date(day.data).toLocaleDateString('it-IT', {
                            weekday: 'long', day: 'numeric', month: 'long'
                          })}
                        </p>
                      </div>
                    </div>
                    {expandedSections[`day-${index}`] ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </button>

                  {expandedSections[`day-${index}`] && (
                    <div className="space-y-4 pt-3 border-t border-gray-700">
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Nome Giorno</label>
                        <input
                          type="text"
                          value={day.nome}
                          onChange={(e) => updateDayConfig(index, 'nome', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">
                          <Clock className="h-4 w-4 inline mr-1" />
                          Orario Convocazione
                        </label>
                        <input
                          type="time"
                          value={day.orario_convocazione}
                          onChange={(e) => updateDayConfig(index, 'orario_convocazione', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Tariffe Abilitate</label>
                        <div className="space-y-2">
                          {availableTariffs.map(tariff => (
                            <label key={tariff.id} className="flex items-start gap-3 bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-800 transition-colors">
                              <input
                                type="checkbox"
                                checked={day.tariffe_abilitate.includes(tariff.id)}
                                onChange={() => toggleTariffaInDay(index, tariff.id)}
                                className="w-5 h-5 rounded border-2 border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer mt-0.5 accent-blue-600"
                              />
                              <div className="flex-1">
                                <p className="text-white text-sm">{tariff.nome}</p>
                                <p className="text-gray-500 text-xs">{tariff.categoria} - €{tariff.importo}</p>
                              </div>
                            </label>
                          ))}

                          <label className="flex items-start gap-3 bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-800 transition-colors">
                            <input
                              type="checkbox"
                              checked={day.tariffe_abilitate.includes('diaria_eventi')}
                              onChange={() => toggleTariffaInDay(index, 'diaria_eventi')}
                              className="w-5 h-5 rounded border-2 border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer mt-0.5 accent-blue-600"
                            />
                            <div className="flex-1">
                              <p className="text-white text-sm">Diaria Eventi</p>
                              <p className="text-gray-500 text-xs">Benefit speciale</p>
                            </div>
                          </label>

                          <label className="flex items-start gap-3 bg-gray-900 rounded-lg p-3 cursor-pointer hover:bg-gray-800 transition-colors">
                            <input
                              type="checkbox"
                              checked={day.tariffe_abilitate.includes('diaria_trasferta')}
                              onChange={() => toggleTariffaInDay(index, 'diaria_trasferta')}
                              className="w-5 h-5 rounded border-2 border-gray-600 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer mt-0.5 accent-blue-600"
                            />
                            <div className="flex-1">
                              <p className="text-white text-sm">Diaria Trasferta</p>
                              <p className="text-gray-500 text-xs">Benefit speciale</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Bonus Previsti (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={day.bonus_previsti}
                          onChange={(e) => updateDayConfig(index, 'bonus_previsti', parseFloat(e.target.value) || 0)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleSaveDraft}
            disabled={loading || !formData.title || !formData.start_date || !formData.end_date}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-medium text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                {editingDraftId ? 'Aggiorna Bozza' : 'Salva Bozza'}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'assign' && selectedEvent) {
    const event = selectedEvent as Event;

    return (
      <div className="space-y-6 p-4 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Assegna Crew</h2>
          <button onClick={() => { setView('list'); setSelectedEvent(null); }} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-2">{event.title}</h3>
          <div className="space-y-1 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date(event.start_date).toLocaleDateString('it-IT')}</span>
            </div>
            {event.call_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Convocazione: {event.call_time}</span>
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Crew ({assignments.size} assegnati)
          </h3>

          {loading && crewStatuses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-gray-400 text-center">Caricamento lista crew in corso...</p>
            </div>
          ) : (
            <div className="space-y-2">
            {crewStatuses.map(({ crew, status, reason, assignment }) => {
              const isAssigned = status === 'assigned';
              const isUnavailable = status === 'unavailable';

              return (
                <div key={crew.id} className="rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleCrewAssignment(crew.id)}
                    disabled={isUnavailable}
                    className={`w-full flex items-center justify-between p-4 transition-colors ${
                      isAssigned
                        ? 'bg-green-700 hover:bg-green-800'
                        : isUnavailable
                        ? 'bg-red-900/30 cursor-not-allowed'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isAssigned ? 'bg-white' : isUnavailable ? 'bg-red-700' : 'bg-gray-700'
                      }`}>
                        {isAssigned ? (
                          <CheckCircle className="h-5 w-5 text-green-700" />
                        ) : isUnavailable ? (
                          <X className="h-5 w-5 text-white" />
                        ) : (
                          <Users className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium text-white">{crew.full_name}</p>
                        <p className={`text-sm ${
                          isAssigned
                            ? 'text-green-200 font-semibold'
                            : isUnavailable
                            ? 'text-red-300'
                            : 'text-gray-400'
                        }`}>
                          {isAssigned && 'ASSEGNATO'}
                          {status === 'available' && 'DISPONIBILE'}
                          {isUnavailable && `NON DISPONIBILE: ${reason}`}
                        </p>
                      </div>
                    </div>
                    {isAssigned && (
                      <Settings className="h-5 w-5 text-white flex-shrink-0" />
                    )}
                  </button>

                  {isAssigned && assignment && (
                    <div className="border-t border-green-600 p-4 space-y-4 bg-green-800">
                      <div>
                        <label className="block text-sm text-green-200 mb-2">
                          <Clock className="h-4 w-4 inline mr-1" />
                          Orario di Convocazione
                        </label>
                        <input
                          type="time"
                          value={assignment.orario_convocazione || ''}
                          onChange={(e) => updateAssignment(crew.id, 'orario_convocazione', e.target.value)}
                          className="w-full bg-green-900 border border-green-700 rounded-lg px-3 py-2 text-white"
                        />
                      </div>

                      {assignment.tariffe_disponibili && assignment.tariffe_disponibili.length > 0 && (
                        <div>
                          <label className="block text-sm text-green-200 mb-2">
                            <DollarSign className="h-4 w-4 inline mr-1" />
                            Benefit Assegnati (Modifica Prezzo)
                          </label>
                          <div className="space-y-2">
                            {assignment.tariffe_disponibili.map(tariff => (
                              <div key={tariff.id} className="bg-green-900 border border-green-700 rounded-lg px-3 py-2">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-white text-sm font-medium">{tariff.nome}</span>
                                  <span className="text-xs text-green-300">{tariff.categoria}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-green-200 text-sm">€</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tariff.importo}
                                    onChange={(e) => {
                                      const value = parseFloat(e.target.value) || 0;
                                      updateBenefitPrice(crew.id, tariff.id, value);
                                    }}
                                    className="flex-1 bg-gray-900 border border-green-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                                    style={{ colorScheme: 'dark' }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm text-green-200 mb-2">Note</label>
                        <textarea
                          value={assignment.note}
                          onChange={(e) => updateAssignment(crew.id, 'note', e.target.value)}
                          className="w-full bg-green-900 border border-green-700 rounded-lg px-3 py-2 text-white h-20 resize-none"
                          placeholder="Note aggiuntive..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {assignments.size > 0 && (
          <>
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                  <span className="text-blue-200 font-medium">Preview Costi Benefit</span>
                </div>
                <span className="text-2xl font-bold text-blue-400">
                  € {Array.from(assignments.values()).reduce((total, assignment) => {
                    return total + assignment.tariffe_disponibili.reduce((sum, tariff) => sum + tariff.importo, 0);
                  }, 0).toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-blue-300 mt-2">
                Totale benefit per {assignments.size} crew member{assignments.size !== 1 ? 's' : ''}
              </p>
            </div>

            <button
              onClick={handleSaveAssignments}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white py-4 rounded-lg font-medium text-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Salvataggio...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Conferma Assegnazioni ({assignments.size})
                </>
              )}
            </button>
          </>
        )}
      </div>
    );
  }

  const filteredConfirmedEvents = eventsConfirmed.filter(event => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchesTitle = event.title.toLowerCase().includes(query);
    const matchesDate = event.start_date.includes(searchQuery) || event.end_date.includes(searchQuery);
    const matchesLocation = event.location?.toLowerCase().includes(query);
    return matchesTitle || matchesDate || matchesLocation;
  });

  const groupedConfirmedEvents = filteredConfirmedEvents.reduce((acc, event) => {
    const key = event.event_group_code || event.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  if (view === 'edit' && editingConfirmedEvent) {
    return (
      <div className="space-y-6 p-4 pb-24">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Modifica Evento</h2>
          <button onClick={() => { setEditingConfirmedEvent(null); setView('list'); }} className="text-gray-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Titolo *</label>
            <input
              type="text"
              value={editFormData.title}
              onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="Nome evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Tipo *</label>
            <select
              value={editFormData.type}
              onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            >
              <option value="event">Evento</option>
              <option value="transfer">Trasferta</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Data Inizio *</label>
              <input
                type="date"
                value={editFormData.start_date}
                onChange={(e) => setEditFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Data Fine *</label>
              <input
                type="date"
                value={editFormData.end_date}
                onChange={(e) => setEditFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Località</label>
            <input
              type="text"
              value={editFormData.location}
              onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              placeholder="Località evento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Visibilità *</label>
            <select
              value={editFormData.visibility}
              onChange={(e) => setEditFormData(prev => ({ ...prev, visibility: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
            >
              <option value="public">Pubblico (Dipendenti e Freelance)</option>
              <option value="private">Privato (Solo Dipendenti)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-3">Benefits Disponibili</label>
            <div className="space-y-2">
              {availableTariffs.map(tariff => {
                const isActive = editFormData.benefits_evento_ids.includes(tariff.id);
                return (
                  <div
                    key={tariff.id}
                    onClick={() => {
                      setEditFormData(prev => ({
                        ...prev,
                        benefits_evento_ids: isActive
                          ? prev.benefits_evento_ids.filter(id => id !== tariff.id)
                          : [...prev.benefits_evento_ids, tariff.id]
                      }));
                    }}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium">{tariff.nome}</p>
                      <p className={`text-sm ${isActive ? 'text-green-100' : 'text-gray-400'}`}>
                        {tariff.importo.toFixed(2)}€
                      </p>
                    </div>
                    <div
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        isActive ? 'bg-green-400' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <button
            onClick={() => { setEditingConfirmedEvent(null); setView('list'); }}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium"
          >
            Annulla
          </button>
          <button
            onClick={handleSaveConfirmedEvent}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Salvataggio...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Salva Modifiche
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Gestione Eventi</h2>
        <button
          onClick={() => setView('create')}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          <span>Nuovo</span>
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca per nome, data o località..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-500 font-medium">Errore</p>
            <p className="text-red-400 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          <p className="text-green-500 font-medium">{success}</p>
        </div>
      )}

      {eventsDraft.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Bozze ({eventsDraft.length})
          </h3>

          <div className="space-y-3">
            {eventsDraft.map(draft => (
              <div key={draft.id_gruppo_evento} className="bg-gray-800 rounded-lg p-4 border border-yellow-500/30">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{draft.title}</h4>
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">
                        BOZZA
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(draft.start_date).toLocaleDateString('it-IT')} - {new Date(draft.end_date).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      {draft.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{draft.location}</span>
                        </div>
                      )}
                      <p className="text-xs text-gray-500">
                        {draft.giorni_config.length} giorn{draft.giorni_config.length === 1 ? 'o' : 'i'} configurati
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditDraft(draft)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleConfirmEvent(draft)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Conferma
                  </button>
                  <button
                    onClick={() => handleDeleteDraft(draft.id_gruppo_evento)}
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Eventi Confermati ({Object.keys(groupedConfirmedEvents).length})
        </h3>

        {Object.keys(groupedConfirmedEvents).length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nessun evento confermato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedConfirmedEvents).map(([groupCode, events]) => {
              const isMultiDay = events.length > 1;
              const mainEvent = events[0];

              return (
                <div key={groupCode} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white mb-1">
                        {isMultiDay ? mainEvent.title.split(' - ')[0] : mainEvent.title}
                      </h4>
                      <div className="space-y-1 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(mainEvent.start_date).toLocaleDateString('it-IT')}
                            {isMultiDay && ` - ${new Date(events[events.length - 1].end_date).toLocaleDateString('it-IT')}`}
                          </span>
                        </div>
                        {mainEvent.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{mainEvent.location}</span>
                          </div>
                        )}
                        {isMultiDay && (
                          <p className="text-xs text-blue-400">
                            {events.length} giorni
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {isMultiDay ? (
                    <div className="space-y-2 mb-3">
                      {events.map(event => (
                        <button
                          key={event.id}
                          onClick={() => handleSelectCrewForAssignment(event)}
                          className="w-full bg-gray-900 hover:bg-gray-850 border border-gray-700 rounded-lg p-3 text-left flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                              {event.day_number}
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{event.day_name}</p>
                              <p className="text-gray-400 text-xs">
                                {new Date(event.start_date).toLocaleDateString('it-IT')} - {event.call_time}
                              </p>
                            </div>
                          </div>
                          <Users className="h-5 w-5 text-gray-400" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSelectCrewForAssignment(mainEvent)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-2"
                    >
                      <Users className="h-4 w-4" />
                      Assegna Crew
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditConfirmedEvent(groupCode)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Modifica
                    </button>
                    <button
                      onClick={() => handleDeleteConfirmedEvent(groupCode)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Elimina
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyEventsManagement;
