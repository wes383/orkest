-- Run this migration to drop the item search embeddings table.
-- The embeddings feature has been removed in favor of Fuse.js fuzzy search.
-- Memory embeddings (ai_user_memory.embedding) are unaffected.

DROP TABLE IF EXISTS public.embeddings;
