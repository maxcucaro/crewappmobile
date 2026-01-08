import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/db';

interface OfflineData {
  id: string;
  type: 'checkin' | 'checkout' | 'expense' | 'timesheet';
  data: any;
  timestamp: string;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState<OfflineData[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingData();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Carica dati pending dal localStorage
    loadPendingData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadPendingData = () => {
    try {
      const stored = localStorage.getItem('crew_app_offline_data');
      if (stored) {
        const data = JSON.parse(stored);
        setPendingSync(data);
      }
    } catch (error) {
      console.error('Errore nel caricamento dati offline:', error);
    }
  };

  const savePendingData = (data: OfflineData[]) => {
    try {
      localStorage.setItem('crew_app_offline_data', JSON.stringify(data));
      setPendingSync(data);
    } catch (error) {
      console.error('Errore nel salvataggio dati offline:', error);
    }
  };

  const addOfflineData = useCallback((type: OfflineData['type'], data: any) => {
    const offlineItem: OfflineData = {
      id: Date.now().toString(),
      type,
      data,
      timestamp: new Date().toISOString()
    };

    const newPendingData = [...pendingSync, offlineItem];
    savePendingData(newPendingData);

    // Se online, prova subito a sincronizzare
    if (isOnline) {
      syncPendingData();
    }
  }, [pendingSync, isOnline]);

  const syncPendingData = async () => {
    if (pendingSync.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const successfulSyncs: string[] = [];

    try {
      for (const item of pendingSync) {
        try {
          await syncSingleItem(item);
          successfulSyncs.push(item.id);
        } catch (error) {
          console.error(`Errore sync item ${item.id}:`, error);
        }
      }

      // Rimuovi elementi sincronizzati con successo
      const remainingData = pendingSync.filter(item => !successfulSyncs.includes(item.id));
      savePendingData(remainingData);

      if (successfulSyncs.length > 0) {
        console.log(`✅ Sincronizzati ${successfulSyncs.length} elementi offline`);
      }

    } catch (error) {
      console.error('Errore nella sincronizzazione:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSingleItem = async (item: OfflineData) => {
    switch (item.type) {
      case 'checkin':
        await supabase.from('warehouse_checkins').insert(item.data);
        break;
      case 'checkout':
        await supabase.from('warehouse_checkins').update(item.data.updates).eq('id', item.data.id);
        break;
      case 'expense':
        await supabase.from('expenses').insert(item.data);
        break;
      case 'timesheet':
        if (item.data.id) {
          await supabase.from('timesheet_entries').update(item.data.updates).eq('id', item.data.id);
        } else {
          await supabase.from('timesheet_entries').insert(item.data);
        }
        break;
    }
  };

  const clearPendingData = () => {
    localStorage.removeItem('crew_app_offline_data');
    setPendingSync([]);
  };

  return {
    isOnline,
    pendingSync: pendingSync.length,
    isSyncing,
    addOfflineData,
    syncPendingData,
    clearPendingData
  };
};