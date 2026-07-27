# Admin Panel Kurulum Kılavuzu

Istanbul VIP Transfer yönetim paneli kurulum ve kullanım rehberi.

---

## Gereksinimler

- Node.js 20+
- PostgreSQL 15+
- pnpm 9+
- Çalışan `DATABASE_URL` ve `AUTH_SECRET` ortam değişkenleri

---

## 1. Ortam Değişkenleri

`.env.local` veya Replit Secrets bölümüne aşağıdaki değişkenleri ekleyin:

```
DATABASE_URL=postgresql://kullanici:sifre@host:5432/veritabani?sslmode=disable
AUTH_SECRET=<en az 32 karakterlik rastgele string>
SESSION_SECRET=<en az 32 karakterlik rastgele string — opsiyonel, AUTH_SECRET kullanılır>
```

### AUTH_SECRET oluşturma

```bash
openssl rand -base64 32
```

---

## 2. Veritabanı Migration

```bash
# Paketleri yükle
pnpm install

# Migration dosyalarını oluştur (şema değişikliklerinde)
pnpm --filter @workspace/istanbul-vip-transfer db:generate

# Migration'ları uygula
pnpm --filter @workspace/istanbul-vip-transfer db:migrate
```

Veya geliştirme ortamında schema'yı direkt push et (üretimde kullanma):

```bash
pnpm --filter @workspace/istanbul-vip-transfer db:push
```

---

## 3. İlk Admin Kullanıcısı Oluşturma

Migration tamamlandıktan sonra ilk admin kullanıcısını oluşturun:

```bash
ADMIN_EMAIL="admin@istanbulviptransfer.com" \
ADMIN_PASSWORD="GucluBirSifre123!" \
ADMIN_NAME="Site Yöneticisi" \
pnpm --filter @workspace/istanbul-vip-transfer create-admin
```

**⚠️ Güvenlik:** Komut başarıyla çalıştıktan sonra `ADMIN_PASSWORD` değişkenini hemen kaldırın.

Script yalnızca sıfır admin varken çalışır — mevcut admini etkilemez.

---

## 4. Giriş

Admin paneline erişin:

```
https://www.istanbulviptransfer.com/admin/login
```

veya geliştirme ortamında:

```
http://localhost:3000/admin/login
```

---

## Dizin Yapısı

```
app/
  admin/
    login/              ← Giriş sayfası (auth gerektirmez)
    (protected)/        ← Auth korumalı route grubu
      dashboard/        ← Özet istatistikler
      sayfalar/         ← Statik sayfa yönetimi
      hizmetler/        ← Hizmet sayfası yönetimi
      blog/             ← Blog yazısı yönetimi
      sss/              ← SSS yönetimi
      menu/             ← Navigasyon yönetimi
      ayarlar/          ← Site ayarları
      ai-oneriler/      ← AI içerik önerileri (Faz 2'de aktif)
      gecmis/           ← İşlem geçmişi / Audit log
  api/admin/            ← REST API endpointleri
db/
  schema.ts             ← Drizzle ORM şeması
  index.ts              ← DB client singleton
drizzle/migrations/     ← Otomatik üretilen migration dosyaları
scripts/
  create-admin.ts       ← İlk admin oluşturma scripti
```

---

## İçerik Durumları

| Durum | Açıklama |
|-------|----------|
| DRAFT | Taslak — düzenleme devam ediyor |
| RESEARCH | Araştırma aşaması |
| REVIEW | İnceleme bekliyor |
| APPROVED | Onaylandı, yayına hazır |
| SCHEDULED | Zamanlanmış yayın |
| PUBLISHED | Canlıda |
| ARCHIVED | Arşivlendi |

**Onay sıfırlama:** `APPROVED` veya `SCHEDULED` durumundaki içerik düzenlendiğinde otomatik olarak `REVIEW` durumuna döner ve onay temizlenir.

---

## İçerik Onay Akışı

```
DRAFT → RESEARCH → REVIEW → APPROVED → PUBLISHED
                                  ↓
                               SCHEDULED (tarih ayarlandıysa)
                                  ↓
                               ARCHIVED
```

**Yayınlama kuralı:** Yalnızca `approvedAt` ve `approvedBy` dolu olan içerik yayınlanabilir.

---

## Güvenlik Notları

- Giriş denemesi: IP başına 5 deneme / 15 dakika (bellekte — restart ile sıfırlanır)
- Oturum: httpOnly cookie, 8 saat TTL, sameSite=lax
- CSRF koruması: Tüm mutasyon API'leri `Content-Type: application/json` kontrolü
- Admin URL'leri ve API'leri middleware ile korunur
- Şifreler bcrypt (12 round) ile hashlenir, asla loglanmaz

---

## Paket Scriptleri

```bash
pnpm --filter @workspace/istanbul-vip-transfer db:generate   # Şema → migration
pnpm --filter @workspace/istanbul-vip-transfer db:migrate    # Migration uygula
pnpm --filter @workspace/istanbul-vip-transfer db:push       # Direkt push (sadece dev)
pnpm --filter @workspace/istanbul-vip-transfer create-admin  # İlk admin oluştur
```

---

## Sorun Giderme

### "AUTH_SECRET eksik" hatası
`AUTH_SECRET` ortam değişkenini ayarlayın. Panel giriş sayfasında açıklayıcı hata mesajı gösterilir.

### "Veritabanı bağlantı hatası"
- `DATABASE_URL` doğru ayarlandığını kontrol edin
- Migration'ların çalıştırıldığını doğrulayın: `pnpm db:migrate`
- PostgreSQL sunucusunun erişilebilir olduğunu kontrol edin

### Şifre sıfırlama
Yönetim panelinde henüz şifre sıfırlama özelliği yok. Veritabanına direkt erişimle hash güncelleyebilirsiniz:

```sql
UPDATE admin_users SET password_hash = '<yeni_hash>' WHERE email = 'admin@example.com';
```

Hash oluşturmak için: `node -e "const b = require('bcryptjs'); b.hash('YeniSifre', 12).then(console.log)"`
