-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS TABLE
create table public.users (
  id text primary key, -- Text to support both Auth UUIDs and Google generic IDs if needed (best to use UUID eventually but text is safe for migration)
  email text unique not null,
  name text,
  semester text,
  role text default 'student',
  is_disabled boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone,
  loyalty_points integer default 0,
  active_split_id text,
  pfp_url text
);

-- VENDORS TABLE
create table public.vendors (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  location text,
  cuisine text,
  origin_tag text,
  rush_level text check (rush_level in ('low', 'mid', 'high')),
  logo_url text,
  menu_image_urls text[], -- Array of strings
  contact_number text,
  lowest_item_price numeric,
  avg_price_per_meal numeric,
  popularity_score integer default 0,
  is_active boolean default true,
  rating_avg numeric default 0,
  rating_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone
);

-- REVIEWS TABLE
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  user_id text references public.users(id),
  vendor_id uuid references public.vendors(id),
  rating integer,
  review_text text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- MENU ITEMS TABLE
create table public.menu_items (
  id uuid default uuid_generate_v4() primary key,
  vendor_id uuid references public.vendors(id) on delete cascade,
  name text,
  price numeric,
  is_active boolean default true
);

-- MEAL SPLITS TABLE
create table public.meal_splits (
  id uuid default uuid_generate_v4() primary key,
  creator_id text references public.users(id),
  creator_name text,
  vendor_id uuid references public.vendors(id), -- Optional constraint?
  vendor_name text,
  dish_name text,
  total_price numeric,
  people_needed integer,
  people_joined_ids text[], -- Array of User IDs
  time_note text,
  split_time timestamp with time zone,
  is_closed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- CONVERSATIONS TABLE
create table public.conversations (
  id text primary key, -- "user1_user2"
  participants text[], -- Array of User IDs
  participant_details jsonb, -- Map of user details {id: {name, ...}}
  last_message jsonb, -- {content, sender_id, ...}
  unread_counts jsonb, -- {user_id: count}
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- MESSAGES TABLE
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id text references public.conversations(id) on delete cascade,
  sender_id text references public.users(id),
  receiver_id text references public.users(id),
  content text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- POLICIES (Simple Public Access for Development - WARNING: NOT SECURE)
-- In production, you must use RLS (Row Level Security)

alter table public.users enable row level security;
-- Users can see their own profile and others (needed for searching/viewing profiles)
create policy "Public profiles are viewable by everyone" on public.users for select using (true);
-- Users can update only their own profile
create policy "Users can update their own profile" on public.users for update using (auth.uid()::text = id);
-- Users can insert their own profile (on signup)
create policy "Users can insert their own profile" on public.users for insert with check (auth.uid()::text = id);


alter table public.vendors enable row level security;
-- Vendors are viewable by everyone
create policy "Vendors are viewable by everyone" on public.vendors for select using (true);
-- Only admins/service role can insert/update vendors (simplification: assume app logic handles admin check or manual DB management for now)
-- ideally: create policy "Admins can update vendors" ... 


alter table public.reviews enable row level security;
-- Reviews are viewable by everyone
create policy "Reviews are viewable by everyone" on public.reviews for select using (true);
-- Authenticated users can create reviews
create policy "Authenticated users can create reviews" on public.reviews for insert with check (auth.role() = 'authenticated');
-- Users can delete their own reviews (or admins)
create policy "Users can delete their own reviews" on public.reviews for delete using (auth.uid()::text = user_id);


alter table public.menu_items enable row level security;
create policy "Menu items are viewable by everyone" on public.menu_items for select using (true);


alter table public.meal_splits enable row level security;
-- Authenticated users can view splits
create policy "Authenticated users can view splits" on public.meal_splits for select using (auth.role() = 'authenticated');
-- Authenticated users can create splits
create policy "Authenticated users can create splits" on public.meal_splits for insert with check (auth.role() = 'authenticated');
-- SECURE: Only the creator can update their own split
create policy "Creators can update splits" 
on public.meal_splits 
for update 
using (auth.uid()::text = creator_id);
create policy "Creators can delete splits" on public.meal_splits for delete using (auth.uid()::text = creator_id);


alter table public.conversations enable row level security;
-- Users can view conversations they are a participant of
create policy "Users can view their conversations" on public.conversations for select using (auth.uid()::text = any(participants));
-- Users can insert conversations (start chat)
create policy "Users can create conversations" on public.conversations for insert with check (auth.role() = 'authenticated');
-- Users can update conversations (e.g. mark read, update last_message)
create policy "Users can update their conversations" on public.conversations for update using (auth.uid()::text = any(participants));


alter table public.messages enable row level security;
-- Users can view messages in conversations they belong to
-- (This requires a join or a check. For simplicity, we ensure sender/receiver matching as per table structure)
create policy "Users can view their messages" on public.messages for select using (
  auth.uid()::text = sender_id or auth.uid()::text = receiver_id
);
-- Users can send messages
create policy "Users can send messages" on public.messages for insert with check (auth.uid()::text = sender_id);


-- SPLIT JOIN REQUESTS TABLE (New Feature)
create table public.split_join_requests (
  id uuid default uuid_generate_v4() primary key,
  split_id uuid references public.meal_splits(id) on delete cascade,
  requester_id text references public.users(id),
  status text default 'pending', -- 'pending', 'accepted', 'rejected'
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(split_id, requester_id)
);

alter table public.split_join_requests enable row level security;
-- Users can view their own requests and requests for splits they created
create policy "Users can view relevant requests" on public.split_join_requests for select using (
  auth.uid()::text = requester_id or 
  exists (select 1 from public.meal_splits where id = split_id and creator_id = auth.uid()::text)
);
-- Users can create requests
create policy "Users can create requests" on public.split_join_requests for insert with check (auth.uid()::text = requester_id);
-- Creators can update status (accept/reject), Requesters can delete (cancel)
create policy "Creators can update requests" on public.split_join_requests for update using (
  exists (select 1 from public.meal_splits where id = split_id and creator_id = auth.uid()::text)
);
create policy "Requesters can delete requests" on public.split_join_requests for delete using (auth.uid()::text = requester_id);


-- Add request_id to messages to link chat with approval actions
alter table public.messages add column request_id uuid references public.split_join_requests(id);

-- Add category to menu_items
alter table public.menu_items add column category text;

-- Add is_recommended to menu_items
alter table public.menu_items add column is_recommended boolean default false;

