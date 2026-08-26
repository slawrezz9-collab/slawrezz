-- SLAW REZZ — Supabase şeması
-- Supabase Dashboard > SQL Editor'de tek seferde çalıştırın.

-- ÜRÜNLER ------------------------------------------------------------
create table if not exists urunler (
  id text primary key,
  ad text not null,
  kategori text,
  aciklama text,
  liste_fiyat numeric(10,2) default 0,
  satis_fiyat numeric(10,2) not null,
  gorseller jsonb default '[]',
  bedenler jsonb default '{}',
  ozellikler jsonb default '{}',
  toplam_stok integer default 0,
  aktif boolean default true,
  flas boolean default false,        -- ana sayfa flaş ürün vitrini
  trendyol_url text,
  sira integer default 0,
  created_at timestamptz default now()
);
alter table urunler add column if not exists flas boolean default false;
alter table urunler add column if not exists renk text;

-- SİPARİŞLER ---------------------------------------------------------
create table if not exists siparisler (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid references auth.users(id),
  ad_soyad text not null,
  telefon text not null,
  eposta text,
  adres text not null,
  sehir text,
  kalemler jsonb not null,          -- [{id, ad, beden, adet, birim}]
  tutar numeric(10,2) not null,
  kargo numeric(10,2) default 0,
  durum text default 'odeme_bekliyor',  -- odeme_bekliyor | odendi | hazirlaniyor | kargoda | teslim | iptal | iade
  kargo_takip text,
  kupon_kod text,
  indirim numeric(10,2) default 0,
  iyzico_token text,
  created_at timestamptz default now()
);

-- YORUMLAR (doğrulanmış alıcı sistemi) --------------------------------
create table if not exists yorumlar (
  id uuid primary key default gen_random_uuid(),
  urun_id text references urunler(id) on delete cascade,
  kullanici_id uuid references auth.users(id),
  siparis_id uuid references siparisler(id),
  puan smallint check (puan between 1 and 5),
  metin text,
  onayli boolean default false,      -- admin onayı sonrası görünür
  created_at timestamptz default now()
);

-- FATURALAR ------------------------------------------------------------
create table if not exists faturalar (
  no text primary key,               -- SR-2026-0001 (satış) / SRI-2026-0001 (iade)
  siparis_id uuid references siparisler(id),
  tip text not null default 'satis', -- satis | iade
  musteri text,
  tutar numeric(10,2) not null,
  created_at timestamptz default now()
);

-- OLAYLAR (ziyaret & gösterim sayacı) -----------------------------------
create table if not exists olaylar (
  id bigint generated always as identity primary key,
  tip text not null,                 -- sayfa | urun
  urun_id text,
  created_at timestamptz default now()
);

-- MAĞAZA AYARLARI (tasarım/yapılandırma) -------------------------------
create table if not exists ayarlar (
  anahtar text primary key,
  deger jsonb,
  updated_at timestamptz default now()
);

-- KUPONLAR ------------------------------------------------------------
create table if not exists kuponlar (
  kod text primary key,
  tip text not null default 'yuzde',   -- yuzde | tutar
  deger numeric(10,2) not null,
  min_sepet numeric(10,2) default 0,
  aktif boolean default true,
  created_at timestamptz default now()
);
-- SORU & CEVAP (satıcıya soru sor) ------------------------------------
create table if not exists sorular (
  id uuid primary key default gen_random_uuid(),
  urun_id text references urunler(id) on delete cascade,
  kullanici_id uuid references auth.users(id),
  soru text not null,
  cevap text,
  yayinda boolean default false,     -- yanıtlanıp yayınlanınca herkese görünür
  created_at timestamptz default now(),
  cevap_tarihi timestamptz
);

-- YÖNETİCİLER ---------------------------------------------------------
create table if not exists yoneticiler (
  kullanici_id uuid primary key references auth.users(id)
);

create or replace function yonetici_mi() returns boolean
language sql stable security definer as
$$ select exists(select 1 from yoneticiler where kullanici_id = auth.uid()) $$;

-- RLS -----------------------------------------------------------------
alter table urunler enable row level security;
alter table siparisler enable row level security;
alter table yorumlar enable row level security;
alter table yoneticiler enable row level security;

-- Ürünler: herkes okur, sadece yönetici yazar
create policy "urun_oku" on urunler for select using (true);
create policy "urun_yaz" on urunler for all using (yonetici_mi());

-- Siparişler: herkes sipariş oluşturabilir (üyeliksiz alışveriş);
-- kullanıcı yalnız kendi siparişini, yönetici hepsini görür
create policy "siparis_olustur" on siparisler for insert with check (true);
create policy "siparis_oku" on siparisler for select
  using (kullanici_id = auth.uid() or yonetici_mi());
create policy "siparis_guncelle" on siparisler for update using (yonetici_mi());

