# Pronexus — Supabase setup

Do these **once** in your Supabase dashboard to bring the database online. ~5 minutes.

Your project: `https://vrwllkxqfwxaadipbqed.supabase.co`

---

## 1. Create the table + security rules

Dashboard → **SQL Editor** → **New query** → paste the block below → **Run**.

```sql
-- One row per appraisal scheme; the whole project object lives in `data`.
create table if not exists public.projects (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists projects_updated_idx on public.projects (updated_at desc);

-- Row-Level Security: shared team workspace.
-- Any signed-in user can read & write every scheme; the public anon key alone
-- (with no session) can do nothing.
alter table public.projects enable row level security;

drop policy if exists "team read"   on public.projects;
drop policy if exists "team insert" on public.projects;
drop policy if exists "team update" on public.projects;
drop policy if exists "team delete" on public.projects;

create policy "team read"   on public.projects for select to authenticated using (true);
create policy "team insert" on public.projects for insert to authenticated with check (true);
create policy "team update" on public.projects for update to authenticated using (true) with check (true);
create policy "team delete" on public.projects for delete to authenticated using (true);
```

---

## 2. Turn on email login (open sign-up, no confirmation)

Dashboard → **Authentication** → **Sign In / Providers** (or **Providers**):

- **Email** provider → **Enabled**.
- **Confirm email** → **OFF**  *(you chose “log in immediately”).*
- Allow new users to sign up → **ON**  *(usually under Authentication → Sign In / Up → User Signups).*

---

## 3. Point auth at your live site

Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `https://miraj-amin.github.io/Pronexus/`
- **Redirect URLs:** add `https://miraj-amin.github.io/Pronexus/`
  *(optional, for local testing also add `http://localhost:3000` or wherever you preview)*

---

## 4. Publish on GitHub Pages

1. Put the contents of the `appraisal/` folder into your `Pronexus` repo.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → pick your branch + root → **Save**.
3. After a minute the site is live at **`https://miraj-amin.github.io/Pronexus/North Gate Appraisal Tool.html`**
   *(rename the HTML to `index.html` if you want the bare folder URL to load it directly).*

---

## What happens on first load

- You’ll see a **sign-in screen**. Create an account → you’re straight in (no email step).
- The **first** person to load an empty database auto-seeds the 3 demo schemes (Walnut Marches, Cedar Rise, Quarry Fields). After that it never re-seeds.
- Everyone who signs in shares the **same** schemes and edits live to the same database.

## Notes & safety

- The key in `supabaseClient.js` is the **publishable / anon** key — safe to ship publicly. Your data is guarded by the RLS policies above, not by hiding the key.
- **Never** put the `service_role` secret key in these files.
- Edits save automatically as you type (optimistic — the screen updates instantly, the write follows). A red bar appears at the top if a save ever fails.
- To wipe demo data and start clean: delete the rows in **Table Editor → projects**.
