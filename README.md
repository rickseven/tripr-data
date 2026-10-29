# tripr-data

Hosting statis untuk aplikasi **Tripr**: katalog paket peta dan berkas paketnya. Tidak ada server dan tidak ada kode yang berjalan di sini.

| Apa | Di mana | Kenapa |
|---|---|---|
| `catalog.json` | **GitHub Pages** (akar repo) | URL tetap yang dikunci di aplikasi; kecil. |
| Paket peta `*.pmtiles` | **GitHub Releases** (aset rilis `data-2026.10`) | Aset rilis boleh sampai 2 GiB per berkas; repo git dan Pages tidak cocok untuk berkas ratusan MB. |

Aplikasi hanya mengunduh `catalog.json` dan paket yang dipilih pengguna, lalu memverifikasi `sha256` tiap paket sebelum memakainya.

## Isi

```
catalog.json            katalog (dibuat oleh scripts/build-catalog.mjs)
config/sources.json     versi data, sumber, anggaran ukuran, daftar negara
scripts/                alat pembangun dan pemeriksa (Node 20+, tanpa dependensi)
release-assets/         berkas paket (DIABAIKAN git; diunggah sebagai aset rilis)
index.html, .nojekyll   halaman akar Pages
NOTICE.md               atribusi dan lisensi data
```

Rilis saat ini (`data-2026.10`, sumber Protomaps build 20261008): 6 negara, 13 paket, 1,99 GiB.

| Negara | Lite | Standar | Detail |
|---|---|---|---|
| Singapura (SGP) | z14, 9,3 MB | | |
| Malaysia (MYS) | z12, 35,9 MB | z13, 77,2 MB | |
| Indonesia (IDN) | z9, 13,1 MB | z12, 157,0 MB | z13, 323,3 MB |
| Swiss (CHE) | z11, 36,4 MB | z14, 280,1 MB | |
| Jepang (JPN) | z9, 19,0 MB | z12, 243,9 MB | z13, 536,9 MB |
| Jerman (DEU) | z9, 41,7 MB | z11, 265,3 MB | (z12 = 611 MB melebihi anggaran; perlu dipecah per wilayah) |

Ukuran dalam MiB (1 MiB = 1.048.576 B). Tingkat dipilih dari anggaran ukuran per berkas (Lite ≤ 50 MB, Standar ≤ 300 MB, Detail ≤ 600 MB): zoom tertinggi yang muat. Tingkat yang menunjuk berkas sama dengan tingkat di bawahnya dihilangkan.

## Cara merilis (langkah manual Anda)

Prasyarat: Git, Node 20+, dan [GitHub CLI `gh`](https://cli.github.com/) (di Windows: `winget install --id GitHub.cli`, lalu buka terminal baru dan `gh auth login`). `gh` dipakai hanya di langkah 4; tanpa `gh` pakai halaman Releases di web (unggahan 2 GiB lewat browser bisa putus, `gh` lebih andal).

Privasi: commit memuat nama dan email dari `git config`. Untuk repo publik pakai email noreply GitHub (Settings, Emails, *Keep my email addresses private*), mis. `git config user.email "<id>+rickseven@users.noreply.github.com"` di folder ini sebelum commit pertama.

0. **Perlindungan repo (wajib karena publik)**: hanya `@rickseven` yang boleh mengubah apa pun. Berkas penjaganya ada di `.github/` (`CODEOWNERS`, `guard.yml`, `ruleset-*.json`); yang benar-benar memblokir adalah pengaturan GitHub. Terapkan sesuai `.github/SETTINGS.md` sesaat setelah repo dibuat.
1. **Buat repo publik** `tripr-data` di akun `rickseven`, lalu dari folder ini:
   ```
   git init -b main
   git remote add origin https://github.com/rickseven/tripr-data.git
   ```
2. **Nama akun di katalog** sudah `rickseven` (diganti dari `__OWNER__` dengan `set-owner`); periksa lagi:
   ```
   node scripts/verify.mjs --release
   ```
   `verify` menghitung ulang ukuran dan `sha256` semua paket (±2 GiB; beberapa menit) dan menolak bila masih ada `__OWNER__`.
3. **Commit dan push** (berkas `release-assets/` otomatis diabaikan):
   ```
   git add .
   git commit -m "Data release 2026.10"
   git push -u origin main
   ```
4. **Buat rilis dan unggah paket dulu, sebelum Pages menyajikan katalog baru:**
   ```
   gh release create data-2026.10 release-assets/*.pmtiles --repo rickseven/tripr-data --title "Data 2026.10" --notes-file RELEASE_NOTES.md
   ```
   (Alternatif tanpa `gh`: halaman Releases di GitHub, "Draft a new release", tag `data-2026.10`, seret semua berkas di `release-assets/`.)
5. **Aktifkan Pages**: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`.
6. **Uji dari luar**:
   ```
   curl -sI https://rickseven.github.io/tripr-data/catalog.json
   curl -sIL -r 0-99 https://github.com/rickseven/tripr-data/releases/download/data-2026.10/SGP-z14.pmtiles
   ```
   Yang kedua harus menjawab `206 Partial Content` (unduhan bisa dilanjutkan).
7. Beri tahu agent: URL katalog `https://rickseven.github.io/tripr-data/catalog.json`.

## Data routing offline (opsional)

Bagian `routing` di `catalog.json` berisi segmen BRouter (`.rd5`, kotak 5°×5°, dinamai menurut sudut barat daya, mis. `E105_S10.rd5`) dan segmen yang dibutuhkan tiap negara (dari bbox di katalog). Segmen yang dipakai dua negara hanya tercantum sekali. Berkas segmen ada di `routing-assets/` (diabaikan git) dan diunggah sebagai aset Release dengan tag terpisah (`routing-<tahun>.<bulan>`, lihat `config/sources.json`, bagian `routing`).

```
node scripts/build-routing.mjs --source <folder berisi .rd5> [--partial]   # tambah bagian routing ke catalog.json
node scripts/verify.mjs --release                                         # ukuran dan sha256 segmen ikut diperiksa
```

Dari repo `tripr` semua ini bisa dijalankan lewat `node tools/data/data.mjs routing|verify|release`. Sumber segmen dan hak hosting ulang: lihat `docs/plan-m3b.md` di repo `tripr` (keputusan pemilik produk masih terbuka); jangan merilis segmen sebelum ketentuan penggunaannya diperiksa.

## Memperbarui data

Rilis baru memakai tag baru (mis. `data-2026.11`): ubah `version` dan `releaseTag` di `config/sources.json`, ekstrak paket baru, jalankan `scripts/build-catalog.mjs --source <folder> --owner rickseven`, `scripts/verify.mjs --release`, buat rilis, lalu push `catalog.json`. Jangan menghapus rilis lama sampai versi aplikasi yang memakainya tidak beredar lagi.

## Format `catalog.json` (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "version": "2026.10",
  "releaseTag": "data-2026.10",
  "sourceBuild": "20261008",
  "license": "ODbL-1.0",
  "attribution": "© OpenStreetMap contributors, Protomaps",
  "downloadBase": "https://github.com/rickseven/tripr-data/releases/download/data-2026.10/",
  "countries": [
    {
      "iso": "SGP", "name": "Singapore", "bbox": [west, south, east, north],
      "packs": [
        { "tier": "lite", "file": "SGP-z14.pmtiles", "minzoom": 0, "maxzoom": 14, "bytes": 9712608, "sha256": "..." }
      ]
    }
  ]
}
```

URL unduhan sebuah paket = `downloadBase` + `file`. Perubahan yang tidak kompatibel menaikkan `schemaVersion`.
