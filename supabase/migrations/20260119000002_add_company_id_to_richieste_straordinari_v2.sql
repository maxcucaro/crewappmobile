-- Add missing company_id column to richieste_straordinari_v2
-- Bug: La colonna company_id non esisteva nella tabella, causando errore 42703 durante insert

-- Add company_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'richieste_straordinari_v2' 
    AND column_name = 'company_id'
  ) THEN
    ALTER TABLE public.richieste_straordinari_v2 
    ADD COLUMN company_id uuid NULL;
    
    -- Add foreign key constraint
    ALTER TABLE public.richieste_straordinari_v2
    ADD CONSTRAINT richieste_straordinari_v2_company_fkey 
    FOREIGN KEY (company_id) 
    REFERENCES companies (id) 
    ON DELETE SET NULL;
    
    -- Add index for better performance
    CREATE INDEX idx_rich_v2_company 
    ON public.richieste_straordinari_v2 
    USING btree (company_id);
  END IF;
END $$;

-- Add crew_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'richieste_straordinari_v2' 
    AND column_name = 'crew_name'
  ) THEN
    ALTER TABLE public.richieste_straordinari_v2 
    ADD COLUMN crew_name text NULL;
  END IF;
END $$;

COMMENT ON COLUMN richieste_straordinari_v2.company_id IS 'ID azienda associata alla richiesta (popolato automaticamente dal trigger)';
COMMENT ON COLUMN richieste_straordinari_v2.crew_name IS 'Nome completo del dipendente (popolato automaticamente dal trigger)';
