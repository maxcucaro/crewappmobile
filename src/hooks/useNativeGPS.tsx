import { useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';

interface GPSLocation {
  latitude: number;
  longitude: number;
  address: string;
  accuracy: number;
  timestamp: Date;
}

interface GPSOptions {
  requiredAccuracy?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export const useNativeGPS = () => {
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

  const checkPermissions = async (): Promise<boolean> => {
    try {
      const permission = await Geolocation.checkPermissions();

      if (permission.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        return request.location === 'granted';
      }

      return true;
    } catch (error) {
      console.error('Errore controllo permessi GPS:', error);
      return false;
    }
  };

  const getCurrentLocation = useCallback(async (options: GPSOptions = {}) => {
    const {
      requiredAccuracy = 10,
      maxRetries = 3,
      retryDelay = 2000
    } = options;

    setIsLoading(true);
    setError(null);

    const hasPermission = await checkPermissions();
    if (!hasPermission) {
      setError('Permesso GPS negato - Attiva GPS nelle impostazioni');
      setIsLoading(false);
      return null;
    }

    let attempt = 0;
    let bestPosition: any = null;

    while (attempt < maxRetries) {
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: attempt === 0 ? 15000 : 30000,
          maximumAge: 0
        });

        const currentAccuracy = Math.round(position.coords.accuracy);
        setAccuracy(currentAccuracy);

        if (!bestPosition || currentAccuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }

        if (currentAccuracy <= requiredAccuracy) {
          console.log(`✅ GPS precisione raggiunta: ${currentAccuracy}m (richiesti ≤${requiredAccuracy}m)`);
          break;
        }

        console.log(`🎯 Tentativo ${attempt + 1}: precisione ${currentAccuracy}m (target ≤${requiredAccuracy}m)`);

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }

      } catch (error: any) {
        console.error(`❌ Errore GPS tentativo ${attempt + 1}:`, error);

        if (attempt === maxRetries - 1) {
          setError('Impossibile ottenere posizione GPS - Controlla che il GPS sia attivo');
          setIsLoading(false);
          return null;
        }
      }

      attempt++;
    }

    if (bestPosition) {
      try {
        const address = await reverseGeocode(
          bestPosition.coords.latitude,
          bestPosition.coords.longitude
        );

        const location: GPSLocation = {
          latitude: bestPosition.coords.latitude,
          longitude: bestPosition.coords.longitude,
          address,
          accuracy: Math.round(bestPosition.coords.accuracy),
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
