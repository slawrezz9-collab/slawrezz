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


-- =====================================================================
-- MIGRATION 003 — iade talepleri + misafir sipariş sorgulama
-- =====================================================================

create table if not exists iade_talepleri (
  id uuid primary key default gen_random_uuid(),
  siparis_id uuid not null references siparisler(id) on delete cascade,
  kullanici_id uuid references auth.users(id),
  tip text not null default 'iade',       -- iade | degisim
  sebep text not null,                    -- beden|kusurlu|urun_farkli|gec_teslim|vazgectim|diger
  aciklama text,
  kalemler jsonb not null default '[]',   -- kısmi iade: [{id, ad, beden, adet, birim}]
  tutar numeric(10,2) default 0,
  durum text not null default 'talep_edildi',
  yonetici_notu text,
  kargo_firma text,
  kargo_kodu text,                        -- satıcının verdiği anlaşmalı gönderi kodu
  kargo_takip text,                       -- müşterinin geri gönderim takip no
  created_at timestamptz default now(),
  guncellendi timestamptz default now()
);
create index if not exists iade_siparis_idx on iade_talepleri(siparis_id);
create index if not exists iade_durum_idx on iade_talepleri(durum, created_at desc);

alter table iade_talepleri enable row level security;
drop policy if exists "iade_oku" on iade_talepleri;
create policy "iade_oku" on iade_talepleri for select
  using (kullanici_id = auth.uid() or yonetici_mi());
drop policy if exists "iade_yonet" on iade_talepleri;
create policy "iade_yonet" on iade_talepleri for update using (yonetici_mi());
drop policy if exists "iade_sil" on iade_talepleri;
create policy "iade_sil" on iade_talepleri for delete using (yonetici_mi());
-- Müşteri tarafında talep açmanın tek yolu iade_talebi_ac RPC'si (doğrulama
-- orada yapılır). Yönetici, telefonla gelen talepleri panelden girebilsin diye
-- doğrudan ekleyebilir.
drop policy if exists "iade_ac_kapali" on iade_talepleri;
drop policy if exists "iade_ac_yonetici" on iade_talepleri;
create policy "iade_ac_yonetici" on iade_talepleri for insert with check (yonetici_mi());


-- KABA KUVVET KORUMASI -------------------------------------------------
-- Sipariş numarası tahmin edilebilir (SR-2026-00001, 00002...) ve tek sır
-- telefonun son 4 hanesi = 10.000 olasılık. Sadece gecikme yetmez, çünkü
-- paralel denenebilir. Bu yüzden sipariş numarası başına deneme kilidi var:
-- 15 dakikada 8 deneme  ->  10.000 olasılık için ~13 gün kesintisiz saldırı.
create table if not exists sorgu_denemeleri (
  anahtar text primary key,
  sayac int not null default 0,
  pencere_bas timestamptz not null default now()
);
alter table sorgu_denemeleri enable row level security;  -- policy yok = yalnız definer erişir

create or replace function _sorgu_izin(p_anahtar text) returns boolean
language plpgsql security definer set search_path = public as $fn$
declare d sorgu_denemeleri%rowtype;
begin
  insert into sorgu_denemeleri(anahtar) values (p_anahtar) on conflict (anahtar) do nothing;
  select * into d from sorgu_denemeleri where anahtar = p_anahtar for update;
  if now() - d.pencere_bas > interval '15 minutes' then
    update sorgu_denemeleri set sayac = 1, pencere_bas = now() where anahtar = p_anahtar;
    return true;
  end if;
  if d.sayac >= 8 then return false; end if;
  update sorgu_denemeleri set sayac = sayac + 1 where anahtar = p_anahtar;
  return true;
end $fn$;
revoke execute on function _sorgu_izin(text) from anon, authenticated;

-- Misafir sipariş sorgulama. RLS anonim kullanıcının siparisler tablosunu
-- okumasını tamamen engellediği için tek yol bu security definer RPC.
-- KİŞİSEL VERİ MASKELENİR: tam adres, tam telefon ve e-posta asla dönmez.
create or replace function siparis_sorgula(p_siparis_no text, p_tel_son4 text)
returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare s siparisler%rowtype; no text;
begin
  no := upper(trim(coalesce(p_siparis_no, '')));
  if no = '' or coalesce(p_tel_son4, '') !~ '^[0-9]{4}$' then return null; end if;
  if not _sorgu_izin(no) then return jsonb_build_object('kilit', true); end if;
  perform pg_sleep(0.4);   -- zamanlama saldırısını ve hızlı denemeyi yavaşlatır

  select * into s from siparisler
   where siparis_no = no
     and right(regexp_replace(telefon, '\D', '', 'g'), 4) = p_tel_son4;
  if not found then return null; end if;

  update sorgu_denemeleri set sayac = 0 where anahtar = no;   -- doğru sorguda kilidi sıfırla

  return jsonb_build_object(
    'id', s.id, 'siparis_no', s.siparis_no, 'created_at', s.created_at,
    'teslim_tarihi', s.teslim_tarihi, 'kargo_verildi', s.kargo_verildi,
    'durum', s.durum, 'kargo_firma', s.kargo_firma, 'kargo_takip', s.kargo_takip,
    'tutar', s.tutar, 'kargo', s.kargo, 'indirim', s.indirim, 'kalemler', s.kalemler,
    'ad', split_part(s.ad_soyad, ' ', 1) || ' ' ||
          left(coalesce(nullif(split_part(s.ad_soyad, ' ', 2), ''), '-'), 1) || '.',
    'sehir', s.sehir, 'ilce', s.ilce,
    'adres_maske', left(coalesce(s.adres, ''), 10) || '...',
    'telefon_maske', '0*** *** ' || p_tel_son4,
    'iadeler', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'durum', i.durum, 'tip', i.tip, 'sebep', i.sebep,
        'tutar', i.tutar, 'kalemler', i.kalemler, 'created_at', i.created_at,
        'kargo_kodu', i.kargo_kodu, 'kargo_firma', i.kargo_firma,
        'yonetici_notu', i.yonetici_notu))
      from iade_talepleri i where i.siparis_id = s.id), '[]'::jsonb)
  );
