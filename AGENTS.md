<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the event landing page as an editorial single-page experience at the index route; its content belongs to one event, not separate destinations.
- Use global semantic design tokens and shared Button variants for all event styling and actions to keep the visual identity consistent.
- Participation actions show confirmed event information until the organizer supplies an official registration destination; never simulate successful registrations.
- The organizer panel (`/painel`, list + CSV export of `team_registrations`) is gated by the shared-password gate in `src/lib/painel.functions.ts`: password in the `SITE_PASSWORD` server-only secret, timing-safe comparison, encrypted `useSession` cookie (`SESSION_SECRET`); registration data is read with the service-role client only inside the gated server function, never with public policies.
- AI duplicate detection (`detectAndBlockDuplicates` in painel.functions.ts → `src/lib/duplicates.server.ts`) runs only behind the painel gate, streams the AI Gateway Responses API server-side, and marks the newer entry `is_blocked` with `block_reason`; blocked rows are flagged, never deleted, so the organizer can review/unblock.
