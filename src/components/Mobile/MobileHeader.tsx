import React from 'react';
import { Smartphone, LogOut, Upload, RefreshCw, Download, Bell, X, Clock, MapPin, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { useToastContext } from '../../context/ToastContext';
import VersionIndicator from '../UI/VersionIndicator';
import { supabase } from '../../lib/db';
import CompanyTalk from './CompanyTalk';

interface NotificationsDropdownProps {
  userId: string;
  onClose: () => void;
  onOpenCompanyTalk: (talkId: string) => void;
}

/**
 * NotificationsDropdown (robust)
 * - prima tenta la join corso:corso_id(...) (se il relation è configurato)
 * - se il join non restituisce i dati del corso, fa fallback: recupera le assegnazioni
 *   e poi batch-fetch dei corsi dalla tabella `corsi` per popolare i dettagli.
 * Questo aumenta la probabilità che tu veda correttamente le notifiche anche se
 * il nome della relation o la configurazione DB è differente.
 */
const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({ userId, onClose, onOpenCompanyTalk }) => {
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loadingNotifiche, setLoadingNotifiche] = React.useState<boolean>(true);

  const [pendingCourses, setPendingCourses] = React.useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = React.useState<boolean>(true);

  const [companyTalks, setCompanyTalks] = React.useState<any[]>([]);
  const [loadingTalks, setLoadingTalks] = React.useState<boolean>(true);

  const { showSuccess, showError } = useToastContext();

  // Modal state
  const [activeAssignment, setActiveAssignment] = React.useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Load notifiche (original behavior)
  React.useEffect(() => {
    const loadNotifications = async () => {
      setLoadingNotifiche(true);
      try {
        const { data, error } = await supabase
          .from('notifiche')
          .select('*')
          .eq('id_utente', userId)
          .neq('stato', 'eliminata')
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data) {
          setNotifications(data);
        } else if (error) {
          console.error('Errore caricamento notifiche:', error);
        }
      } catch (e) {
        console.error('Eccezione loadNotifications:', e);
      } finally {
        setLoadingNotifiche(false);
      }
    };

    if (userId) loadNotifications();
  }, [userId]);

  // Load company talks
  React.useEffect(() => {
    const loadCompanyTalks = async () => {
      setLoadingTalks(true);
      try {
        const { data, error } = await supabase
          .from('company_talks')
          .select(`
            *,
            regaziendasoftware!sender_company_id (
              ragione_sociale
            )
          `)
          .eq('recipient_id', userId)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!error && data) {
          const talksWithCompany = data.map(talk => ({
            ...talk,
            company_name: talk.regaziendasoftware?.ragione_sociale || 'Azienda'
          }));
          setCompanyTalks(talksWithCompany);
        } else if (error) {
          console.error('Errore caricamento messaggi azienda:', error);
        }
      } catch (e) {
        console.error('Eccezione loadCompanyTalks:', e);
      } finally {
        setLoadingTalks(false);
      }
    };

    if (userId) loadCompanyTalks();
  }, [userId]);

  // Robust load pending courses: try join, otherwise batch-fetch corso rows
  const loadPendingCourses = React.useCallback(async () => {
    setLoadingCourses(true);
    try {
      // 1) Try to get assignments with join (works when relation is configured)
      const { data: joinedData, error: joinError } = await supabase
        .from('crew_assegnazionecorsi')
        .select(`
          *,
          corso:corso_id(
            id,
            titolo,
            titolo_corso,
            descrizione,
            note,
            luogo,
            ora_inizio,
            ora_fine,
            istruttore,
            istruttore_nome,
            categoria,
            obbligatorio
          )
        `)
        .eq('persona_id', userId)
        .eq('stato_invito', 'invitato')
        .order('data_invito', { ascending: false });

      if (!joinError && joinedData && joinedData.length > 0) {
        // Normalize and set
        const normalized = joinedData.map((r: any) => {
          const corso = r.corso || {};
          const courseTitle =
            r.titolo_corso ||
            r.corso_titolo ||
            corso.titolo ||
            corso.titolo_corso ||
            corso.nome ||
            `Corso ${r.corso_id || r.id || ''}`;
          return { ...r, course: corso, courseTitle };
        });
        setPendingCourses(normalized);
        setLoadingCourses(false);
        return;
      }

      // If join returned empty or error, fallback to fetching assignments only
      const { data: assignments, error: assignmentsError } = await supabase
        .from('crew_assegnazionecorsi')
        .select('*')
        .eq('persona_id', userId)
        .eq('stato_invito', 'invitato')
        .order('data_invito', { ascending: false });

      if (assignmentsError) {
        console.error('Errore fetch assignments fallback:', assignmentsError);
        setPendingCourses([]);
        setLoadingCourses(false);
        return;
      }

      if (!assignments || assignments.length === 0) {
        // no pending assignments
        setPendingCourses([]);
        setLoadingCourses(false);
        return;
      }

      // collect corso_ids from assignments
      const corsoIds = Array.from(new Set(assignments.map((a: any) => a.corso_id).filter(Boolean)));
      let corsoMap: Record<string, any> = {};

      if (corsoIds.length > 0) {
        // batch fetch corso rows from 'corsi' table (adjust table name if different)
        const { data: corsiData, error: corsiError } = await supabase
          .from('corsi')
          .select('id, titolo, titolo_corso, descrizione, note, luogo, ora_inizio, ora_fine, istruttore, istruttore_nome, categoria, obbligatorio')
          .in('id', corsoIds);

        if (corsiError) {
          // If we can't fetch corso rows, we still show assignments with minimal info
          console.error('Errore fetch corsi fallback:', corsiError);
          corsoMap = {};
        } else {
          corsoMap = (corsiData || []).reduce((acc: any, cur: any) => {
            acc[cur.id] = cur;
            return acc;
          }, {});
        }
      }

      // Map assignments to include course object (if available)
      const mapped = assignments.map((a: any) => {
        const corso = (a.corso) || (a.corso_id ? corsoMap[a.corso_id] : null) || {};
        const courseTitle =
          a.titolo_corso ||
          a.corso_titolo ||
          corso.titolo ||
          corso.titolo_corso ||
          corso.nome ||
          `Corso ${a.corso_id || a.id || ''}`;

        return {
          ...a,
          course: corso,
          courseTitle
        };
      });

      setPendingCourses(mapped);
    } catch (e) {
      console.error('Eccezione loadPendingCourses (robust):', e);
      setPendingCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, [userId]);

  React.useEffect(() => {
    if (!userId) {
      setPendingCourses([]);
      setLoadingCourses(false);
      return;
    }
    loadPendingCourses();

    // subscribe to changes to keep list updated
    const channel = supabase
      .channel(`course-notifs-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crew_assegnazionecorsi',
          filter: `persona_id=eq.${userId}`
        },
        () => {
          loadPendingCourses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadPendingCourses]);

  // Confirm / Cancel participation (same as calendar)
  const confirmParticipation = async (assignmentId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('crew_assegnazionecorsi')
        .update({ stato_invito: 'confermato', data_conferma: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) {
        console.error('Errore confirmParticipation:', error);
        showError && showError('Errore durante la conferma: ' + (error.message || 'Riprova'));
        setIsSubmitting(false);
        return;
      }

      showSuccess && showSuccess('Partecipazione confermata');
      setActiveAssignment(null);
      await loadPendingCourses();
    } catch (e: any) {
      console.error('Eccezione confirmParticipation:', e);
      showError && showError(e?.message || 'Errore durante la conferma');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelParticipation = async (assignmentId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('crew_assegnazionecorsi')
        .update({ stato_invito: 'rifiutato' })
        .eq('id', assignmentId);

      if (error) {
        console.error('Errore cancelParticipation:', error);
        showError && showError('Errore durante l\'annullamento: ' + (error.message || 'Riprova'));
        setIsSubmitting(false);
        return;
      }

      showSuccess && showSuccess('Partecipazione annullata');
      setActiveAssignment(null);
      await loadPendingCourses();
    } catch (e: any) {
      console.error('Eccezione cancelParticipation:', e);
      showError && showError(e?.message || 'Errore durante l\'operazione');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Utility formatters
  const formatLongDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('it-IT');
    } catch {
      return dateString;
    }
  };

  return (
    <>
      {/* Overlay per mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={onClose}
      />

      <div className="fixed top-20 left-2 right-2 sm:absolute sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-96 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 z-50">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Notifiche</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {/* COMPANY TALKS */}
        {loadingTalks ? (
          <div className="p-8 text-center text-gray-400">Caricamento messaggi...</div>
        ) : companyTalks && companyTalks.length > 0 ? (
          <div className="divide-y divide-gray-700">
            <div className="px-4 py-2 bg-cyan-900/20 border-b border-gray-700 flex items-center justify-between">
              <h4 className="text-sm font-medium text-cyan-300">Messaggi Azienda ({companyTalks.length})</h4>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  setTimeout(() => {
                    setShowCompanyTalk(true);
                    setSelectedTalkId(null);
                  }, 100);
                }}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline"
              >
                Vedi tutti
              </button>
            </div>

            {companyTalks.map((talk: any) => (
              <div key={talk.id} className="p-4 hover:bg-gray-750 transition-colors">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white">{talk.company_name || talk.sender_name}</h4>
                      {talk.is_urgent && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-600 text-white rounded">
                          Urgente
                        </span>
                      )}
                    </div>
                    {talk.message_type === 'text' && talk.message_text && (
                      <p className="text-sm text-gray-300 line-clamp-2 mt-1">{talk.message_text}</p>
                    )}
                    {talk.message_type === 'audio' && (
                      <p className="text-sm text-gray-400 mt-1">🎤 Messaggio vocale</p>
                    )}
                    {talk.message_type === 'image' && (
                      <p className="text-sm text-gray-400 mt-1">🖼️ Immagine</p>
                    )}
                    {talk.message_type === 'file' && (
                      <p className="text-sm text-gray-400 mt-1">📄 {talk.file_name || 'File allegato'}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(talk.created_at).toLocaleString('it-IT')}</span>
                    </div>
                  </div>

                  <div className="ml-2 flex flex-col items-end space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        setTimeout(() => {
                          onOpenCompanyTalk(talk.id);
                        }, 100);
                      }}
                      className="bg-cyan-600 text-white px-3 py-1 rounded text-xs hover:bg-cyan-700"
                    >
                      Leggi
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* COURSES */}
        {loadingCourses ? (
          <div className="p-8 text-center text-gray-400">Caricamento corsi...</div>
        ) : pendingCourses && pendingCourses.length > 0 ? (
          <div className="divide-y divide-gray-700">
            <div className="px-4 py-2 bg-yellow-900/20 border-b border-gray-700">
              <h4 className="text-sm font-medium text-yellow-300">Corsi da confermare ({pendingCourses.length})</h4>
            </div>

            {pendingCourses.map((a: any) => {
              const corso = a.course || {};
              const title = a.courseTitle || corso.titolo || corso.titolo_corso || 'Corso';
              const dateText = a.data_partecipazione || a.data_invito || corso.data || '';
              const timeText = a.ora_inizio || corso.ora_inizio || '';
              const luogo = a.luogo || corso.luogo || '';
              return (
                <div key={a.id} className="p-4 hover:bg-gray-750 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{title}</h4>
                      {dateText && <p className="text-sm text-gray-300 mt-1">{formatDate(dateText)}</p>}
                      {timeText && <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400"><Clock className="h-3 w-3" /><span>{timeText}</span></div>}
                      {luogo && <div className="flex items-center space-x-2 mt-1 text-xs text-gray-400"><MapPin className="h-3 w-3" /><span>{luogo}</span></div>}
                    </div>

                    <div className="ml-2 flex flex-col items-end space-y-2">
                      <button
                        onClick={() => setActiveAssignment(a)}
                        className="bg-cyan-600 text-white px-3 py-1 rounded text-xs hover:bg-cyan-700"
                      >
                        Dettaglio
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Bottone per aprire tutti i messaggi aziendali anche se non ci sono non letti */}
        {!loadingTalks && companyTalks.length === 0 && (
          <div className="px-4 py-3 bg-cyan-900/20 border-b border-gray-700">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                setTimeout(() => {
                  onOpenCompanyTalk(null);
                }, 100);
              }}
              className="w-full text-sm text-cyan-400 hover:text-cyan-300 font-medium flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Vedi Messaggi Azienda
            </button>
          </div>
        )}

        {/* Separator */}
        {(notifications.length > 0 || (pendingCourses && pendingCourses.length > 0) || (companyTalks && companyTalks.length > 0)) && (
          <div className="px-4 py-2 border-b border-gray-700">
            <h4 className="text-xs font-medium text-gray-400 uppercase">Altre notifiche</h4>
          </div>
        )}

        {/* NOTIFICHE ORIGINALI */}
        {loadingNotifiche ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : notifications.length === 0 ? (
          ((pendingCourses && pendingCourses.length > 0) || (companyTalks && companyTalks.length > 0)) ? null : (
            <div className="p-8 text-center text-gray-400">Nessuna notifica</div>
          )
        ) : (
          <div className="divide-y divide-gray-700">
            {notifications.map(notif => {
              const formatTime = (dateString: string) => {
                const date = new Date(dateString);
                const now = new Date();
                const diffMs = now.getTime() - date.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);

                if (diffMins < 1) return 'Ora';
                if (diffMins < 60) return `${diffMins} min fa`;
                if (diffHours < 24) return `${diffHours}h fa`;
                if (diffDays < 7) return `${diffDays}g fa`;
                return date.toLocaleDateString('it-IT');
              };

              const markAsRead = async (notifId: string) => {
                try {
                  await supabase.rpc('mark_notification_read', {
                    p_notifica_id: notifId,
                    p_user_id: userId
                  });
                  setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, stato: 'letta' } : n));
                } catch (err) {
                  console.error('Errore markAsRead:', err);
                  showError && showError('Errore durante l\'operazione');
                }
              };

              const deleteNotification = async (notifId: string) => {
                try {
                  await supabase.rpc('delete_notification', {
                    p_notifica_id: notifId,
                    p_user_id: userId
                  });
                  setNotifications(prev => prev.filter(n => n.id !== notifId));
                } catch (err) {
                  console.error('Errore deleteNotification:', err);
                  showError && showError('Errore durante l\'eliminazione');
                }
              };

              return (
                <div
                  key={notif.id}
                  className={`p-4 hover:bg-gray-750 transition-colors ${
                    notif.stato === 'non_letta' ? 'bg-gray-750' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className={`font-semibold ${
                        notif.stato === 'non_letta' ? 'text-cyan-400' : 'text-white'
                      }`}>
                        {notif.titolo}
                      </h4>
                      <p className="text-sm text-gray-300 mt-1">{notif.messaggio}</p>
                      <div className="flex items-center space-x-2 mt-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(notif.created_at)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="text-gray-500 hover:text-red-400 ml-2"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  {notif.stato === 'non_letta' && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Segna come letta
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: dettaglio corso */}
      {activeAssignment && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-gray-900 rounded-lg shadow-lg border border-gray-700 overflow-auto max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <div>
                <div className="text-sm text-gray-400">{formatLongDate(activeAssignment.data_partecipazione || activeAssignment.data_invito)}</div>
                <h3 className="text-lg font-semibold text-white">{activeAssignment.courseTitle || activeAssignment.course?.titolo || 'Corso'}</h3>
              </div>
              <button onClick={() => setActiveAssignment(null)} className="text-gray-400 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Titolo</div>
                <div className="text-white font-medium">{activeAssignment.courseTitle || activeAssignment.course?.titolo || '—'}</div>
              </div>

              <div>
                <div className="text-gray-400 text-xs">Descrizione</div>
                <div className="text-gray-300">{activeAssignment.course?.descrizione || activeAssignment.note || '—'}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-gray-400 text-xs">Inizio</div>
                  <div className="text-white">{activeAssignment.ora_inizio || activeAssignment.course?.ora_inizio || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Fine</div>
                  <div className="text-white">{activeAssignment.ora_fine || activeAssignment.course?.ora_fine || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Luogo</div>
                  <div className="text-white">{activeAssignment.luogo || activeAssignment.course?.luogo || '—'}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-xs">Istruttore</div>
                  <div className="text-white">{activeAssignment.course?.istruttore_nome || activeAssignment.course?.istruttore || '—'}</div>
                </div>
              </div>

            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
              {activeAssignment.stato_invito === 'confermato' ? (
                <button disabled className="bg-green-700 text-white px-3 py-1 rounded text-sm opacity-80">Partecipazione confermata</button>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        const { error } = await supabase
                          .from('crew_assegnazionecorsi')
                          .update({ stato_invito: 'confermato', data_conferma: new Date().toISOString() })
                          .eq('id', activeAssignment.id);

                        if (error) {
                          console.error('Errore conferma dal modal:', error);
                          showError && showError('Errore durante la conferma: ' + (error.message || 'Riprova'));
                          setIsSubmitting(false);
                          return;
                        }

                        showSuccess && showSuccess('Partecipazione confermata');
                        setActiveAssignment(null);
                        await loadPendingCourses();
                      } catch (e: any) {
                        console.error('Eccezione conferma dal modal:', e);
                        showError && showError(e?.message || 'Errore durante la conferma');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Confermo...' : 'Conferma partecipazione'}
                  </button>

                  <button
                    onClick={async () => {
                      setIsSubmitting(true);
                      try {
                        const { error } = await supabase
                          .from('crew_assegnazionecorsi')
                          .update({ stato_invito: 'rifiutato' })
                          .eq('id', activeAssignment.id);

                        if (error) {
                          console.error('Errore annulla dal modal:', error);
                          showError && showError('Errore durante l\'annullamento: ' + (error.message || 'Riprova'));
                          setIsSubmitting(false);
                          return;
                        }

                        showSuccess && showSuccess('Partecipazione annullata');
                        setActiveAssignment(null);
                        await loadPendingCourses();
                      } catch (e: any) {
                        console.error('Eccezione annulla dal modal:', e);
                        showError && showError(e?.message || 'Errore durante l\'operazione');
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-60"
                  >
                    Annulla Partecipazione
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      </div>
    </>
  );
};

interface MobileHeaderProps {
  currentVersion: string | null;
  hasUpdate: boolean;
  isVersionLoading: boolean;
  isUpdating: boolean;
  onCheckUpdate: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentVersion,
  hasUpdate,
  isVersionLoading,
  isUpdating,
  onCheckUpdate
}) => {
  const { user, logout } = useAuth();
  const { isOnline, pendingSync, isSyncing, syncPendingData } = useOfflineSync();
  const { showSuccess, showError, showWarning } = useToastContext();
  const [isOnlineState, setIsOnlineState] = React.useState(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = React.useState<number | null>(null);
  const [showInstallButton, setShowInstallButton] = React.useState(false);
  const [unreadNotifications, setUnreadNotifications] = React.useState(0);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showCompanyTalk, setShowCompanyTalk] = React.useState(false);
  const [selectedTalkId, setSelectedTalkId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handleOnline = () => setIsOnlineState(true);
    const handleOffline = () => setIsOnlineState(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Controlla se il prompt di installazione è disponibile
    const checkInstallPrompt = () => {
      const prompt = (window as any).deferredPrompt;
      if (prompt) {
        setShowInstallButton(true);
      }
    };

    checkInstallPrompt();
    const interval = setInterval(checkInstallPrompt, 2000);

    const handlePromptAvailable = () => {
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handlePromptAvailable);

    // Battery API (se supportata)
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handlePromptAvailable);
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (!user?.id) return;

    const loadUnreadCount = async () => {
      const { count: notifCount, error: notifError } = await supabase
        .from('notifiche')
        .select('*', { count: 'exact', head: true })
        .eq('id_utente', user.id)
        .eq('stato', 'non_letta');

      const { count: talksCount, error: talksError } = await supabase
        .from('company_talks')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false);

      const totalCount = (notifCount || 0) + (talksCount || 0);

      if (!notifError && !talksError) {
        setUnreadNotifications(totalCount);
      }
    };

    loadUnreadCount();

    const notifChannel = supabase
      .channel(`notifiche-count-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifiche',
          filter: `id_utente=eq.${user.id}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    const talksChannel = supabase
      .channel(`talks-count-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_talks',
          filter: `recipient_id=eq.${user.id}`
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(talksChannel);
    };
  }, [user?.id]);

  const handleInstallApp = async () => {
    const prompt = (window as any).deferredPrompt;
    if (!prompt) {
      console.log('📱 Prompt installazione non disponibile');
      return;
    }

    console.log('📱 Avvio installazione...');
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('PWA installata con successo');
      setShowInstallButton(false);
    }
    
    (window as any).deferredPrompt = null;
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('it-IT', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        {/* App Title */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-lg">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              CREW MOBILE <span className="text-cyan-400 italic font-extrabold tracking-wider transform -skew-x-12 inline-block text-base">APP</span>
            </h1>
            <p className="text-xs text-gray-300">{user?.displayName || user?.email}</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center space-x-3">
            {/* Version Indicator */}
            <VersionIndicator
              currentVersion={currentVersion}
              hasUpdate={hasUpdate}
              isLoading={isVersionLoading}
              isUpdating={isUpdating}
              onCheckUpdate={onCheckUpdate}
            />

          {/* Sync Status */}
          {pendingSync > 0 && (
            <button
              onClick={syncPendingData}
              disabled={!isOnline || isSyncing}
              className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs ${
                isSyncing 
                  ? 'bg-blue-600 text-white' 
                  : isOnline 
                    ? 'bg-orange-600 text-white hover:bg-orange-700' 
                    : 'bg-gray-600 text-gray-300'
              }`}
            >
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              <span>{pendingSync}</span>
            </button>
          )}

          {/* Install App Button */}
          {showInstallButton && (
                <button
                  onClick={handleInstallApp}
                  className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 flex items-center space-x-1"
                  title="Installa App"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-3 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 rounded-lg transition-colors active:scale-95 touch-manipulation"
              title="Notifiche"
              type="button"
            >
              <Bell className="h-6 w-6" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <NotificationsDropdown
                userId={user?.id || ''}
                onClose={() => setShowNotifications(false)}
                onOpenCompanyTalk={(talkId) => {
                  setSelectedTalkId(talkId);
                  setShowCompanyTalk(true);
                }}
              />
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                showWarning('Logout in corso...');
                await logout();
                showSuccess('Logout effettuato con successo!');
                window.location.href = '/';
              } catch (error) {
                console.error('Errore durante il logout:', error);
                showSuccess('Sessione terminata localmente');
                setTimeout(() => {
                  window.location.href = '/';
                }, 1000);
              }
            }}
            className="p-3 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors active:scale-95 touch-manipulation"
            title="Logout"
            type="button"
          >
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Connection Status Bar */}
      {!isOnline && (
        <div className="mt-2 bg-red-600 text-white text-center py-2 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-sm font-medium">
              Modalità Offline - Dati salvati localmente
              {pendingSync > 0 && ` (${pendingSync} in attesa)`}
            </span>
          </div>
        </div>
      )}

      {/* Company Talk Modal */}
      {showCompanyTalk && (
        <div className="fixed inset-0 z-[9999] bg-gray-900">
          <CompanyTalk
            openTalkId={selectedTalkId}
            onClose={() => {
              setShowCompanyTalk(false);
              setSelectedTalkId(null);
            }}
          />
        </div>
      )}
    </header>
  );
};

export default MobileHeader;