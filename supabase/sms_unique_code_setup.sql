-- Add an sms_code column to track specific shift trades
ALTER TABLE public.shift_trades
ADD COLUMN IF NOT EXISTS sms_code text;

-- Create an trigger to auto-generate the sms_code before insert
CREATE OR REPLACE FUNCTION generate_sms_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sms_code IS NULL THEN
        -- Generate a 4-character alphanumeric uppercase code
        NEW.sms_code := upper(substring(md5(random()::text) from 1 for 4));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_sms_code ON public.shift_trades;
CREATE TRIGGER trigger_generate_sms_code
BEFORE INSERT ON public.shift_trades
FOR EACH ROW
EXECUTE FUNCTION generate_sms_code();
