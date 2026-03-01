-- create shift_templates table
create table public.shift_templates (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    start_time time not null,
    end_time time not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- enable RLS
alter table public.shift_templates enable row level security;

-- create RLS policies
create policy "Allow all users to read shift_templates" on public.shift_templates for select using (true);
create policy "Allow users to insert shift_templates" on public.shift_templates for insert with check (true);
create policy "Allow users to update shift_templates" on public.shift_templates for update using (true);
create policy "Allow users to delete shift_templates" on public.shift_templates for delete using (true);
