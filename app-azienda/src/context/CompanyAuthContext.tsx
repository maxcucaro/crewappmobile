import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface CompanyProfile {
  id: string;
  auth_user_id: string;
  ragione_sociale: string;
  partita_iva: string;
  email: string;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  created_at: string;
  password_scadenza: string | null;
}

interface CompanyAuthContextType {
  user: User | null;
  companyProfile: CompanyProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const CompanyAuthContext = createContext<CompanyAuthContextType | undefined>(undefined);

export const CompanyAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCompanyProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadCompanyProfile(session.user.id);
      } else {
        setCompanyProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadCompanyProfile = async (userId: string) => {
    try {
      // 1. Verifica se è un DIPENDENTE (ha parent_company_id in registration_requests)
      const { data: employeeData, error: employeeError } = await supabase
        .from('registration_requests')
        .select('parent_company_id')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (!employeeError && employeeData && employeeData.parent_company_id) {
        console.error('❌ L\'utente è un dipendente, non un\'azienda');
        setTimeout(async () => {
          await supabase.auth.signOut();
        }, 3000);
        throw new Error('EMPLOYEE_LOGIN');
      }

      // 2. Carica profilo azienda da regaziendasoftware
      const { data, error } = await supabase
        .from('regaziendasoftware')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setTimeout(async () => {
          await supabase.auth.signOut();
        }, 3000);
        throw new Error('Accesso non autorizzato. Solo aziende possono accedere.');
      }

      // 3. Verifica scadenza abbonamento dalla tabella azienda_software
      const { data: softwareData, error: softwareError } = await supabase
        .from('azienda_software')
        .select('data_scadenza, stato')
        .eq('auth_user_id', userId)
        .eq('software_codice', 'app_crew_azienda')
        .maybeSingle();

      if (!softwareError && softwareData) {
        // Verifica stato abbonamento
        if (softwareData.stato !== 'attivo') {
          console.error('❌ Abbonamento non attivo. Stato:', softwareData.stato);
          setTimeout(async () => {
            await supabase.auth.signOut();
          }, 3000);
          throw new Error('SUBSCRIPTION_INACTIVE');
        }

        // Verifica data scadenza abbonamento
        if (softwareData.data_scadenza) {
          const scadenzaAbbonamento = new Date(softwareData.data_scadenza);
          const oggi = new Date();
          oggi.setHours(0, 0, 0, 0);
          scadenzaAbbonamento.setHours(0, 0, 0, 0);

          if (oggi > scadenzaAbbonamento) {
            console.error('❌ Abbonamento scaduto il:', scadenzaAbbonamento.toLocaleDateString());
            setTimeout(async () => {
              await supabase.auth.signOut();
            }, 3000);
            throw new Error('SUBSCRIPTION_EXPIRED');
          }
        }
      }

      // 4. Verifica scadenza password (controllo secondario)
      if (data.password_scadenza) {
        const scadenzaPassword = new Date(data.password_scadenza);
        const oggi = new Date();

        if (oggi > scadenzaPassword) {
          console.error('❌ Password scaduta:', scadenzaPassword);
          setTimeout(async () => {
            await supabase.auth.signOut();
          }, 3000);
          throw new Error('PASSWORD_EXPIRED');
        }
      }

      console.log('✅ Azienda verificata:', data.ragione_sociale);
      setCompanyProfile(data);
    } catch (error) {
      console.error('Error loading company profile:', error);
      setCompanyProfile(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // 1. Login con Supabase Auth
      console.log('🔑 Tentativo login azienda per:', email);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('❌ Errore autenticazione:', error.message);
        throw error;
      }

      if (!data.user) {
        throw new Error('Dati utente non validi');
      }

      console.log('✅ Login Supabase riuscito per:', data.user.email);

      // 2. Verifica se è un DIPENDENTE (ha parent_company_id in registration_requests)
      const { data: employeeData, error: employeeError } = await supabase
        .from('registration_requests')
        .select('parent_company_id')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (!employeeError && employeeData && employeeData.parent_company_id) {
        console.error('❌ L\'utente è un dipendente, non un\'azienda');
        setTimeout(async () => {
          await supabase.auth.signOut();
        }, 3000);
        throw new Error('EMPLOYEE_LOGIN');
      }

      // 3. Carica profilo azienda da regaziendasoftware
      const { data: profile, error: profileError } = await supabase
        .from('regaziendasoftware')
        .select('*')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        console.error('❌ Profilo azienda non trovato');
        setTimeout(async () => {
          await supabase.auth.signOut();
        }, 3000);
        throw new Error('Accesso non autorizzato. Solo aziende possono accedere.');
      }

      // 4. Verifica scadenza abbonamento dalla tabella azienda_software
      const { data: softwareData, error: softwareError } = await supabase
        .from('azienda_software')
        .select('data_scadenza, stato')
        .eq('auth_user_id', data.user.id)
        .eq('software_codice', 'app_crew_azienda')
        .maybeSingle();

      if (!softwareError && softwareData) {
        // Verifica stato abbonamento
        if (softwareData.stato !== 'attivo') {
          console.error('❌ Abbonamento non attivo. Stato:', softwareData.stato);
          setTimeout(async () => {
            await supabase.auth.signOut();
          }, 3000);
          throw new Error('SUBSCRIPTION_INACTIVE');
        }

        // Verifica data scadenza abbonamento
        if (softwareData.data_scadenza) {
          const scadenzaAbbonamento = new Date(softwareData.data_scadenza);
          const oggi = new Date();
          oggi.setHours(0, 0, 0, 0);
          scadenzaAbbonamento.setHours(0, 0, 0, 0);

          if (oggi > scadenzaAbbonamento) {
            console.error('❌ Abbonamento scaduto il:', scadenzaAbbonamento.toLocaleDateString());
            setTimeout(async () => {
              await supabase.auth.signOut();
            }, 3000);
            throw new Error('SUBSCRIPTION_EXPIRED');
          }
        }
      }

      // 5. Verifica scadenza password (controllo secondario)
      if (profile.password_scadenza) {
        const scadenzaPassword = new Date(profile.password_scadenza);
        const oggi = new Date();

        if (oggi > scadenzaPassword) {
          console.error('❌ Password scaduta:', scadenzaPassword);
          setTimeout(async () => {
            await supabase.auth.signOut();
          }, 3000);
          throw new Error('PASSWORD_EXPIRED');
        }
      }

      console.log('✅ Azienda verificata:', profile.ragione_sociale);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCompanyProfile(null);
    } catch (error: any) {
      console.error('Errore durante il logout:', error);
      setCompanyProfile(null);
      setUser(null);
      throw error;
    }
  };

  return (
    <CompanyAuthContext.Provider value={{ user, companyProfile, loading, signIn, signOut }}>
      {children}
    </CompanyAuthContext.Provider>
  );
};

export const useCompanyAuth = () => {
  const context = useContext(CompanyAuthContext);
  if (context === undefined) {
    throw new Error('useCompanyAuth must be used within a CompanyAuthProvider');
  }
  return context;
};