end $fn$;
grant execute on function siparis_sorgula(text, text) to anon, authenticated;

-- İade/değişim talebi aç. Tutar ve kalemler SUNUCUDA doğrulanır; istemcinin
-- gönderdiği fiyat yok sayılır, sadece siparişte gerçekten olan kalemler seçilebilir.
-- p_tel_son4 null gelirse üye kendi siparişi üzerinden talep açıyordur.
create or replace function iade_talebi_ac(
  p_siparis_no text, p_tel_son4 text,
  p_tip text, p_sebep text, p_aciklama text, p_kalemler jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare s siparisler%rowtype; t iade_talepleri%rowtype;
        no text; tut numeric := 0; k jsonb; ref jsonb;
        kalem_ok jsonb := '[]'::jsonb; adet int;
begin
  no := upper(trim(coalesce(p_siparis_no, '')));
  if p_tip not in ('iade', 'degisim') then raise exception 'tip_gecersiz'; end if;
  if p_sebep not in ('beden', 'kusurlu', 'urun_farkli', 'gec_teslim', 'vazgectim', 'diger')
    then raise exception 'sebep_gecersiz'; end if;

  if p_tel_son4 is null then
    if auth.uid() is null then raise exception 'dogrulama'; end if;
    select * into s from siparisler where siparis_no = no and kullanici_id = auth.uid();
  else
    if p_tel_son4 !~ '^[0-9]{4}$' then raise exception 'dogrulama'; end if;
    if not _sorgu_izin(no) then raise exception 'cok_deneme'; end if;
    select * into s from siparisler
     where siparis_no = no
       and right(regexp_replace(telefon, '\D', '', 'g'), 4) = p_tel_son4;
  end if;
  if not found then raise exception 'siparis_yok'; end if;

  if s.durum not in ('kargoda', 'teslim') then
    raise exception 'durum_uygun_degil'
      using hint = 'Bu sipariş için henüz iade talebi açılamaz.';
  end if;
  -- Cayma süresi: yasal 14 gün, sitede 15 güne kadar destek vaat ediliyor.
  if coalesce(s.teslim_tarihi, s.kargo_verildi, s.created_at) < now() - interval '15 days' then
    raise exception 'sure_doldu' using hint = 'İade süresi (15 gün) dolmuş.';
  end if;
  if exists (select 1 from iade_talepleri i where i.siparis_id = s.id
             and i.durum in ('talep_edildi', 'onaylandi', 'kargoda')) then
    raise exception 'acik_talep_var' using hint = 'Bu sipariş için zaten açık bir talebiniz var.';
  end if;

  for k in select * from jsonb_array_elements(coalesce(p_kalemler, '[]'::jsonb)) loop
    select value into ref from jsonb_array_elements(s.kalemler) value
     where value->>'id' = k->>'id'
       and coalesce(value->>'beden', '') = coalesce(k->>'beden', '') limit 1;
    if ref is null then raise exception 'kalem_gecersiz'; end if;
    adet := least(greatest(coalesce((k->>'adet')::int, 0), 0), (ref->>'adet')::int);
    if adet > 0 then
      tut := tut + (ref->>'birim')::numeric * adet;
      kalem_ok := kalem_ok || jsonb_build_array(jsonb_build_object(
        'id', ref->>'id', 'ad', ref->>'ad', 'beden', ref->>'beden',
        'adet', adet, 'birim', (ref->>'birim')::numeric));
    end if;
  end loop;
  if jsonb_array_length(kalem_ok) = 0 then
    raise exception 'kalem_secilmedi' using hint = 'En az bir ürün seçmelisiniz.';
  end if;

  insert into iade_talepleri (siparis_id, kullanici_id, tip, sebep, aciklama, kalemler, tutar)
  values (s.id, s.kullanici_id, p_tip, p_sebep,
          nullif(left(coalesce(p_aciklama, ''), 1000), ''), kalem_ok, tut)
  returning * into t;

  return jsonb_build_object('id', t.id, 'durum', t.durum, 'tutar', t.tutar,
                            'siparis_no', s.siparis_no, 'kalemler', t.kalemler);
end $fn$;
grant execute on function iade_talebi_ac(text, text, text, text, text, jsonb) to anon, authenticated;
