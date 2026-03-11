-- CoupleQuest — Schéma Supabase
-- À exécuter dans l'éditeur SQL de Supabase

create extension if not exists "uuid-ossp";

-- Users
create table if not exists users (
  id            uuid primary key default uuid_generate_v4(),
  prenom        text not null,
  email         text not null unique,
  password_hash text not null,
  photo_url     text,
  created_at    timestamptz default now()
);

-- Couples
create table if not exists couples (
  id         uuid primary key default uuid_generate_v4(),
  code       text not null unique,
  user1_id   uuid references users(id) on delete cascade,
  user2_id   uuid references users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Answers
create table if not exists answers (
  id          uuid primary key default uuid_generate_v4(),
  couple_id   uuid references couples(id) on delete cascade,
  user_id     uuid references users(id) on delete cascade,
  question_id text not null,
  answer      text,
  created_at  timestamptz default now(),
  unique(couple_id, user_id, question_id)
);

-- Letters
create table if not exists letters (
  id           uuid primary key default uuid_generate_v4(),
  couple_id    uuid references couples(id) on delete cascade,
  from_user_id uuid references users(id) on delete cascade,
  content      text,
  created_at   timestamptz default now(),
  unique(couple_id, from_user_id)
);

-- RLS
alter table users    enable row level security;
alter table couples  enable row level security;
alter table answers  enable row level security;
alter table letters  enable row level security;

create policy "Users can read basic info" on users
  for select using (true);

create policy "Users can update their own profile" on users
  for update using (auth.uid() = id);

create policy "Couple members can read" on couples
  for select using (auth.uid() = user1_id or auth.uid() = user2_id);
