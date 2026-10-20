CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando','em_andamento','finalizado')),
  participant_ids uuid[] NOT NULL DEFAULT '{}',
  bracket jsonb NOT NULL DEFAULT '{"matches":[]}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;