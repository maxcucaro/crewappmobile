/*
  # Aggiungi policy INSERT per corsi_formazione

  1. Security
    - Aggiungi policy INSERT per permettere alle aziende di creare corsi
    - Mantieni isolamento tra aziende (ogni azienda può creare solo i propri corsi)
*/

-- Aggiungi policy INSERT specifica per corsi_formazione
CREATE POLICY "Aziende possono creare propri corsi formazione"
  ON corsi_formazione
  FOR INSERT
  TO authenticated
  WITH CHECK (id_azienda = auth.uid());

-- Aggiungi anche policy UPDATE e DELETE se non esistono
CREATE POLICY "Aziende possono aggiornare propri corsi formazione"
  ON corsi_formazione
  FOR UPDATE
  TO authenticated
  USING (id_azienda = auth.uid())
  WITH CHECK (id_azienda = auth.uid());

CREATE POLICY "Aziende possono eliminare propri corsi formazione"
  ON corsi_formazione
  FOR DELETE
  TO authenticated
  USING (id_azienda = auth.uid());

-- Aggiungi policy SELECT per tecnici che possono vedere corsi pubblici o a cui sono iscritti
CREATE POLICY "Tecnici possono vedere corsi pubblici o iscritti"
  ON corsi_formazione
  FOR SELECT
  TO authenticated
  USING (
    visibilita = 'pubblico' 
    OR 
    EXISTS (
      SELECT 1 FROM iscrizioni_corsi 
      WHERE iscrizioni_corsi.id_corso = corsi_formazione.id 
      AND iscrizioni_corsi.id_tecnico = auth.uid()
    )
  );