# LumaTerm

Windows için Türkçe ve İngilizce arayüzlü, açık kaynak terminal, SSH ve SFTP çalışma alanı. Bu sürüm **0.3 önizlemedir**; çalışan bir masaüstü uygulamasıdır. Windows Terminal'in tüm özellikleriyle birebir eşdeğer olduğu iddia edilmez.

## Kurulum ve güncellemeler

[GitHub Releases](https://github.com/yusufpeksen/LumaTerm/releases/latest) sayfasındaki **LumaTerm-Setup.exe** dosyasını indirip çalıştır. Kurucu masaüstü ve Başlat menüsü kısayollarını oluşturur; Node.js kurulumu gerekmez. İmzasız önizleme sürümlerinde Windows SmartScreen yayıncı uyarısı gösterebilir.

Kurulu uygulama açılıştan kısa süre sonra ve ardından dört saatte bir GitHub Releases üzerinde yeni sürüm denetimi yapar. Yeni paket arka planda indirilir; hazır olduğunda uygulama yeniden başlatma izni ister. Güncelleme aynı LumaTerm kurulumu üzerine uygulanır ve `%APPDATA%/lumaterm` altındaki ayarlar ile SSH profilleri korunur.

0.3 sürümünde SSH yazım akışı gecikmeyi azaltacak biçimde düzenlendi; terminal çıktısı kayıpsız olarak gruplanır ve arayüzün işleyebildiği hızda ilerler. Dosya gezgini artık aktif bağlama göre yalnızca yerel veya uzak dosyaları gösterir. Büyük klasörler sanal listeyle çizilir. PowerShell, CMD, POSIX kabukları ve yaygın araçlar için güvenli komut önerileri eklendi; öneriler komutu kendiliğinden çalıştırmaz ve parola girişlerinde kapatılır. Kabuk ve dosya simgeleri de yenilendi.

Windows 10 1809 veya üzeri / Windows 11 x64 gerekir. Windows PowerShell ve CMD kullanılabilir. PowerShell 7 (`pwsh.exe`) ve WSL (`wsl.exe`) kendi kurulumları varsa açılır. Yerel kabuklar gerçek ConPTY oturumlarıdır; PowerShell komutları, profilleri ve etkileşimli konsol uygulamaları kabuğun kendisinde çalışır.

## Kullanım

- **Yeni terminal:** Varsayılan kabuğu açar. Sol menüde PowerShell, PowerShell 7, CMD ve WSL bulunur. Ayarlarda varsayılan kabuk için başka bir çalıştırılabilir dosyanın yolunu da verebilirsin; alan komut satırı argümanları kabul etmez.
- **SSH bağlantısı:** `SSH BAĞLANTILARI` yanındaki `+` ile ad, adres, port, kullanıcı, parola veya özel anahtar dosyası kaydet. Parola saklanmazsa bağlanırken sorulur. Şifreli anahtarda parola alanı anahtar şifresidir.
- **Sunucu kimliği:** İlk bağlantıda SHA-256 parmak izini sunucu yöneticinle doğrula. Kaydedilen kimlik değişirse bağlantı reddedilir. Sunucu meşru biçimde yeniden kurulduysa Ayarlar → Güvenilen sunucular bölümünden eski kaydı unut ve yeni kimliği tekrar doğrula.
- **Sekmeler:** Birden fazla yerel/uzak oturum birlikte açılır. Üstteki iki sütun simgesi iki oturumu yan yana gösterir. Yeniden bağlan simgesi yeni bir sekme açar; mevcut çıktıyı korur.
- **Dosya paneli:** Yerel terminalde yalnızca bilgisayarındaki klasör, SSH oturumunda yalnızca uzak sunucudaki klasör gösterilir. Aktif sekme değişince panel de o oturumun güncel dizinine geçer. Klasörlere çift tıkla; adres alanına yol yazarak Enter'a bas. Gizli dosyalar varsayılan olarak görünür.
- **Yerel dizin takibi:** PowerShell/PowerShell 7 ve CMD oturumlarında `cd`, `Set-Location`, `Push-Location` ve `Pop-Location` sonrası dosya paneli otomatik güncellenir. Sekmeler kendi dizinlerini korur; arka plandaki oturum aktif paneli değiştirmez. PowerShell profil dosyaları değiştirilmez; mevcut prompt oturumluk bir bildirim fonksiyonuyla sarılır. Sonradan prompt fonksiyonunu veya CMD `PROMPT` değişkenini tamamen değiştiren komutlar takibi kaldırabilir. WSL ve özel kabuklar için bu yerel entegrasyon uygulanmaz.
- **Yükleme:** Explorer'dan veya alt yerel panelden üst uzak panele dosya/klasör sürükle. Yükle ve klasör yükle düğmeleriyle dosya seçimi de yapabilirsin.
- **İndirme:** Uzak dosyanın indirme düğmesine tıkla veya dosyaya çift tıkla; hedef klasörü Windows klasör seçicisinden belirle.
- **Doğrudan Explorer'a sürükleme:** Uzak dosyanın üzerine gel, dışa taşıma simgesine tıkla. Önce yerel geçici kopya hazırlanır; açılan “Dosya hazır” penceresindeki dosya düğmesini Explorer'a veya masaüstüne sürükle. Windows'a mevcut bir yerel dosya vermek gerektiğinden bu iki aşamalıdır.
- **Dosya işlemleri:** Klasör oluşturma, yeniden adlandırma ve silme bulunur. Silme kalıcıdır ve onay ister. Klasör silme yalnızca boş klasörlerde çalışır. Var olan dosyanın üzerine yazmadan önce sorulur.
- **Dizin takibi:** SSH oturumu Bash/Zsh komut satırındayken `Dizini takip et` seçeneğini etkinleştir. Oturumluk bir prompt fonksiyonu OSC 7 mesajlarıyla dosya panelini terminalin dizinine taşır. Uzak ayar dosyaları değiştirilmez. Farklı kabuklarda panel yolunu elle değiştir; paneldeki terminal simgesi seçili klasöre `cd` gönderir.
- **Çalışma Alanları:** Sol bölümdeki kaydet simgesi açık oturumları bir isim altında saklar. Sonraki açılışta gruba tıklamak bütün bağlantıları yeniden açar. Bu özellik terminal çıktılarını, çalışan süreçleri veya uzak `tmux` oturumlarını kaydetmez.
- **Komut önerileri:** Yazarken oturum geçmişi, kabuk komutları, yaygın alt komutlar ve açık dosya listesinden öneriler gösterilir. `Ctrl+Space` listeyi açar, `Alt+↑/↓` seçimi değiştirir, `Ctrl+→` seçileni satıra ekler, `Esc` kapatır. `Tab` kabuğun kendi tamamlamasına bırakılmıştır. Geçmiş yalnızca açık oturumun belleğinde tutulur.
- **Ayarlar:** Üç tema, vurgu rengi, yazı tipi/boyutu, satır aralığı, imleç, geçmiş uzunluğu, başlangıç klasörü, kabuk, kısayollar, komut önerileri, gizli dosyalar, SSH canlı tutma aralığı, seçerek kopyalama ve kapanış onayı.
- **Yedekleme:** Ayarları JSON olarak dışa/içe aktarabilirsin. Dışa aktarılan dosya parola içermez. İçe aktarma dış dosyadaki sunucu güven kayıtlarını kabul etmez.

## Varsayılan kısayollar

| İşlem | Kısayol |
|---|---|
| Yeni terminal | Ctrl+Shift+T |
| Sekmeyi kapat | Ctrl+Shift+W |
| Sonraki / önceki sekme | Ctrl+Tab / Ctrl+Shift+Tab |
| Terminalde ara | Ctrl+Shift+F |
| Komut paleti | Ctrl+Shift+P |
| Ayarlar | Ctrl+, |
| Kopyala | Ctrl+Shift+C |
| Yapıştır | Ctrl+V |
| Önerileri aç | Ctrl+Space |
| Öneriyi ekle | Ctrl+Sağ ok |

Terminalde sağ tık seçili metni kopyalar; seçim yoksa yapıştırır. Çok satırlı pano içeriği yapıştırılırken onay istenir. Terminalin kaydet simgesi mevcut kaydırma geçmişini metin dosyasına çıkarır.

## Veriler ve güvenlik

Normal kullanımdaki ayar dosyası Electron'un Windows kullanıcı veri klasöründe, genellikle `%APPDATA%/lumaterm/lumaterm.json` yolundadır. Sunucu adresleri ve kullanıcı adları okunabilir metadata olarak; parola ve anahtar şifreleri Windows DPAPI ile şifrelenerek saklanır. Windows hesabına tam erişimi olan süreçlere karşı ayrı bir parola kasası koruması vaat edilmez. Özel anahtar dosyası kopyalanmaz; yolu saklanır.

Arayüzde Node.js erişimi kapalıdır; context isolation ve sandbox açıktır. IPC çağrıları yerel uygulama penceresiyle sınırlandırılmıştır. SFTP'den gelen dosya adları indirme sırasında Windows yolu dışına çıkmaya karşı doğrulanır. Sembolik bağlantılar otomatik olarak aktarılmaz. Kısmi indirmeler `.part` dosyasına yazılır; başarılı bitince hedef adına taşınır.

Explorer sürüklemesi için hazırlanan geçici kopyalar Windows `%TEMP%` klasöründe `lumaterm-drag-*` adıyla kalabilir. Terminal çıktısını dışa aktarırken içinde komutlarına bağlı olarak sırlar bulunabileceğini dikkate al.

Kaynak kod [MIT Lisansı](LICENSE) ile yayımlanır. Depoya gerçek sunucu adresi, kullanıcı verisi, parola, özel anahtar, sertifika veya oluşturulmuş test verisi eklenmez. Güvenlik açıkları için [güvenlik politikasını](SECURITY.md), katkı göndermek için [katkı rehberini](CONTRIBUTING.md) kullan.

## Kapsam ve bilinen sınırlar

- Windows Terminal'in tüm özelliklerinin kopyası değildir. Quake modu, GPU shader/arka plan resimleri, yönetici profilleri, esnek çoklu bölme ağacı ve Windows Terminal JSON ayar uyumluluğu yoktur.
- SSH jump host/ProxyJump, port yönlendirme, agent forwarding, donanımsal FIDO anahtarları ve etkileşimli MFA akışı bu sürümde uygulanmadı.
- Otomatik yeniden bağlanma, aktarım duraklatma/sürdürme ve aktarım kuyruğu yönetimi yoktur. Bağlantı kapatılınca aktarım kesilir; otomatik telafi yapılmaz. Başarısız yüklemede uzak tarafta kısmi dosya kalabilir.
- SFTP dosya yöneticisi tek dosya/klasör sürükleme sunar; Windows dosya seçme penceresiyle birden fazla kaynak seçilebilir. Uzak dosyayı doğrudan dışarı sürüklemek önce hazırlama adımı gerektirir.
- Dizin takibi Bash/Zsh prompt'una bağlıdır; `tmux`, iç içe SSH, özel prompt framework'leri ve diğer kabuklarda ayrıca doğrulanmalıdır. Windows uzak kabukları için otomatik `cd`/takip uyarlaması yoktur.
- Uzak dosya düzenleyicisi, izin/sahiplik editörü, dosya araması ve sembolik bağlantı takibi yoktur.
- Komut önerileri yerleşik katalog, geçerli dosya listesi ve oturum içi geçmişe dayanır; uzak kabuğun kurulu tüm komutlarını veya bağlama duyarlı dil sunucusu analizini keşfetmez.
- Uygulama şu anda kod imzası olmadan paketlenir; bu nedenle Windows ilk kurulumda SmartScreen uyarısı gösterebilir.

## Geliştirme ve doğrulama

Node.js 22.12+ ile:

```powershell
npm ci
npm run build
npm start
```

```powershell
npm test
npm run smoke
npm run package
```

`npm run package`, `release/LumaTerm-Setup.exe` ve otomatik güncellemenin kullandığı `latest.yml` dosyasını üretir. Yeni sürüm yayımlamak için önce sürümü SemVer ile artır (`npm version patch`, `minor` veya `major`), ardından `main` dalını ve oluşan `vX.Y.Z` etiketini GitHub'a gönder. Etiket iş akışı testleri çalıştırır, Setup.exe'yi üretir ve GitHub Release varlığı olarak yayımlar. Aynı sürüm etiketi tekrar kullanılmaz.

`npm run smoke`, ayrı test veri klasöründe gizli bir Electron penceresi, gerçek PowerShell/ConPTY ve yalnızca `127.0.0.1` üzerinde geçici bir SSH/SFTP test sunucusu açar. Renderer, sekmeler, bölünmüş görünüm, DPAPI, parola/anahtar doğrulaması, sunucu kimliği, dosya/klasör aktarımı ve dosya işlemlerini kontrol eder. `test-results/smoke.json` sonuçları; PNG dosyaları test ekranlarını içerir.

Gerçek sunucunun kimliği veya parolası sağlanmadığı için kişisel sunucunda bağlantı testi yapılmadı. Explorer'a bırakmanın son Windows fare hareketi otomatik test edilmedi; hazırlanan yerel dosyanın içeriği kontrol edildi. PowerShell 7/WSL ve farklı terminal programları ayrıca kendi kurulumlarında doğrulanmalıdır.

0.3 regresyon testleri gerçek PowerShell ve CMD süreçlerinde dizin bildirimlerini, Türkçe/boşluk/yüzde/apostrof içeren yolları, göreli dizinleri, sekme geçişlerini, başarısız `cd` sonrasında doğru konumun korunmasını, dil geçişini, tek aktif dosya panelini, büyük uzak klasörlerin sanal çizimini, SSH giriş gecikmesini, PowerShell/CMD/SSH önerilerini, öneri kabulünü ve parola alanı gizliliğini kontrol eder. `node scripts/check-localization.cjs` uygulama metinlerinin çeviri kapsamını denetler.

Teknik kaynaklar: [Microsoft node-pty](https://github.com/microsoft/node-pty), [ssh2](https://github.com/mscdex/ssh2), [Electron güvenliği](https://www.electronjs.org/docs/latest/tutorial/security), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), [xterm.js](https://xtermjs.org/).
