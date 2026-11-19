-- Version « un lien par contenu, toutes plateformes ».
-- 1. Les pages d'arrivée (lead magnets, accompagnement…) deviennent une liste
--    qu'Anne-Charlotte complète elle-même depuis /stats/.
-- 2. Chaque lien sait sa page, sa plateforme et son contenu (titre de la
--    vidéo ou du post) ; les nouveaux liens ont la forme page/id (ex.
--    accompagnement/b3a1p). Les anciens liens gardent leur adresse.
-- 3. Au-delà du clic : PDF téléchargé, clic vers RDV, clic WhatsApp.

create table public.destinations (
  id      text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,30}$'),
  nom     text not null check (length(nom) between 1 and 80),
  adresse text not null check (adresse ~ '^https://'),
  cree_le timestamptz not null default now()
);
alter table public.destinations enable row level security;
revoke all on public.destinations from anon, authenticated;

alter table public.liens drop constraint liens_slug_check;
alter table public.liens add constraint liens_slug_check
  check (slug ~ '^[a-z0-9][a-z0-9-]{0,40}(/[a-z0-9]{3,12})?$');
alter table public.liens
  add column destination_id text references public.destinations (id) on update cascade on delete set null,
  add column plateforme text,
  add column contenu text check (contenu is null or length(contenu) <= 160);

alter table public.clics drop constraint clics_evenement_check;
alter table public.clics add constraint clics_evenement_check
  check (evenement in ('clic', 'telechargement', 'rdv', 'whatsapp'));
-- utm_campaign reçue dans l'adresse du lien (ex. ?utm_campaign=…), s'il y en a une.
alter table public.clics add column campagne text;

-- Ses pages d'aujourd'hui.
insert into public.destinations (id, nom, adresse) values
  ('bingo',          'Bingo · 10 actions sans plan alimentaire', 'https://www.annecharlotte.be/bingo/'),
  ('accompagnement', 'Accompagnement (tarifs)',                  'https://www.annecharlotte.be/accompagnement/#titre-tarifs'),
  ('rdv',            'Prendre RDV (bilan)',                      'https://www.annecharlotte.be/bilan/'),
  ('et-toi',         '« Et toi, dans tout ça ? »',               'https://www.annecharlotte.be/formations/et-toi/'),
  ('novembre',       'Mes légumes de novembre',                  'https://www.annecharlotte.be/novembre/'),
  ('lunchbox',       'Lunchbox',                                 'https://www.annecharlotte.be/lunchbox/'),
  ('site',           'Mon site (accueil)',                       'https://www.annecharlotte.be/'),
  ('nutriciens',     'Nutriciens',                               'https://www.nutriciens.com/');

-- Ses liens existants : rangés sous leur page, adresses inchangées.
update public.liens set destination_id = 'bingo', plateforme = 'youtube', contenu = 'Plans alimentaires'
  where slug = 'bingo';
update public.liens set destination_id = 'accompagnement', plateforme = 'youtube', contenu = null
  where slug = 'youtube-accompagnement';
update public.liens set destination_id = 'nutriciens', plateforme = 'youtube', contenu = null
  where slug = 'youtube-nutriciens';
-- accompagnement-b3ab pointait vers un autre lien court (double saut, clic
-- compté deux fois) : il va maintenant droit à la page, avec ses UTM.
update public.liens set destination_id = 'accompagnement', plateforme = 'youtube',
  contenu = 'La psychologie des repas ennuyeux',
  destination = 'https://www.annecharlotte.be/accompagnement/?utm_source=youtube&utm_medium=video&utm_campaign=la-psychologie-des-repas-ennuyeux&utm_content=accompagnement-b3ab#titre-tarifs'
  where slug = 'accompagnement-b3ab';

-- Le tableau de bord en un appel : les pages, et pour chaque lien ses
-- totaux par acte, ses clics par jour et ses répartitions.
create or replace function public.stats_liens()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with par_lien as (
    select
      li.slug, li.nom, li.destination, li.cree_le, li.actif,
      li.destination_id, li.plateforme, li.contenu,
      count(c.id) filter (where c.evenement = 'clic')           as clics,
      count(c.id) filter (where c.evenement = 'telechargement') as telechargements,
      count(c.id) filter (where c.evenement = 'rdv')            as rdv,
      count(c.id) filter (where c.evenement = 'whatsapp')       as whatsapp,
      max(c.quand) filter (where c.evenement = 'clic')          as dernier_clic
    from public.liens li
    left join public.clics c on c.slug = li.slug
    group by li.slug
  ),
  repartitions as (
    select
      p.slug,
      (select coalesce(jsonb_object_agg(j.jour, j.n), '{}'::jsonb) from (
         select to_char(c.quand at time zone 'Europe/Brussels', 'YYYY-MM-DD') as jour, count(*) as n
         from public.clics c where c.slug = p.slug and c.evenement = 'clic' group by 1) j) as par_jour,
      (select coalesce(jsonb_object_agg(s.source, s.n), '{}'::jsonb) from (
         select c.source, count(*) as n
         from public.clics c where c.slug = p.slug and c.evenement = 'clic' group by 1) s) as sources,
      (select coalesce(jsonb_object_agg(a.appareil, a.n), '{}'::jsonb) from (
         select c.appareil, count(*) as n
         from public.clics c where c.slug = p.slug and c.evenement = 'clic' group by 1) a) as appareils,
      (select coalesce(jsonb_object_agg(x.pays, x.n), '{}'::jsonb) from (
         select c.pays, count(*) as n
         from public.clics c where c.slug = p.slug and c.evenement = 'clic' group by 1) x) as pays,
      (select coalesce(jsonb_object_agg(k.campagne, k.n), '{}'::jsonb) from (
         select c.campagne, count(*) as n
         from public.clics c where c.slug = p.slug and c.evenement = 'clic' and c.campagne is not null group by 1) k) as campagnes
    from par_lien p
  )
  select jsonb_build_object(
    'liens', coalesce((
      select jsonb_agg(to_jsonb(p) || to_jsonb(r) order by p.cree_le desc)
      from par_lien p join repartitions r on r.slug = p.slug), '[]'::jsonb),
    'destinations', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.cree_le, d.nom) from public.destinations d), '[]'::jsonb)
  );
$$;

revoke execute on function public.stats_liens() from public, anon, authenticated;
