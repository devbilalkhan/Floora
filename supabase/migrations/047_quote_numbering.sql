-- Add quote numbering fields to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS quote_prefix      text    NOT NULL DEFAULT 'SPM',
  ADD COLUMN IF NOT EXISTS quote_number_seq  integer NOT NULL DEFAULT 99;

-- Atomic RPC: increments the counter and returns the formatted number e.g. SPM-0100
CREATE OR REPLACE FUNCTION next_quote_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prefix text;
  v_seq    integer;
BEGIN
  UPDATE organizations
  SET quote_number_seq = quote_number_seq + 1
  WHERE id = org_id
  RETURNING quote_prefix, quote_number_seq INTO v_prefix, v_seq;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organisation not found';
  END IF;

  RETURN v_prefix || '-' || LPAD(v_seq::text, 4, '0');
END;
$$;
