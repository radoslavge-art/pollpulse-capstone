# PollPulse project instructions

PollPulse is a multi-page JavaScript application built with Vite, Bootstrap, and Supabase. Do not introduce React, Vue, TypeScript, or a client-side router.

- Keep every screen as a separate HTML file in `src/`.
- Place reusable browser logic in `src/js/`; keep rendering and API calls separate.
- Use Supabase Auth and database queries through `src/js/supabase.js` only.
- Never put Supabase service-role credentials in the browser. The app uses only the publishable anon key.
- Enforce permissions in Supabase RLS policies, not only in UI checks.
- Run `npm run build` after changing application code.
