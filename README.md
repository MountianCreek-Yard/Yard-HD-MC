# Yard Manager

A yard management website: yard map with doors and spots, trailer log with check-in,
completion and check-out times, 24-hour red flag, daily yard check, and Excel export.
It is plain HTML, so there is nothing to build or install.

Files: `index.html` (the app), `config.js` (your settings), `storage.js` (saving),
`supabase-setup.sql` (database setup).

## Option A: one computer only (2 minutes)
1. Put these files in a GitHub repository.
2. Repository > Settings > Pages > Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`. Save.
3. After a minute your site is at `https://YOUR-NAME.github.io/YOUR-REPO/`.

Data is saved in each browser separately, so other computers will not see it.

## Option B: shared between computers (about 10 minutes)
1. Create a free project at https://supabase.com.
2. In the project, open SQL Editor > New query, paste `supabase-setup.sql`, and press Run.
3. Open Project Settings > API. Copy the Project URL and the `anon public` key.
4. Paste them into `config.js`, commit, and wait for GitHub Pages to update.
5. Open the site. The top line should say "Shared across computers: live".
   If you already entered data in a browser, it offers to copy it into the shared database. Accept once only.

Changes from other computers appear within about 10 seconds.

## Security
The anon key is visible to anyone who opens the site, and the setup lets that key read and write
the yard data. Treat the site address as private, use a private repo with a host that supports
private sites if you can, and do not store anything sensitive. To lock it to named users, add
Supabase Auth and change the policy to `to authenticated`.

## Notes
- Door names are D-01 to D-130 and yard spots Y-01 onward. Change counts under "Set up my layout".
- The in-progress daily check stays on the computer where it was started; finished checks are shared.
- Export to Excel needs internet access to load the Excel library from cdnjs.