-- Yorumlar: onaylılar herkese açık; yazma = o ürünü içeren teslim edilmiş
-- siparişi olan üye; yönetim = yönetici
create policy "yorum_oku" on yorumlar for select using (onayli or yonetici_mi());
create policy "yorum_yaz" on yorumlar for insert with check (
  auth.uid() = kullanici_id and exists (
    select 1 from siparisler s
    where s.id = siparis_id and s.kullanici_id = auth.uid()
      and s.durum in ('teslim', 'kargoda', 'odendi')
      and s.kalemler @> jsonb_build_array(jsonb_build_object('id', urun_id))
  )
);
create policy "yorum_yonet" on yorumlar for update using (yonetici_mi());

-- Sorular: yayındakiler herkese açık; soran kendi sorusunu görür;
-- soru sormak üyelik ister; yanıtlama yönetici işi
alter table sorular enable row level security;
create policy "soru_oku" on sorular for select
  using (yayinda or kullanici_id = auth.uid() or yonetici_mi());
create policy "soru_sor" on sorular for insert
  with check (auth.uid() = kullanici_id);
create policy "soru_yanit" on sorular for update using (yonetici_mi());
create policy "soru_sil" on sorular for delete using (yonetici_mi());

-- Faturalar: yalnız yönetici
alter table faturalar enable row level security;
create policy "fatura_yonet" on faturalar for all using (yonetici_mi());

-- Olaylar: herkes kayıt ekleyebilir (anonim sayaç), yalnız yönetici okur
alter table olaylar enable row level security;
create policy "olay_ekle" on olaylar for insert with check (true);
create policy "olay_oku" on olaylar for select using (yonetici_mi());

-- Ayarlar: herkes okur (site teması), yalnız yönetici yazar
alter table ayarlar enable row level security;
create policy "ayar_oku" on ayarlar for select using (true);
create policy "ayar_yaz" on ayarlar for all using (yonetici_mi());

-- Kuponlar: aktif kuponu herkes okuyabilir (sepette doğrulama), yönetim yönetici işi
alter table kuponlar enable row level security;
create policy "kupon_oku" on kuponlar for select using (aktif or yonetici_mi());
create policy "kupon_yonet" on kuponlar for all using (yonetici_mi());

create policy "yonetici_oku" on yoneticiler for select using (kullanici_id = auth.uid());

-- İlk yöneticiyi eklemek için (kendi user id'nizle, SQL Editor'den):
-- insert into yoneticiler values ('AUTH-USER-UUID');


-- =====================================================================
-- MIGRATION 001 — sipariş numarası + güvenli sipariş oluşturma
-- Bu blok idempotenttir; tekrar çalıştırılabilir.
--
-- NEDEN: Eskiden istemci siparişi doğrudan INSERT ediyor ve `tutar` alanını
-- kendisi gönderiyordu. "siparis_olustur" politikası with check (true) olduğu
-- için anon anahtarla tutar=1 gönderip sepeti 1 TL'ye ödemek mümkündü.
-- Ayrıca .insert().select() misafirde RLS'e takılıp satır döndürmüyordu
-- (kullanici_id = auth.uid() → null = null → NULL → false), yani üyeliksiz
-- alışveriş hiç çalışmıyordu. İkisini de bu RPC çözüyor.
-- =====================================================================

alter table siparisler add column if not exists siparis_no text;
alter table siparisler add column if not exists ilce text;
alter table siparisler add column if not exists teslim_tarihi timestamptz;

create sequence if not exists siparis_no_seq start 1;

-- İstemci ne gönderirse göndersin numarayı sunucu belirler.
create or replace function siparis_no_ata() returns trigger
language plpgsql as $$
begin
  new.siparis_no := 'SR-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('siparis_no_seq')::text, 5, '0');
  return new;
end $$;

drop trigger if exists trg_siparis_no on siparisler;
create trigger trg_siparis_no before insert on siparisler
  for each row execute function siparis_no_ata();

update siparisler set siparis_no = 'SR-' || to_char(created_at, 'YYYY') || '-' ||
  lpad(nextval('siparis_no_seq')::text, 5, '0') where siparis_no is null;

create unique index if not exists siparisler_siparis_no_key on siparisler(siparis_no);

