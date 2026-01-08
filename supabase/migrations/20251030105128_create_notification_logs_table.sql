/*
  # Tabella Notification Logs per Storico Notifiche Push

  1. Nuove Tabelle
    - `notification_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, riferimento auth.users) - Destinatario
      - `shift_type` (text) - Tipo turno: 'event' o 'warehouse'
      - `shift_id` (uuid) - ID evento o turno magazzino
      - `notification_type` (text) - Tipo: 'pre_shift_10', 'pre_shift_0', 'pre_shift_minus10', 'post_shift_10', 'post_shift_20', 'post_shift_30'
      - `notification_count` (int) - Numero progressivo notifica (1, 2, 3)
      - `title` (text) - Titolo notifica
      - `message` (text) - Messaggio notifica
      - `sent_at` (timestamptz) - Quando è stata inviata
      - `status` (text) - Stato: 'sent', 'failed', 'cancelled'
      - `error_message` (text) - Messaggio errore se fallita
      - `action_taken` (boolean) - Se dipendente ha fatto check-in/checkout dopo notifica
      - `action_taken_at` (timestamptz) - Quando ha fatto azione

  2. Security
    - Enable RLS
    - Policy: Users can view own notification logs
    - Policy: System can insert logs (SECURITY DEFINER functions)

  3. Indexes
    - Index su user_id
    - Index su shift_id
    - Index su sent_at per query temporali
    - Index su notification_type per filtrare
*/

-- Crea tabella notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_type text NOT NULL CHECK (shift_type IN ('event', 'warehouse')),
  shift_id uuid NOT NULL,
  notification_type text NOT NULL CHECK (notification_type IN (
    'pre_shift_10',      -- 10 minuti prima
    'pre_shift_0',       -- all'inizio
    'pre_shift_minus10', -- 10 minuti dopo inizio (ritardo)
    'post_shift_10',     -- 10 minuti dopo fine
    'post_shift_20',     -- 20 minuti dopo fine
    'post_shift_30'      -- 30 minuti dopo fine
  )),
  notification_count int NOT NULL CHECK (notification_count BETWEEN 1 AND 3),
  title text NOT NULL,
  message text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  status text DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'cancelled')),
  error_message text,
  action_taken boolean DEFAULT false,
  action_taken_at timestamptz,
  UNIQUE(user_id, shift_id, notification_type)
);

-- Indexes per performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_shift_id ON notification_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON notification_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- Enable RLS
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view own notification logs
DROP POLICY IF EXISTS "Users can view own notification logs" ON notification_logs;
CREATE POLICY "Users can view own notification logs"
  ON notification_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: System can insert logs (tramite SECURITY DEFINER functions)
DROP POLICY IF EXISTS "System can insert notification logs" ON notification_logs;
CREATE POLICY "System can insert notification logs"
  ON notification_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Funzione helper per creare log notifica
CREATE OR REPLACE FUNCTION create_notification_log(
  p_user_id uuid,
  p_shift_type text,
  p_shift_id uuid,
  p_notification_type text,
  p_notification_count int,
  p_title text,
  p_message text,
  p_status text DEFAULT 'sent',
  p_error_message text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO notification_logs (
    id,
    user_id,
    shift_type,
    shift_id,
    notification_type,
    notification_count,
    title,
    message,
    sent_at,
    status,
    error_message
  ) VALUES (
    gen_random_uuid(),
    p_user_id,
    p_shift_type,
    p_shift_id,
    p_notification_type,
    p_notification_count,
    p_title,
    p_message,
    NOW(),
    p_status,
    p_error_message
  )
  ON CONFLICT (user_id, shift_id, notification_type) 
  DO UPDATE SET
    notification_count = EXCLUDED.notification_count,
    sent_at = NOW(),
    status = EXCLUDED.status,
    error_message = EXCLUDED.error_message
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per segnare azione completata
CREATE OR REPLACE FUNCTION mark_notification_action_taken(
  p_user_id uuid,
  p_shift_id uuid
) RETURNS void AS $$
BEGIN
  UPDATE notification_logs
  SET 
    action_taken = true,
    action_taken_at = NOW()
  WHERE user_id = p_user_id
    AND shift_id = p_shift_id
    AND action_taken = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenti
COMMENT ON TABLE notification_logs IS 'Storico completo di tutte le notifiche push inviate';
COMMENT ON COLUMN notification_logs.shift_type IS 'Tipo turno: event (evento) o warehouse (magazzino)';
COMMENT ON COLUMN notification_logs.notification_type IS 'Tipo notifica: pre_shift (prima turno) o post_shift (dopo turno)';
COMMENT ON COLUMN notification_logs.notification_count IS 'Numero progressivo: 1=prima notifica, 2=seconda, 3=terza';
COMMENT ON COLUMN notification_logs.action_taken IS 'Se dipendente ha completato check-in/checkout dopo notifica';
COMMENT ON FUNCTION create_notification_log IS 'Crea un log di notifica inviata con upsert su conflitto';
COMMENT ON FUNCTION mark_notification_action_taken IS 'Segna che il dipendente ha completato l''azione richiesta dalla notifica';
