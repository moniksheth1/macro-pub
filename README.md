# health squad

Track steps, calories, protein, sat fat, and weight with your friends.

## Setup

### 1. Supabase — create the table

In your Supabase project, go to **SQL Editor** and run:

```sql
create table users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  goals jsonb default '{}',
  color_idx integer default 0,
  created_at timestamptz default now()
);

create table logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade,
  date date not null,
  steps numeric,
  calories numeric,
  protein numeric,
  sat_fat numeric,
  weight numeric,
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table users enable row level security;
alter table logs enable row level security;

create policy "public read users" on users for select using (true);
create policy "public insert users" on users for insert with check (true);
create policy "public read logs" on logs for select using (true);
create policy "public insert logs" on logs for insert with check (true);
create policy "public update logs" on logs for update using (true);
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in your Supabase URL and anon key (found in Project Settings → API).

### 3. Vercel deployment

In Vercel, add these environment variables:
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`

### 4. Local dev

```
npm install
npm start
```
