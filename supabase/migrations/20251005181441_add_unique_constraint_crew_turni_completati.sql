/*
  # Aggiungi constraint UNIQUE a crew_turni_completati

  ## Problema
  - La tabella crew_turni_completati non ha un constraint UNIQUE su (dipendente_id, giorno_turno)
  - Questo permette duplicati e impedisce l'uso di ON CONFLICT
  - Il trigger non può fare UPSERT correttamente

  ## Soluzione
  - Aggiungi constraint UNIQUE su (dipendente_id, giorno_turno)
  - Prima rimuovi eventuali duplicati esistenti
  - Questo permette al trigger di fare UPSERT in modo sicuro

  ## Sicurezza
  - Prima di aggiungere il constraint, elimina duplicati mantenendo solo il più recente
*/

-- Elimina duplicati mantenendo solo il record più recente per ogni (dipendente_id, giorno_turno)
DELETE FROM crew_turni_completati
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY dipendente_id, giorno_turno 
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      ) as rn
    FROM crew_turni_completati
  ) t
  WHERE rn > 1
);

-- Aggiungi constraint UNIQUE
ALTER TABLE crew_turni_completati
ADD CONSTRAINT crew_turni_completati_dipendente_giorno_unique 
UNIQUE (dipendente_id, giorno_turno);
