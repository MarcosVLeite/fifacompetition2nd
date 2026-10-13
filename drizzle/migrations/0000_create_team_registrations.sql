CREATE TABLE public.team_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_name TEXT NOT NULL,
  player2_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_cna_student BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.team_registrations TO anon;
GRANT ALL ON public.team_registrations TO service_role;

ALTER TABLE public.team_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can register a team"
ON public.team_registrations
FOR INSERT
TO anon
WITH CHECK (true);