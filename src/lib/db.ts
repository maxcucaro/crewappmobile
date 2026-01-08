import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRORE CONFIGURAZIONE SUPABASE:');
  console.error('Mancano le variabili di ambiente VITE_SUPABASE_URL e/o VITE_SUPABASE_ANON_KEY');
  console.error('1. Crea un file .env nella root del progetto');
  console.error('2. Copia il contenuto da .env.example');
  console.error('3. Sostituisci i valori con le tue credenziali Supabase');
  console.error('4. Riavvia il server di sviluppo');
  throw new Error('Configurazione Supabase mancante - Controlla la console per i dettagli');
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'crew-mobile-auth',
        storage: window.localStorage
      }
    });
    console.log('Supabase client initialized');
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

// User authentication functions
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Generic database functions
export async function fetchData(table: string, columns: string = '*', filters = {}) {
  let query = supabase.from(table).select(columns);
  
  // Apply filters if any
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function insertData(table: string, data: any) {
  const { data: result, error } = await supabase.from(table).insert(data).select();
  if (error) throw error;
  return result;
}

export async function updateData(table: string, id: string, data: any) {
  const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select();
  if (error) throw error;
  return result;
}

export async function deleteData(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
  return true;
}