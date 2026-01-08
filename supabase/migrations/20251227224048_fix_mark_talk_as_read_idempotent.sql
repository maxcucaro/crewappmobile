/*
  # Fix mark_talk_as_read function to be idempotent
  
  ## Changes
  - Remove the `AND is_read = false` condition from mark_talk_as_read function
  - This ensures the function works even if the message was already marked as read
  - Makes the function idempotent (can be called multiple times safely)
  
  ## Reason
  Some urgent messages were not being marked as read because of edge cases
  where is_read might already be true, blocking the UPDATE.
*/

CREATE OR REPLACE FUNCTION mark_talk_as_read(talk_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE company_talks
  SET is_read = true,
      read_at = COALESCE(read_at, now())
  WHERE id = talk_id
  AND recipient_id = auth.uid();
END;
$$;
