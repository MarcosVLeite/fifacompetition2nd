DROP POLICY "Anyone can register a team" ON public.team_registrations;

CREATE POLICY "Anyone can register a team"
ON public.team_registrations
FOR INSERT
TO anon
WITH CHECK (
  char_length(trim(player1_name)) BETWEEN 3 AND 100
  AND char_length(trim(player2_name)) BETWEEN 3 AND 100
  AND char_length(regexp_replace(phone, '\D', '', 'g')) BETWEEN 10 AND 13
  AND is_blocked = false
  AND block_reason IS NULL
);