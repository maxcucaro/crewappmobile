import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Upload, Mic, Image as ImageIcon, FileText, Users, AlertCircle, Loader, Trash2, CheckCircle, UserCheck, Square } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useCompanyAuth } from '../../context/CompanyAuthContext';
import { useToastContext } from '../../context/ToastContext';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  full_name: string;
}

interface Event {
  id: string;
  nome_evento: string;
  giorno_inizio_evento: string;
  assigned_count: number;
}

interface WarehouseShift {
  id: string;
  turno_id: string;
  nome_magazzino: string;
  data_turno: string;
  assigned_count: number;
}

interface SelectableEmployee {
  id: string;
  name: string;
  selected: boolean;
}

interface SentMessage {
  id: string;
  recipient_id: string | null;
  recipient_name: string;
  message_type: string;
  message_text: string | null;
  file_name: string | null;
  is_urgent: boolean;
  is_read: boolean;
  created_at: string;
}

export default function CompanyTalk() {
  const { companyProfile } = useCompanyAuth();
  const { showSuccess, showError, showWarning } = useToastContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [warehouseShifts, setWarehouseShifts] = useState<WarehouseShift[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState<'individual' | 'all' | 'event' | 'warehouse' | 'extra'>('individual');
  const [messageType, setMessageType] = useState<'text' | 'audio' | 'image' | 'file'>('text');
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectableEmployees, setSelectableEmployees] = useState<SelectableEmployee[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (companyProfile) {
      loadEmployees();
      loadSentMessages();
    }
  }, [companyProfile]);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (recipientType === 'event' && companyProfile) {
      loadEvents();
    }
  }, [recipientType, companyProfile]);

  useEffect(() => {
    if (recipientType === 'warehouse' && companyProfile) {
      loadWarehouseShifts();
    }
  }, [recipientType, companyProfile]);

  useEffect(() => {
    if (selectedRecipient && (recipientType === 'event' || recipientType === 'warehouse')) {
      loadSelectableEmployees();
    } else if (recipientType === 'extra') {
      loadExtraEmployees();
    } else if (recipientType === 'individual') {
      loadIndividualEmployees();
    } else {
      setSelectableEmployees([]);
    }
  }, [selectedRecipient, recipientType]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('crew_members')
        .select('id, first_name, last_name, email, full_name')
        .eq('company_id', companyProfile?.id)
        .order('full_name', { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      console.error('Errore caricamento dipendenti:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('crew_event_assegnazione')
        .select(`
          evento_id,
          nome_evento,
          giorno_inizio_evento,
          dipendente_freelance_id
        `)
        .eq('azienda_id', companyProfile?.id)
        .lte('giorno_inizio_evento', today)
        .gte('giorno_fine_evento', today);

      if (error) throw error;

      const eventMap = new Map<string, Event>();
      (data || []).forEach((assignment: any) => {
        if (!eventMap.has(assignment.evento_id)) {
          eventMap.set(assignment.evento_id, {
            id: assignment.evento_id,
            nome_evento: assignment.nome_evento,
            giorno_inizio_evento: assignment.giorno_inizio_evento,
            assigned_count: 0
          });
        }
        const event = eventMap.get(assignment.evento_id)!;
        event.assigned_count++;
      });

      setEvents(Array.from(eventMap.values()));
    } catch (error: any) {
      console.error('Errore caricamento eventi:', error);
      setEvents([]);
    }
  };

  const loadWarehouseShifts = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('crew_assegnazione_turni')
        .select('turno_id, nome_magazzino, data_turno, dipendente_id')
        .eq('azienda_id', companyProfile?.id)
        .eq('data_turno', today);

      if (error) throw error;

      const shiftMap = new Map<string, WarehouseShift>();
      (data || []).forEach((assignment: any) => {
        const key = `${assignment.turno_id}|${assignment.data_turno}`;
        if (!shiftMap.has(key)) {
          shiftMap.set(key, {
            id: key,
            turno_id: assignment.turno_id,
            nome_magazzino: assignment.nome_magazzino,
            data_turno: assignment.data_turno,
            assigned_count: 0
          });
        }
        const shift = shiftMap.get(key)!;
        shift.assigned_count++;
      });

      setWarehouseShifts(Array.from(shiftMap.values()));
    } catch (error: any) {
      console.error('Errore caricamento turni:', error);
      setWarehouseShifts([]);
    }
  };

  const loadSelectableEmployees = async () => {
    try {
      let employeeIds: string[] = [];
      let employeeNames: Map<string, string> = new Map();

      if (recipientType === 'event' && selectedRecipient) {
        const { data } = await supabase
          .from('crew_event_assegnazione')
          .select('dipendente_freelance_id, nome_dipendente_freelance')
          .eq('evento_id', selectedRecipient);

        (data || []).forEach((assignment: any) => {
          employeeIds.push(assignment.dipendente_freelance_id);
          employeeNames.set(assignment.dipendente_freelance_id, assignment.nome_dipendente_freelance);
        });
      } else if (recipientType === 'warehouse' && selectedRecipient) {
        const parts = selectedRecipient.split('|');
        const turnoId = parts[0];
        const dataTurno = parts[1];

        const { data } = await supabase
          .from('crew_assegnazione_turni')
          .select('dipendente_id, dipendente_nome')
          .eq('turno_id', turnoId)
          .eq('data_turno', dataTurno);

        (data || []).forEach((assignment: any) => {
          employeeIds.push(assignment.dipendente_id);
          employeeNames.set(assignment.dipendente_id, assignment.dipendente_nome);
        });
      }

      const uniqueIds = [...new Set(employeeIds)];
      const selectable = uniqueIds.map(id => ({
        id,
        name: employeeNames.get(id) || 'Nome non disponibile',
        selected: true
      }));

      setSelectableEmployees(selectable);
    } catch (error: any) {
      console.error('Errore caricamento dipendenti selezionabili:', error);
      setSelectableEmployees([]);
    }
  };

  const loadExtraEmployees = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('extra_shifts_checkins')
        .select(`
          crew_id,
          crew_members!crew_id (
            full_name,
            first_name,
            last_name
          )
        `)
        .eq('date', today);

      const employeeMap = new Map<string, string>();
      (data || []).forEach((checkin: any) => {
        const name = checkin.crew_members?.full_name ||
          `${checkin.crew_members?.first_name || ''} ${checkin.crew_members?.last_name || ''}`.trim() ||
          'Nome non disponibile';
        employeeMap.set(checkin.crew_id, name);
      });

      const selectable = Array.from(employeeMap.entries()).map(([id, name]) => ({
        id,
        name,
        selected: true
      }));

      setSelectableEmployees(selectable);
    } catch (error: any) {
      console.error('Errore caricamento dipendenti extra:', error);
      setSelectableEmployees([]);
    }
  };

  const loadIndividualEmployees = () => {
    const selectable = employees.map(emp => ({
      id: emp.id,
      name: emp.full_name || `${emp.first_name} ${emp.last_name}`,
      selected: false
    }));
    setSelectableEmployees(selectable);
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectableEmployees(prev =>
      prev.map(emp =>
        emp.id === employeeId ? { ...emp, selected: !emp.selected } : emp
      )
    );
  };

  const loadSentMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('company_talks')
        .select('*')
        .eq('sender_company_id', companyProfile?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (!data || data.length === 0) {
        setSentMessages([]);
        return;
      }

      const recipientIds = [...new Set(data.map(msg => msg.recipient_id).filter(Boolean))];

      let recipientNames: Record<string, string> = {};
      if (recipientIds.length > 0) {
        const { data: membersData } = await supabase
          .from('crew_members')
          .select('id, full_name, first_name, last_name')
          .in('id', recipientIds);

        recipientNames = (membersData || []).reduce((acc, member) => {
          acc[member.id] = member.full_name || `${member.first_name} ${member.last_name}`;
          return acc;
        }, {} as Record<string, string>);
      }

      const messages = data.map(msg => ({
        ...msg,
        recipient_name: msg.recipient_id ? (recipientNames[msg.recipient_id] || 'Dipendente') : 'Tutti i dipendenti'
      }));

      setSentMessages(messages);
    } catch (error: any) {
      console.error('Errore caricamento messaggi inviati:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size > 10 * 1024 * 1024) {
          showError('Registrazione troppo lunga! Massimo 10MB');
          setAudioBlob(null);
        } else {
          setAudioBlob(audioBlob);
        }

        stream.getTracks().forEach(track => track.stop());

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      setMessageType('audio');
      setSelectedFile(null);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Errore accesso microfono:', error);
      showError('Impossibile accedere al microfono. Verifica i permessi.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    audioChunksRef.current = [];
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'audio' | 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = type === 'file' ? 20 * 1024 * 1024 : 10 * 1024 * 1024;

    if (file.size > maxSize) {
      showError(`File troppo grande! Massimo ${type === 'file' ? '20' : '10'}MB`);
      return;
    }

    setSelectedFile(file);
    setMessageType(type);
    setAudioBlob(null);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${companyProfile?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-talks')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-talks')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Errore upload file:', error);
      throw error;
    }
  };

  const getRecipientsForSelection = async (): Promise<string[]> => {
    if (recipientType === 'individual') {
      return selectableEmployees.filter(emp => emp.selected).map(emp => emp.id);
    }

    if (recipientType === 'all') {
      return employees.map(e => e.id);
    }

    if (recipientType === 'event' || recipientType === 'warehouse' || recipientType === 'extra') {
      return selectableEmployees.filter(emp => emp.selected).map(emp => emp.id);
    }

    return [];
  };

  const sendMessage = async () => {
    if (!companyProfile) {
      showError('Profilo azienda non trovato');
      return;
    }

    if (messageType === 'text' && !messageText.trim()) {
      showWarning('Inserisci un messaggio');
      return;
    }

    if (messageType === 'audio' && !selectedFile && !audioBlob) {
      showWarning('Registra o seleziona un file audio');
      return;
    }

    if ((messageType === 'image' || messageType === 'file') && !selectedFile) {
      showWarning('Seleziona un file');
      return;
    }

    try {
      setSending(true);

      const recipientIds = await getRecipientsForSelection();

      if (recipientIds.length === 0) {
        showWarning('Nessun destinatario selezionato');
        setSending(false);
        return;
      }

      let fileUrl = null;
      let fileName = null;
      let fileSize = null;

      if (selectedFile) {
        fileUrl = await uploadFile(selectedFile);
        fileName = selectedFile.name;
        fileSize = selectedFile.size;
      } else if (audioBlob && messageType === 'audio') {
        const audioFile = new File(
          [audioBlob],
          `recording_${Date.now()}.${audioBlob.type.includes('webm') ? 'webm' : 'mp4'}`,
          { type: audioBlob.type }
        );
        fileUrl = await uploadFile(audioFile);
        fileName = audioFile.name;
        fileSize = audioFile.size;
      }

      const messages = recipientIds.map(recipientId => ({
        sender_company_id: companyProfile.id,
        recipient_id: recipientId,
        sender_name: companyProfile.ragione_sociale || 'Azienda',
        message_type: messageType,
        message_text: messageType === 'text' ? messageText : null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        is_urgent: isUrgent
      }));

      const { error } = await supabase
        .from('company_talks')
        .insert(messages);

      if (error) {
        console.error('Errore inserimento DB:', error);
        throw error;
      }

      showSuccess(`Messaggio inviato a ${recipientIds.length} ${recipientIds.length === 1 ? 'dipendente' : 'dipendenti'}!`);

      setMessageText('');
      setSelectedFile(null);
      setAudioBlob(null);
      setRecordingTime(0);
      setMessageType('text');
      setIsUrgent(false);
      setSelectedRecipient(null);
      setRecipientType('individual');
      setSelectableEmployees([]);

      loadSentMessages();
    } catch (error: any) {
      console.error('Errore invio messaggio:', error);
      showError(`Errore durante l'invio del messaggio: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('company_talks')
        .delete()
        .eq('id', messageId)
        .eq('sender_company_id', companyProfile?.id);

      if (error) throw error;

      setSentMessages(prev => prev.filter(msg => msg.id !== messageId));
      setConfirmDelete(null);
      showSuccess('Messaggio eliminato');
    } catch (error: any) {
      console.error('Errore eliminazione:', error);
      showError('Errore durante l\'eliminazione');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'audio': return <Mic className="w-4 h-4" />;
      case 'image': return <ImageIcon className="w-4 h-4" />;
      case 'file': return <FileText className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Invia Messaggio ai Dipendenti</h2>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            {showHistory ? 'Nuovo Messaggio' : 'Cronologia'}
          </button>
        </div>
      </div>

      {showHistory ? (
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Messaggi Inviati</h3>
          {sentMessages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nessun messaggio inviato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sentMessages.map((msg) => (
                <div key={msg.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-blue-900/30 rounded-lg text-blue-400">
                        {getMessageTypeIcon(msg.message_type)}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{msg.recipient_name}</p>
                        <p className="text-xs text-gray-400">{formatDate(msg.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.is_urgent && (
                        <span className="flex items-center gap-1 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3" />
                        </span>
                      )}
                      {msg.is_read && (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      )}
                      <button
                        onClick={() => setConfirmDelete(msg.id)}
                        className="p-1 hover:bg-red-900/30 rounded text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {msg.message_type === 'text' && msg.message_text && (
                    <p className="text-sm text-gray-300 line-clamp-2">{msg.message_text}</p>
                  )}
                  {msg.message_type !== 'text' && msg.file_name && (
                    <p className="text-sm text-gray-400">{msg.file_name}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo Destinatari
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                <button
                  onClick={() => { setRecipientType('individual'); setSelectedRecipient('individual'); setSelectableEmployees([]); }}
                  className={`p-2 rounded-lg border-2 text-sm ${
                    recipientType === 'individual'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  Seleziona
                </button>
                <button
                  onClick={() => { setRecipientType('all'); setSelectedRecipient('all'); setSelectableEmployees([]); }}
                  className={`p-2 rounded-lg border-2 text-sm ${
                    recipientType === 'all'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  Tutti
                </button>
                <button
                  onClick={() => { setRecipientType('event'); setSelectedRecipient(null); setSelectableEmployees([]); }}
                  className={`p-2 rounded-lg border-2 text-sm ${
                    recipientType === 'event'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  Evento
                </button>
                <button
                  onClick={() => { setRecipientType('warehouse'); setSelectedRecipient(null); setSelectableEmployees([]); }}
                  className={`p-2 rounded-lg border-2 text-sm ${
                    recipientType === 'warehouse'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  Magazzino
                </button>
                <button
                  onClick={() => { setRecipientType('extra'); setSelectedRecipient('extra'); loadExtraEmployees(); }}
                  className={`p-2 rounded-lg border-2 text-sm ${
                    recipientType === 'extra'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  Extra Oggi
                </button>
              </div>

              {recipientType === 'individual' && selectableEmployees.length === 0 && (
                <div className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
                  <p className="text-sm text-gray-400 text-center">
                    Caricamento dipendenti...
                  </p>
                </div>
              )}

              {recipientType === 'event' && (
                <>
                  <select
                    value={selectedRecipient || ''}
                    onChange={(e) => setSelectedRecipient(e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">
                      {events.length === 0 ? 'Nessun evento oggi' : 'Seleziona evento'}
                    </option>
                    {events.map((evt) => (
                      <option key={evt.id} value={evt.id}>
                        {evt.nome_evento} ({evt.assigned_count} {evt.assigned_count === 1 ? 'dipendente' : 'dipendenti'})
                      </option>
                    ))}
                  </select>
                </>
              )}

              {recipientType === 'warehouse' && (
                <>
                  <select
                    value={selectedRecipient || ''}
                    onChange={(e) => setSelectedRecipient(e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">
                      {warehouseShifts.length === 0 ? 'Nessun turno oggi' : 'Seleziona turno magazzino'}
                    </option>
                    {warehouseShifts.map((shift) => (
                      <option key={shift.id} value={shift.id}>
                        {shift.nome_magazzino} ({shift.assigned_count} {shift.assigned_count === 1 ? 'dipendente' : 'dipendenti'})
                      </option>
                    ))}
                  </select>
                </>
              )}

              {recipientType === 'all' && (
                <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-300">
                    Il messaggio verrà inviato a tutti i {employees.length} dipendenti
                  </p>
                </div>
              )}

              {selectableEmployees.length > 0 && (
                <div className="mt-3 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-white flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      Destinatari ({selectableEmployees.filter(e => e.selected).length}/{selectableEmployees.length})
                    </h4>
                    <button
                      onClick={() => setSelectableEmployees(prev => prev.map(e => ({ ...e, selected: !prev.every(x => x.selected) })))}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {selectableEmployees.every(e => e.selected) ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectableEmployees.map(emp => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={emp.selected}
                          onChange={() => toggleEmployeeSelection(emp.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-300">{emp.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {recipientType === 'extra' && selectableEmployees.length === 0 && (
                <div className="p-3 bg-purple-900/30 border border-purple-700 rounded-lg">
                  <p className="text-sm text-purple-300">
                    Nessun dipendente ha effettuato check-in extra oggi
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo di Messaggio
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    setMessageType('text');
                    setSelectedFile(null);
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    messageType === 'text'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}
                >
                  <MessageSquare className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs">Testo</p>
                </button>

                <button
                  onClick={() => {
                    setMessageType('audio');
                    setSelectedFile(null);
                    if (!isRecording && !audioBlob) {
                      startRecording();
                    }
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    messageType === 'audio' || isRecording
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}
                >
                  <Mic className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs">Vocale</p>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    messageType === 'image'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}
                >
                  <ImageIcon className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs">Immagine</p>
                </button>

                <button
                  onClick={() => {
                    setMessageType('file');
                    fileInputRef.current?.click();
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    messageType === 'file'
                      ? 'border-blue-600 bg-blue-900/30 text-blue-400'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}
                >
                  <FileText className="w-5 h-5 mx-auto mb-1" />
                  <p className="text-xs">File</p>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, 'image')}
                className="hidden"
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                onChange={(e) => handleFileSelect(e, 'audio')}
                className="hidden"
              />
            </div>

            {isRecording ? (
              <div className="p-6 bg-red-900/30 border-2 border-red-600 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                    <p className="text-2xl font-bold text-white">{formatRecordingTime(recordingTime)}</p>
                  </div>
                  <p className="text-sm text-red-200 mb-4">Registrazione in corso...</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={cancelRecording}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Ferma
                    </button>
                  </div>
                </div>
              </div>
            ) : messageType === 'text' ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Messaggio
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Scrivi il tuo messaggio..."
                  rows={6}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500"
                />
              </div>
            ) : messageType === 'audio' && audioBlob ? (
              <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <Mic className="w-8 h-8 text-blue-400" />
                  <div className="flex-1">
                    <p className="font-medium text-white">Messaggio vocale</p>
                    <p className="text-sm text-gray-400">
                      Durata: {formatRecordingTime(recordingTime)} | {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <audio
                      controls
                      src={URL.createObjectURL(audioBlob)}
                      className="w-full mt-2"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setAudioBlob(null);
                      setRecordingTime(0);
                    }}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <X className="w-5 h-5 text-gray-300" />
                  </button>
                </div>
                <button
                  onClick={startRecording}
                  className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Registra di nuovo
                </button>
              </div>
            ) : (
              selectedFile && (
                <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3">
                    {messageType === 'audio' && <Mic className="w-8 h-8 text-blue-400" />}
                    {messageType === 'image' && <ImageIcon className="w-8 h-8 text-blue-400" />}
                    {messageType === 'file' && <FileText className="w-8 h-8 text-blue-400" />}
                    <div>
                      <p className="font-medium text-white">{selectedFile.name}</p>
                      <p className="text-sm text-gray-400">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="ml-auto p-1 hover:bg-gray-700 rounded"
                    >
                      <X className="w-5 h-5 text-gray-300" />
                    </button>
                  </div>
                </div>
              )
            )}

            <div className="flex items-center gap-2 p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
              <input
                type="checkbox"
                id="urgent"
                checked={isUrgent}
                onChange={(e) => setIsUrgent(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="urgent" className="text-sm text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Messaggio urgente (invia notifica push immediata)
              </label>
            </div>

            <button
              onClick={sendMessage}
              disabled={sending || isRecording || (messageType === 'text' ? !messageText.trim() : (messageType === 'audio' ? !audioBlob : !selectedFile)) || (recipientType !== 'all' && selectableEmployees.filter(e => e.selected).length === 0)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Invio in corso...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Invia Messaggio
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Conferma Eliminazione</h3>
            <p className="text-gray-300 mb-6">Sei sicuro di voler eliminare questo messaggio?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => deleteMessage(confirmDelete)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
