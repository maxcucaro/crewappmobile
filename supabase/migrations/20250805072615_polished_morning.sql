/*
  # Aggiungi campo logo_url alla tabella regaziendasoftware

  1. Schema Changes
    - Aggiungi colonna `logo_url` per memorizzare URL del logo
    - Campo opzionale (nullable)

  2. Security
    - Mantiene le policy RLS esistenti
*/

-- Aggiungi colonna logo_url alla tabella regaziendasoftware
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'regaziendasoftware' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE regaziendasoftware ADD COLUMN logo_url text;
  END IF;
END $$;