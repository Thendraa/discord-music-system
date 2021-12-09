# 🎵 Discord Müzik Sistemi

## 🔩 Kurulum
```
$ npm install discord-music-system-tr
```

## 💻 Örnek
```js
const Discord = require('discord.js'); // Discord.js
const client = new Discord.Client(); // Botun client'ini oluşturma
const { MusicBot } = require('discord-music-system-tr'); // Müzik Sistemi modülü

client.musicBot = new MusicBot(client, {
    ytApiKey: 'YouTube API key',
    prefix: '!', // Botun prefixi
    language: 'tr'
});

client.on('message', async message => {
    if(message.author.bot) {
        return;
    };
    client.musicBot.onMessage(message);
});

client.login('token'); // Botun aktif olması için token, Bu siteden bulabilirsin https://discord.com/developers/applications/
```

## 🤖 komutlar
* **ÇAL**
  * `play` 
  * `çal`
  * **+ `<şarkı ismi | video URL | playlist URL>`**

* **DURDUR**
  * `stop`
  * `durdur`
  * `ayrıl`

* **ÇALAN**
  * `çalan`

* **GEÇ**
  * `skip`
  * `geç`

* **SIRA**
  * `liste`
  * `sıra`

* **SES**
  * `volume`
  * `ses`
  * **+ `<1'den 100'e kadar sayı girebilirsiniz>`**

* **DURAKLAT**
  * `duraklat`

* **DEVAM**
  * `devam`

* **SİL**
  * `remove`
  * `sil`
  * **+ `<sırada/listede olan herhangi bir şarkının sıra numarasını girin>`**


## 🚀 Ek

**Modül RemyK#3876'ya Aittir. Türkçeleştirme Thendra#0409 Tarafından Yapıldı.**

*Not: Bu modül Discord veya YouTube ile bağlantılı değildir.*

Herhangi bir sorununuz olursa iletişime geçebilirsiniz: `Thendra#0409`.

<a href="https://discord.gg/mRNurgF87h"><img src="https://invidget.switchblade.xyz/mRNurgF87h"></a>


## **made by Thendra**
