/*
  # Disabilita trigger eventi problematico
  
  La rettifica checkout eventi deve solo aggiornare rectified_end_time
  nella tabella timesheet_entries. Non servono trigger complessi.
*/

DROP TRIGGER IF EXISTS trigger_sync_eventi_report ON timesheet_entries;
DROP FUNCTION IF EXISTS sync_eventi_to_report() CASCADE;