-- Siparişi SUNUCUDA oluştur: fiyat, kargo ve kupon indirimi burada hesaplanır.
-- İstemci yalnızca hangi üründen kaç adet istediğini söyler.
create or replace function siparis_olustur(
  p_ad_soyad text, p_telefon text, p_eposta text,
  p_adres text, p_sehir text, p_ilce text,
  p_kalemler jsonb,               -- [{id, beden, adet}] — FİYAT YOK
  p_kupon text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k jsonb; u urunler%rowtype; ara numeric := 0; kargo numeric := 0;
  ind numeric := 0; kup kuponlar%rowtype; kalem_liste jsonb := '[]'::jsonb;
  ayar jsonb; yeni siparisler%rowtype; adet int;
begin
  if p_ad_soyad is null or length(trim(p_ad_soyad)) < 3 then
    raise exception 'ad_gecersiz' using hint = 'Ad soyad en az 3 karakter olmalı.';
  end if;
  if regexp_replace(coalesce(p_telefon,''), '\D', '', 'g') !~ '^[0-9]{10,11}$' then
    raise exception 'telefon_gecersiz' using hint = 'Geçerli bir telefon numarası girin.';
  end if;
  if p_adres is null or length(trim(p_adres)) < 10 then
    raise exception 'adres_gecersiz' using hint = 'Teslimat adresi çok kısa.';
  end if;
  if jsonb_array_length(coalesce(p_kalemler,'[]'::jsonb)) = 0 then
    raise exception 'sepet_bos';
  end if;
  if jsonb_array_length(p_kalemler) > 50 then raise exception 'sepet_buyuk'; end if;

  -- Fiyatlar ürün tablosundan okunur; istemcinin gönderdiği fiyat yok sayılır.
  for k in select * from jsonb_array_elements(p_kalemler) loop
    select * into u from urunler where id = k->>'id' and aktif;
    if not found then
      raise exception 'urun_yok' using hint = 'Sepetinizdeki bir ürün artık satışta değil.';
    end if;
    adet := greatest(1, least(20, coalesce((k->>'adet')::int, 1)));
    ara := ara + u.satis_fiyat * adet;
    kalem_liste := kalem_liste || jsonb_build_array(jsonb_build_object(
      'id', u.id, 'ad', u.ad, 'beden', k->>'beden',
      'adet', adet, 'birim', u.satis_fiyat));
  end loop;

  -- Kargo: mağaza ayarlarından, yoksa varsayılan (1500 üzeri ücretsiz / 79,90)
  select deger into ayar from ayarlar where anahtar = 'site';
  if ara < coalesce((ayar->>'kargoLimit')::numeric, 1500) then
    kargo := coalesce((ayar->>'kargoUcreti')::numeric, 79.90);
  end if;

  -- Kupon da sunucuda doğrulanır (istemcideki kuponDogrula ile aynı formül)
  if p_kupon is not null and length(trim(p_kupon)) > 0 then
    select * into kup from kuponlar where upper(kod) = upper(trim(p_kupon)) and aktif;
    if found and ara >= coalesce(kup.min_sepet, 0) then
      ind := round(case when kup.tip = 'yuzde' then ara * kup.deger / 100
                        else least(kup.deger, ara) end, 2);
    end if;
  end if;

  insert into siparisler (ad_soyad, telefon, eposta, adres, sehir, ilce,
                          kalemler, tutar, kargo, kupon_kod, indirim,
                          durum, kullanici_id)
  values (trim(p_ad_soyad), p_telefon, nullif(trim(coalesce(p_eposta,'')), ''),
          trim(p_adres), nullif(trim(coalesce(p_sehir,'')), ''),
          nullif(trim(coalesce(p_ilce,'')), ''),
          kalem_liste, ara + kargo - ind, kargo,
          case when ind > 0 then upper(trim(p_kupon)) end, ind,
          'odeme_bekliyor', auth.uid())
  returning * into yeni;

  return jsonb_build_object('id', yeni.id, 'siparis_no', yeni.siparis_no,
                            'tutar', yeni.tutar, 'kargo', yeni.kargo,
                            'indirim', yeni.indirim, 'araToplam', ara);
end $$;

grant execute on function siparis_olustur(text,text,text,text,text,text,jsonb,text)
  to anon, authenticated;

-- Doğrudan INSERT kapatılır; sipariş oluşturmanın tek yolu artık RPC.
drop policy if exists "siparis_olustur" on siparisler;
drop policy if exists "siparis_olustur_kapali" on siparisler;
create policy "siparis_olustur_kapali" on siparisler for insert with check (false);


-- FATURA NUMARASI ------------------------------------------------------
-- Eskiden numara istemcide sayılarak üretiliyordu (hepsi.filter(...).length+1);
-- iki yönetici aynı anda fatura keserse aynı numarayı alıyordu.
create sequence if not exists fatura_no_satis_seq start 1;
create sequence if not exists fatura_no_iade_seq  start 1;

create or replace function fatura_no_al(p_tip text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not yonetici_mi() then raise exception 'yetkisiz'; end if;
  return case when p_tip = 'iade'
    then 'SRI-' || to_char(now(),'YYYY') || '-' || lpad(nextval('fatura_no_iade_seq')::text, 4, '0')
    else 'SR-'  || to_char(now(),'YYYY') || '-' || lpad(nextval('fatura_no_satis_seq')::text, 4, '0')
  end;
end $$;
grant execute on function fatura_no_al(text) to authenticated;


-- =====================================================================
-- MIGRATION 002 — kargo alanları
-- =====================================================================
alter table siparisler add column if not exists kargo_firma text;
alter table siparisler add column if not exists kargo_verildi timestamptz;
alter table siparisler add column if not exists desi numeric(6,2);
create index if not exists siparisler_durum_idx on siparisler(durum, created_at desc);
