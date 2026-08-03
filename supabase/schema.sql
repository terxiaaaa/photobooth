create table if not exists public.rooms (
  code text primary key check (char_length(code) = 6),
  layout text not null check (layout in ('vertical', 'grid')),
  theme text not null check (theme in ('dark', 'light', 'color', 'mix')),
  color1 text,
  color2 text,
  host_photos jsonb not null default '[]'::jsonb,
  guest_photos jsonb not null default '[]'::jsonb,
  texts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- untuk tabel rooms yang sudah ada (update, bukan buat baru)
alter table public.rooms add column if not exists color1 text;
alter table public.rooms add column if not exists color2 text;
alter table public.rooms add column if not exists texts jsonb not null default '[]'::jsonb;
alter table public.rooms drop constraint if exists rooms_theme_check;
alter table public.rooms add constraint rooms_theme_check check (theme in ('dark', 'light', 'color', 'mix'));

alter table public.rooms enable row level security;
drop policy if exists "rooms public read" on public.rooms;
create policy "rooms public read" on public.rooms for select using (true);
drop policy if exists "rooms public create" on public.rooms;
create policy "rooms public create" on public.rooms for insert with check (true);
drop policy if exists "rooms public update" on public.rooms;
create policy "rooms public update" on public.rooms for update using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then
  null;
end $$;
