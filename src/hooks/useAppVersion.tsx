import { useState, useEffect } from 'react';
import { supabase } from '../lib/db';

export const useAppVersion = () => {
  const [version, setVersion] = useState('1.0.0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const { data, error } = await supabase
          .from('software_versions')
          .select('current_version')
          .eq('software_code', 'crew_mobile')
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          console.error('Error fetching version:', error);
          return;
        }

        if (data?.current_version) {
          setVersion(data.current_version);
        }
      } catch (error) {
        console.error('Error fetching version:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return { version, loading };
};
