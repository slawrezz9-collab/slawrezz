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
