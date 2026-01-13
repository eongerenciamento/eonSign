-- Corrigir período de assinatura anual da Mabril Engenharia
UPDATE user_subscriptions
SET 
  current_period_start = '2026-01-12T09:03:27.000Z',
  current_period_end = '2027-01-09T21:59:58.000Z',
  updated_at = now()
WHERE stripe_subscription_id = 'sub_1SnmA6HRTD5Wvpxjqc3izlxz';