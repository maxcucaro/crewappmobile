import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';

export interface CourseAssignment {
  id: string;
  corso_id?: string;
  persona_id?: string;
  persona_nome?: string;
  stato_invito?: string;
  data_invito?: string | null;
  data_conferma?: string | null;
  data_partecipazione?: string | null;
  ora_inizio?: string | null;
  ora_fine?: string | null;
  luogo?: string | null;
  corso?: {
    id?: string;
    titolo?: string | null;
    nome?: string | null;
    [key: string]: any;
  } | null;
  courseTitle?: string | null;
  [key: string]: any;
}

export function useCourseNotifications() {
  const { user } = useAuth();
  const [pendingCourses, setPendingCourses] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const mapCourseTitle = (row: any) => {
    return (
      row.titolo_corso ||
      row.corso_titolo ||
      row.corso_nome ||
      (row.corso && (row.corso.titolo || row.corso.nome)) ||
      null
    );
  };

  const normalizeRows = (rows: any[] = []) => {
    return rows.map(r => ({
      ...r,
      // fallback to a clear human-friendly placeholder instead of UUID
      courseTitle: mapCourseTitle(r) || 'Corso da confermare'
    }));
  };

  const loadPending = useCallback(async (uid?: string) => {
    if (!uid) {
      setPendingCourses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crew_assegnazionecorsi')
        .select('*, corso:corso_id(id, titolo, nome)')
        .eq('persona_id', uid)
        .eq('stato_invito', 'invitato')
        .order('data_invito', { ascending: false });

      if (error) {
        console.error('Errore caricamento crew_assegnazionecorsi (pending):', error);
        setPendingCourses([]);
      } else {
        setPendingCourses(normalizeRows(data || []));
      }
    } catch (err) {
      console.error('Eccezione loadPending course assignments:', err);
      setPendingCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setPendingCourses([]);
      setLoading(false);
      return;
    }

    loadPending(user.id);

    const channel = supabase
      .channel(`course-notifs-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'crew_assegnazionecorsi',
          filter: `persona_id=eq.${user.id}`
        },
        (payload: any) => {
          try {
            const ev = payload.event;
            if (ev === 'INSERT') {
              const newRow = payload.new as CourseAssignment;
              if (newRow.stato_invito === 'invitato') {
                const mapped = normalizeRows([newRow])[0];
                setPendingCourses(prev => {
                  if (prev.find(p => String(p.id) === String(mapped.id))) return prev;
                  return [mapped, ...prev];
                });
              }
            } else if (ev === 'UPDATE') {
              const newRow = payload.new as CourseAssignment;
              const mapped = normalizeRows([newRow])[0];
              setPendingCourses(prev => {
                const exists = prev.find(p => String(p.id) === String(mapped.id));
                if (newRow.stato_invito === 'invitato') {
                  if (exists) {
                    return prev.map(p => (String(p.id) === String(mapped.id) ? mapped : p));
                  } else {
                    return [mapped, ...prev];
                  }
                } else {
                  return prev.filter(p => String(p.id) !== String(mapped.id));
                }
              });
            } else if (ev === 'DELETE') {
              const oldRow = payload.old as CourseAssignment;
              setPendingCourses(prev => prev.filter(p => String(p.id) !== String(oldRow.id)));
            }
          } catch (e) {
            console.warn('Errore gestione realtime crew_assegnazionecorsi payload', e);
            loadPending(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadPending]);

  return { pendingCourses, count: pendingCourses.length, loading, reload: () => loadPending(user?.id) };
}

export default function CourseNotificationsBadge({
  className,
  onClick
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { pendingCourses, count, loading } = useCourseNotifications();

  if (loading) return null;
  if (count === 0) return null;

  return (
    <button
      onClick={() => onClick && onClick()}
      className={`absolute -top-1 -right-1 bg-transparent ${className || ''}`}
      aria-label={`${count} corso${count > 1 ? 'i' : ''} da confermare`}
      type="button"
    >
      <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-semibold rounded-full h-5 w-5">
        {count > 9 ? '9+' : count}
      </span>
    </button>
  );
}