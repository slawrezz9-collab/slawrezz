# -*- coding: utf-8 -*-
"""veri/urunler.json içeriğini Supabase 'urunler' tablosuna yükler.

Kullanım:
  set SUPABASE_URL=https://xxxx.supabase.co
  set SUPABASE_SERVICE_KEY=...   (Settings > API > service_role — gizli tutun)
  python supabase/urunleri_yukle.py
"""
import json
import os
import sys

import requests

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not URL or not KEY:
    sys.exit("SUPABASE_URL ve SUPABASE_SERVICE_KEY ortam değişkenlerini ayarlayın.")

kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(kok, "veri", "urunler.json"), encoding="utf-8") as f:
    modeller = json.load(f)["modeller"]

satirlar = [{
    "id": m["id"], "ad": m["ad"], "kategori": m.get("kategori"),
    "aciklama": m.get("aciklama"), "liste_fiyat": m.get("listeFiyat", 0),
    "satis_fiyat": m.get("satisFiyat", 0), "gorseller": m.get("gorseller", []),
    "bedenler": m.get("bedenler", {}), "ozellikler": m.get("ozellikler", {}),
    "toplam_stok": m.get("toplamStok", 0), "aktif": m.get("aktif", True),
    "trendyol_url": m.get("trendyolUrl", ""), "sira": i,
} for i, m in enumerate(modeller)]

h = {"apikey": KEY, "Authorization": f"Bearer {KEY}",
     "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
for i in range(0, len(satirlar), 50):
    parca = satirlar[i:i + 50]
    r = requests.post(f"{URL}/rest/v1/urunler?on_conflict=id", headers=h,
                      json=parca, timeout=60)
    r.raise_for_status()
    print(f"  {min(i + 50, len(satirlar))}/{len(satirlar)} yüklendi")
print("Tamamlandı.")
