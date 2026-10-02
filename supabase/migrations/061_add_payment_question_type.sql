-- Add payment question type to support payment workflows
-- This allows admins to create payment questions that redirect users to payment URLs
-- and collect payment proof via screenshot uploads

ALTER TYPE question_type ADD VALUE IF NOT EXISTS 'payment';

-- Comment for documentation
COMMENT ON TYPE question_type IS 'Supported question types including payment for payment workflow support';