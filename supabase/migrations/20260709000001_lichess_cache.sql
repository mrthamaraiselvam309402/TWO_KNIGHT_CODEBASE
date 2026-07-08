CREATE TABLE IF NOT EXISTS public.lichess_cache (
    lichess_username TEXT PRIMARY KEY,
    profile JSONB,
    rating_history JSONB,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);
