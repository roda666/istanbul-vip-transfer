# Admin Yetkilendirme Matrisi

Tüm `/admin` sayfaları ve `/admin/api` endpointleri merkezi rota politikasıyla korunur. İstemcinin gönderdiği rol kullanılmaz; imzalı oturumdaki kullanıcı kimliğiyle veritabanından aktif kullanıcı, güncel oturum sürümü ve rol doğrulanır. Tanınmayan rol veya rota varsayılan olarak reddedilir.

| Yetki alanı | SUPER_ADMIN | ADMIN | EDITOR | CHAT_STAFF |
| --- | --- | --- | --- | --- |
| Kullanıcılar, dil/sistem/e-posta güvenlik ayarları, entegrasyon credential’ları | Evet | Hayır | Hayır | Hayır |
| CMS okuma ve taslak düzenleme | Evet | Evet | Evet | Hayır |
| Yayınlama, yayından alma, silme ve arşivleme | Evet | Evet | Hayır | Hayır |
| AI içerik ve çeviri işlemleri | Evet | Evet | Evet | Hayır |
| Araç, lokasyon ve transfer rotası | Evet | Evet | Hayır | Hayır |
| Talepler ve bülten aboneleri | Evet | Evet | Hayır | Hayır |
| Sohbet okuma, yanıt, devralma ve kapatma | Evet | Evet | Hayır | Evet |
| Site/rezervasyon ayarları | Evet | Evet | Hayır | Hayır |
| Medya yükleme URL’leri | Evet | Evet | Hayır | Hayır |
| Kendi hesabı ve çıkış | Evet | Evet | Evet | Evet |

API davranışı:

- Oturumsuz, pasif kullanıcı veya eski oturum sürümü: JSON `401`.
- Oturum geçerli fakat izin yetersiz: JSON `403`.
- Yetkisiz sayfa isteği: güvenli `/admin/erisim-reddedildi` ekranına yönlendirme.
- Cookie ile yetkilendirilen tüm durum değiştiren isteklerde zorunlu, tam eşleşen aynı-origin ve `Sec-Fetch-Site` kontrolü uygulanır. Login, parola sıfırlama ve cron endpointleri kendi ayrı kimlik doğrulama akışlarını kullanır.

Kritik route handler’larının mevcut iş-audit kayıtları korunur. Merkezi katman ayrıca her reddedilen erişimi ve izin verilen durum değiştiren admin isteğini, parola/token/header/body içermeyen sınırlı metadata ile kaydeder.