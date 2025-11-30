-- Add policy to stripe_webhook_events to block direct user access
-- Only Edge Functions with service role key can access this table
CREATE POLICY "Block all user access to webhook events"
  ON public.stripe_webhook_events
  FOR ALL
  USING (false)
  WITH CHECK (false);