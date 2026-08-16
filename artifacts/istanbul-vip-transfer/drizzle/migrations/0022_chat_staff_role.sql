-- Migration 0022: Add CHAT_STAFF role to admin_role enum
-- Allows creating restricted accounts that can only access the Live Chat panel
ALTER TYPE admin_role ADD VALUE IF NOT EXISTS 'CHAT_STAFF';
