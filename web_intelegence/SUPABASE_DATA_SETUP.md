Run the SQL in [supabase/schema.sql](/D:/One-Mind/web_intelegence/supabase/schema.sql) inside the Supabase SQL Editor.

What it creates:
- `profiles`
- `user_sessions`
- `investigations`
- `source_clicks`
- `investigation_events`
- `feedback`
- `user_outcomes`
- `admin_user_meta`

What the app now does:
- Upserts a profile record when a user signs in
- Starts a tracked app session for each signed-in browser session
- Saves every investigation query before the backend request begins
- Updates the investigation with the final answer, verdict, sources, retries, and duration
- Tracks source clicks, copy/share actions, and saved feedback

Recommended next step after running the SQL:
- Open the app, sign in, run one investigation, click a source, and submit feedback
- Then check the Supabase Table Editor for the new rows
