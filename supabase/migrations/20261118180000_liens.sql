-- Liens courts de liens.annecharlotte.be et leurs clics.
-- Rien de personnel : pas d'IP, pas de cookie, pas d'identifiant.
-- Seules les deux fonctions (go, tableau) touchent ces tables, avec la clé
-- de service ; le public (anon) n'a aucun droit direct.

create table public.liens (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{0,40}$'),
  destination text not null check (destination ~ '^https://'),
  nom         text not null check (length(nom) between 1 and 120),
  cree_le     timestamptz not null default now(),
  actif       boolean not null default true
);

create table public.clics (
  id        bigint generated always as identity primary key,
  slug      text not null references public.liens (slug) on update cascade on delete cascade,
  quand     timestamptz not null default now(),
  evenement text not null default 'clic' check (evenement in ('clic', 'telechargement')),
  source    text not null default 'Direct ou appli',
  appareil  text not null default 'Inconnu',
  pays      text not null default 'Inconnu'
);

create index clics_slug_quand on public.clics (slug, quand);

alter table public.liens enable row level security;
alter table public.clics enable row level security;
revoke all on public.liens, public.clics from anon, authenticated;

-- Tout le tableau de bord en un appel : par lien, les totaux, les clics par
-- jour (heure de Bruxelles), et la répartition source / appareil / pays.
create or replace function public.stats_liens()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with par_lien as (
    select
      li.slug, li.nom, li.destination, li.cree_le, li.actif,
      (select count(*) from public.clics c where c.slug = li.slug and c.evenement = 'clic') as clics,
      (select count(*) from public.clics c where c.slug = li.slug and c.evenement = 'telechargement') as telechargements,
      (select max(c.quand) from public.clics c where c.slug = li.slug and c.evenement = 'clic') as dernier_clic,
      (select coalesce(jsonb_object_agg(j.jour, j.n), '{}'::jsonb) from (
         select to_char(c.quand at time zone 'Europe/Brussels', 'YYYY-MM-DD') as jour, count(*) as n
         from public.clics c where c.slug = li.slug and c.evenement = 'clic' group by 1) j) as par_jour,
      (select coalesce(jsonb_object_agg(s.source, s.n), '{}'::jsonb) from (
         select c.source, count(*) as n
         from public.clics c where c.slug = li.slug and c.evenement = 'clic' group by 1) s) as sources,
      (select coalesce(jsonb_object_agg(a.appareil, a.n), '{}'::jsonb) from (
         select c.appareil, count(*) as n
         from public.clics c where c.slug = li.slug and c.evenement = 'clic' group by 1) a) as appareils,
      (select coalesce(jsonb_object_agg(p.pays, p.n), '{}'::jsonb) from (
         select c.pays, count(*) as n
         from public.clics c where c.slug = li.slug and c.evenement = 'clic' group by 1) p) as pays
    from public.liens li
  )
  select coalesce(jsonb_agg(to_jsonb(par_lien) order by par_lien.cree_le desc), '[]'::jsonb)
  from par_lien;
$$;

revoke execute on function public.stats_liens() from public, anon, authenticated;
