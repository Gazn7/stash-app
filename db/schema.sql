create table if not exists users (
  uid text primary key,
  name text not null,
  username text unique not null,
  password text not null,
  balance numeric not null default 100,
  escrow numeric not null default 0,
  last_seen bigint
);

create table if not exists groups (
  id text primary key,
  name text not null,
  icon text,
  creator_uid text references users(uid) on delete set null,
  created_at bigint not null
);

create table if not exists group_members (
  group_id text not null references groups(id) on delete cascade,
  uid text not null references users(uid) on delete cascade,
  name text not null,
  primary key (group_id, uid)
);

create table if not exists challenges (
  id text primary key,
  title text,
  amount numeric not null default 0,
  challenger_uid text,
  challenger_name text,
  challenged_uid text,
  challenged_name text,
  status text not null default 'pending',
  timer_start bigint,
  timeout integer,
  created_at bigint,
  winner_uid text,
  type text not null default '1v1'
);

create table if not exists challenge_votes (
  challenge_id text not null,
  voter_uid text not null,
  winner_uid text not null,
  primary key (challenge_id, voter_uid)
);

create table if not exists history (
  id text primary key,
  title text,
  amount numeric not null default 0,
  challenger_uid text,
  challenger_name text,
  challenged_uid text,
  challenged_name text,
  winner_uid text,
  status text not null,
  created_at bigint not null
);

create index if not exists users_username_idx on users(username);
create index if not exists group_members_uid_idx on group_members(uid);
create index if not exists history_created_at_idx on history(created_at desc);
create index if not exists challenge_votes_challenge_id_idx on challenge_votes(challenge_id);
