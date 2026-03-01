-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS TABLE (Extends Supabase Auth Auth.users)
create table public.users (
  id uuid references auth.users not null primary key,
  email text not null,
  role text not null check (role in ('admin', 'caregiver')) default 'caregiver',
  full_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.users enable row level security;

-- SHIFTS TABLE
create table public.shifts (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  assigned_to uuid references public.users(id),
  is_open boolean default true not null,
  date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.shifts enable row level security;

-- AVAILABILITY TABLE
create table public.availability (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  date date not null,
  status text not null check (status in ('available', 'unavailable')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.availability enable row level security;

-- TIME OFF REQUESTS TABLE
create table public.time_off_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('pending', 'approved', 'denied')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.time_off_requests enable row level security;

-- RESPONSIBILITIES TABLE
create table public.responsibilities (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text not null,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.responsibilities enable row level security;

-- MESSAGES TABLE (realtime)
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  author_id uuid references public.users(id) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.messages enable row level security;

-- SHIFT TRADES TABLE
create table public.shift_trades (
  id uuid default uuid_generate_v4() primary key,
  shift_id uuid references public.shifts(id) not null,
  requested_by uuid references public.users(id) not null,
  proposed_to uuid references public.users(id),
  status text not null check (status in ('pending', 'approved', 'denied')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.shift_trades enable row level security;


-- ROW LEVEL SECURITY POLICIES

-- Users: Anyone can read profiles. Users can update their own profile.
create policy "Users can view all users" on public.users for select using (true);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Shifts: Anyone can read. Only admins can insert/update/delete.
create policy "Anyone can read shifts" on public.shifts for select using (true);
create policy "Admins can manage shifts" on public.shifts for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Availability: Users can read all (to see who is free). Users can only insert/update their own.
create policy "Anyone can read availability" on public.availability for select using (true);
create policy "Users can manage own availability" on public.availability for all using (auth.uid() = user_id);

-- Time Off: Admins can read all. Users can read their own. Users can insert their own. Admins can update.
create policy "Admins can read all time off" on public.time_off_requests for select using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
create policy "Users can read own time off" on public.time_off_requests for select using (auth.uid() = user_id);
create policy "Users can insert own time off" on public.time_off_requests for insert with check (auth.uid() = user_id);
create policy "Admins can update time off" on public.time_off_requests for update using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Responsibilities: Anyone can read. Only admins can insert/update/delete.
create policy "Anyone can read responsibilities" on public.responsibilities for select using (true);
create policy "Admins can manage responsibilities" on public.responsibilities for all using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Messages: Anyone can read. Anyone can insert (with their own author_id).
create policy "Anyone can read messages" on public.messages for select using (true);
create policy "Users can insert messages" on public.messages for insert with check (auth.uid() = author_id);

-- Shift Trades: Anyone can read. Users can insert if they are assigned to the shift. Admins can update status.
create policy "Anyone can read shift trades" on public.shift_trades for select using (true);
create policy "Users can insert trades" on public.shift_trades for insert with check (auth.uid() = requested_by);
create policy "Admins can update trades" on public.shift_trades for update using (
  exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- Realtime Setup
alter publication supabase_realtime add table public.messages;
