-- Threads API returns "TEXT_POST" for text-only posts. Add it to the enum.
ALTER TYPE threadlens.media_type ADD VALUE IF NOT EXISTS 'TEXT_POST';
