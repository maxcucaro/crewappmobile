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
  // include any other fields you might need from the row
  [key: string]: any;
}

/**
 * Hook: useCourseNotifications
 * - returns the list of course assignments for the current user with stato_invito = 'invitato'
 * - provides a realtime subscription so the list updates automatically
 */
export function useCourseNotifications() {
  const { user } = useAuth();
  const [pendingCourses, setPendingCourses] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const count = pendingCourses.length;

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
        .select('*')
        .eq('persona_id', uid)
        .eq('stato_invito', 'invitato')
        .order('data_invito', { ascending: false });

      if (error) {
        console.error('Errore caricamento crew_assegnazionecorsi (pending):', error);
        setPendingCourses([]);
      } else {
        setPendingCourses(data || []);
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

    // subscribe to changes on crew_assegnazionecorsi for this persona_id
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
          // payload.event: INSERT | UPDATE | DELETE
          // payload.new / payload.old
          try {
            const ev = payload.event;
            if (ev === 'INSERT') {
              const newRow = payload.new as CourseAssignment;
              if (newRow.stato_invito === 'invitato') {
                setPendingCourses(prev => {
                  // avoid duplicates
                  if (prev.find(p => String(p.id) === String(newRow.id))) return prev;
                  return [newRow, ...prev];
                });
              }
            } else if (ev === 'UPDATE') {
              const newRow = payload.new as CourseAssignment;
              const oldRow = payload.old as CourseAssignment | null;
              setPendingCourses(prev => {
                // if changed to 'invitato', ensure present; if changed away, remove; if updated, replace
                const exists = prev.find(p => String(p.id) === String(newRow.id));
                if (newRow.stato_invito === 'invitato') {
                  if (exists) {
                    return prev.map(p => (String(p.id) === String(newRow.id) ? newRow : p));
                  } else {
                    return [newRow, ...prev];
                  }
                } else {
                  // no longer invited => remove
                  return prev.filter(p => String(p.id) !== String(newRow.id));
                }
              });
            } else if (ev === 'DELETE') {
              const oldRow = payload.old as CourseAssignment;
              setPendingCourses(prev => prev.filter(p => String(p.id) !== String(oldRow.id)));
            }
          } catch (e) {
            console.warn('Errore gestione realtime crew_assegnazionecorsi payload', e);
            // fallback: reload full list
            loadPending(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadPending]);

  return { pendingCourses, count, loading, reload: () => loadPending(user?.id) };
}

/**
 * Component: CourseNotificationsBadge
 * - Simple visual badge showing number of pending course confirmations.
 * - Intended to be imported and used next to the Bell in the MobileHeader.
 * - Does not include popup/panel; it's only the badge (small, mobile-friendly).
 *
 * Props:
 *  - className?: additional classes for outer wrapper
 *  - onClick?: forwarded click handler (e.g., to open the notifications panel)
 */
export default function CourseNotificationsBadge({
  className,
  onClick
}: {
  className?: string;
  onClick?: () => void;
}) {
  const { pendingCourses, count, loading } = useCourseNotifications();

  if (loading) {
    // while loading, render nothing (or a subtle placeholder)
    return null;
  }

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