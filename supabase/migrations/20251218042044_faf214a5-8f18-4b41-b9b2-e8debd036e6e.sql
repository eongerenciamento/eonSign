-- Remove foreign key constraint from user_subscriptions to allow inserting subscription for admin
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;