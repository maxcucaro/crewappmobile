import { useState, useCallback } from 'react';

interface GPSLocation {
  latitude: number;
  longitude: number;
  address: string;
  accuracy: number;
  timestamp: Date;
}

interface GPSOptions {
  requiredAccuracy?: number; // metri
  maxRetries?: number;
  retryDelay?: number; // millisecondi
}

export const useGPSLocation = () => {
  const [currentLocation, setCurrentLocation] = useState<GPSLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CrewManager-Mobile/1.0'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Servizio geocoding non disponibile');
      }
      
      const data = await response.json();
      
      if (data && data.display_name) {
        return data.display_name;
      } else {
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
    } catch (error) {
      console.error('Errore reverse geocoding:', error);
      return `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`;
    }
  };

  const getCurrentLocation = useCallback(async (options: GPSOptions = {}) => {
    const {
      requiredAccuracy = 10, // 10 metri di default
      maxRetries = 3,
      retryDelay = 2000
    } = options;

    setIsLoading(true);
    setError(null);

    let attempt = 0;
    let bestLocation: GeolocationPosition | null = null;

    while (attempt < maxRetries) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: true,
              timeout: attempt === 0 ? 15000 : 30000, // Più tempo per tentativi successivi
              maximumAge: 0
            }
          );
        });

        const currentAccuracy = Math.round(position.coords.accuracy);
        setAccuracy(currentAccuracy);

        // Se è la prima posizione o è più precisa della precedente
        if (!bestLocation || currentAccuracy < bestLocation.coords.accuracy) {
          bestLocation = position;
        }

        // Se raggiungiamo la precisione richiesta, usiamo questa posizione
        if (currentAccuracy <= requiredAccuracy) {
          console.log(`✅ GPS precisione raggiunta: ${currentAccuracy}m (richiesti ≤${requiredAccuracy}m)`);
          break;
        }

        console.log(`🎯 Tentativo ${attempt + 1}: precisione ${currentAccuracy}m (target ≤${requiredAccuracy}m)`);
        
        // Se non è l'ultimo tentativo, aspetta prima di riprovare
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

      } catch (error: any) {
        console.error(`❌ Errore GPS tentativo ${attempt + 1}:`, error);
        
        if (attempt === maxRetries - 1) {
          // Ultimo tentativo fallito
          setError(getLocationErrorMessage(error.code));
          setIsLoading(false);
          return null;
        }
      }

      attempt++;
    }

    if (bestLocation) {
      try {
        const address = await reverseGeocode(
          bestLocation.coords.latitude,
          bestLocation.coords.longitude
        );

        const location: GPSLocation = {
          latitude: bestLocation.coords.latitude,
          longitude: bestLocation.coords.longitude,
          address,
          accuracy: Math.round(bestLocation.coords.accuracy),
          timestamp: new Date()
        };

        setCurrentLocation(location);
        setIsLoading(false);
        
        console.log(`📍 Posizione finale: ${address} (±${location.accuracy}m)`);
        return location;

      } catch (error) {
        console.error('Errore nel reverse geocoding:', error);
        setError('Errore nel determinare l\'indirizzo');
        setIsLoading(false);
        return null;
      }
    }

    setError('Impossibile ottenere posizione GPS precisa');
    setIsLoading(false);
    return null;
  }, []);

  const getLocationErrorMessage = (code: number): string => {
    switch (code) {
      case 1: return 'Permesso GPS negato - Attiva GPS nelle impostazioni del telefono';
      case 2: return 'Posizione non disponibile - Controlla che il GPS sia attivo';
      case 3: return 'Timeout GPS - Segnale debole o GPS spento. Vai all\'aperto e riprova';
      default: return 'Errore GPS - Controlla che il GPS sia attivo e riprova';
    }
  };

  const clearLocation = () => {
    setCurrentLocation(null);
    setError(null);
    setAccuracy(null);
  };

  return {
    currentLocation,
    isLoading,
    error,
    accuracy,
    getCurrentLocation,
    clearLocation
  };
};