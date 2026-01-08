import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

interface VersionInfo {
  version: string;
  buildTimestamp: string;
  features?: string[];
  releaseNotes?: string;
  description?: string;
}

interface VersionState {
  currentVersion: string | null;
  latestVersion: string | null;
  releaseNotes: string | null;
  hasUpdate: boolean;
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
}

export const useVersionManager = () => {
  const [versionState, setVersionState] = useState<VersionState>({
    currentVersion: null,
    latestVersion: null,
    releaseNotes: null,
    hasUpdate: false,
    isLoading: false,
    isUpdating: false,
    error: null
  });

  const [lastCheckTime, setLastCheckTime] = useState<number>(0);
  const CHECK_INTERVAL = 5 * 60 * 1000;

  const getCurrentVersion = useCallback((): string | null => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVersion = urlParams.get('_v');

    if (urlVersion) {
      localStorage.setItem('app_crew_azienda_version', urlVersion);
      return urlVersion;
    }

    return localStorage.getItem('app_crew_azienda_version');
  }, []);

  const wasJustUpdated = useCallback((): boolean => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('_updated') === 'true';
  }, []);

  const fetchLatestVersion = useCallback(async (): Promise<VersionInfo | null> => {
    try {
      console.log('🔍 Controllo versione da database per software_code: app_crew_azienda');

      const { data: versionData, error: versionError } = await supabase
        .from('software_versions')
        .select('*')
        .eq('software_code', 'app_crew_azienda')
        .eq('is_active', true)
        .order('release_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (versionError) {
        console.error('❌ Errore caricamento versione da database:', versionError);
        return await fetchVersionFromFile();
      }

      if (!versionData) {
        console.warn('⚠️ Nessuna versione attiva trovata nel database per app_crew_azienda');
        return await fetchVersionFromFile();
      }

      console.log('✅ Versione caricata da database:', versionData.current_version);

      const versionInfo: VersionInfo = {
        version: versionData.current_version,
        buildTimestamp: versionData.release_date,
        features: Array.isArray(versionData.features) ? versionData.features : [],
        releaseNotes: versionData.release_notes || '',
        description: versionData.description || ''
      };

      return versionInfo;
    } catch (error) {
      console.error('❌ Errore generale nel controllo versione database:', error);
      return await fetchVersionFromFile();
    }
  }, []);

  const fetchVersionFromFile = useCallback(async (): Promise<VersionInfo | null> => {
    try {
      console.log('📄 Fallback: caricamento versione da file statico');

      const timestamp = Date.now();
      const response = await fetch(`/version.json?_t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const versionInfo: VersionInfo = await response.json();
      console.log('✅ Versione caricata da file statico:', versionInfo.version);
      return versionInfo;
    } catch (error) {
      console.error('❌ Errore nel fetch versione da file:', error);
      return null;
    }
  }, []);

  const checkForUpdates = useCallback(async (force: boolean = false): Promise<boolean> => {
    const now = Date.now();
    if (!force && (now - lastCheckTime) < CHECK_INTERVAL) {
      return false;
    }

    if (versionState.isLoading || versionState.isUpdating) {
      return false;
    }

    setVersionState(prev => ({ ...prev, isLoading: true, error: null }));
    setLastCheckTime(now);

    try {
      const currentVersion = getCurrentVersion();
      const latestVersionInfo = await fetchLatestVersion();

      if (!latestVersionInfo) {
        setVersionState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Impossibile verificare aggiornamenti'
        }));
        return false;
      }

      const hasUpdate = currentVersion !== latestVersionInfo.version;

      setVersionState(prev => ({
        ...prev,
        currentVersion,
        latestVersion: latestVersionInfo.version,
        releaseNotes: latestVersionInfo.releaseNotes || null,
        hasUpdate,
        isLoading: false,
        error: null
      }));

      console.log('🔍 Controllo versione:', {
        current: currentVersion,
        latest: latestVersionInfo.version,
        hasUpdate,
        buildTime: latestVersionInfo.buildTimestamp
      });

      return hasUpdate;

    } catch (error) {
      console.error('Errore nel controllo versioni:', error);
      setVersionState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Errore controllo versioni'
      }));
      return false;
    }
  }, [getCurrentVersion, fetchLatestVersion, lastCheckTime, versionState.isLoading, versionState.isUpdating, CHECK_INTERVAL]);

  const applyUpdate = useCallback(async (): Promise<void> => {
    if (versionState.isUpdating || !versionState.hasUpdate) {
      return;
    }

    setVersionState(prev => ({ ...prev, isUpdating: true }));

    try {
      console.log('🔄 Applicazione aggiornamento...');

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('🗑️ Cache cancellate:', cacheNames.length);
      }

      if (versionState.latestVersion) {
        localStorage.setItem('app_crew_azienda_version', versionState.latestVersion);
        localStorage.setItem('app_crew_azienda_last_update', new Date().toISOString());
      }

      const timestamp = Date.now();
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('_v', versionState.latestVersion || '');
      newUrl.searchParams.set('_t', timestamp.toString());
      newUrl.searchParams.set('_updated', 'true');

      console.log('🚀 Reindirizzamento a:', newUrl.toString());

      window.location.href = newUrl.toString();

    } catch (error) {
      console.error('Errore nell\'applicazione aggiornamento:', error);
      setVersionState(prev => ({
        ...prev,
        isUpdating: false,
        error: 'Errore durante aggiornamento'
      }));
    }
  }, [versionState.isUpdating, versionState.hasUpdate, versionState.latestVersion]);

  useEffect(() => {
    const initializeVersion = async () => {
      let currentVersion = getCurrentVersion();

      if (!currentVersion) {
        const latestVersionInfo = await fetchLatestVersion();
        if (latestVersionInfo) {
          currentVersion = latestVersionInfo.version;
          localStorage.setItem('app_crew_azienda_version', currentVersion);
          setVersionState(prev => ({
            ...prev,
            currentVersion,
            latestVersion: currentVersion,
            hasUpdate: false
          }));
        }
      } else {
        setVersionState(prev => ({
          ...prev,
          currentVersion
        }));
      }
    };

    initializeVersion();

    if (!wasJustUpdated()) {
      const initialCheck = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkForUpdates(false);
      };
      initialCheck();
    }

    const handleFocus = () => {
      checkForUpdates(false);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkForUpdates, getCurrentVersion, wasJustUpdated, fetchLatestVersion]);

  return {
    ...versionState,
    checkForUpdates: (force?: boolean) => checkForUpdates(force || false),
    applyUpdate
  };
};
