const { version } = require('../package.json');

const { MessageEmbed } = require('discord.js');
const ytdl = require('ytdl-core-discord');
const { YouTube } = require('popyt');
const fetch = require('node-fetch');
const ytpl = require('ytpl');


/**
 * @typedef {object} musicBotOptions
 * @property {string} [ytApiKey='none'] YouTube API key
 * @property {string} [prefix='!'] Bot prefix
 * @property {string} [language='en']
 */
const musicBotOptions = {
    ytApiKey: 'none',
    prefix: '!',
    language: 'tr'
};

class MusicBot {
    constructor(client, options = {}) {
        /**
         * Hata mesajı
         * @ignore
         * @private
         */
        this.errorMsg = '\x1b[33m> [Thendra Music] \x1b[31mHata: \x1b[37m ';

        /**
         * İç hata mesajı
         * @ignore
         * @private
         */
        this.interErrorMsg = '\x1b[33m> [Thendra Music] \x1b[31mİç Hata: \x1b[37m ';

        /**
         * Uyarı mesajı
         * @ignore
         * @private
         */
        this.warnMsg = '\x1b[33m> [Thendra Music] \x1b[31mUyarı \x1b[37m ';

        if (!client) {
            throw new SyntaxError(this.errorMsg + 'Bilinmeyen Client.');
        };
        if (!options.ytApiKey) {
            throw new SyntaxError(this.errorMsg + 'Youtube API Key Gerekiyor.');
        };
        if (!options.prefix) {
            throw new SyntaxError(this.errorMsg + 'Prefix Gerekiyor.');
        };
        switch (options.language.toLowerCase()) {
            default:
                this.language = require('../languages/tr.json');
                break;
        };
        /**
         * Discord bot prefix
         */
        this.prefix = options.prefix;

        /**
         * YouTube API key
         * @ignore
         * @private
         */
        this.apiKey = options.ytApiKey;

        /**
         * Queue
         * @ignore
         * @private
         */
        this.queue = new Map();

        /**
         * Discord.Client();
         */
        this.client = client;

        /**
         * Message reactions map
         * @ignore
         * @private
         */
        this.messagesReactions = new Map();

        /**
         * Playlist queue
         * @ignore
         * @private
         */
        this.playlistQueue = new Map();

        console.log(`\x1b[33m> [Thendra Music] \x1b[31mVersiyon: ${version} \x1b[37mby Thendra`);
    };

    /**
     * Enable the music system using this line.
     * @param {string} message The message from your discord code.
     * @example
     * const Discord = require('discord.js'); // Require discord.js
     * const client = new Discord.Client(); // Create the bot client.
     * const { MusicBot } = require('discord-music-system'); // Require the best package ever created on NPM (= require discord-music-system)
     *
     * client.musicBot = new MusicBot(client, {
     *      ytApiKey: 'YouTube API key',
     *      prefix: '!', // Your bot prefix
     *      language: 'en' // fr, en, es, pt
     * });
     *
     * client.on('message', async message => {
     *      if(message.author.bot) {
     *          return;
     *      };
     *      client.musicBot.onMessage(message);
     * });
     *
     * client.login('Your Discord bot token'); // Login with your bot token. You can find the token at https://discord.com/developers/applications/
     */
    async onMessage(message) {
        if (!message) {
            throw new Error(this.errorMsg + 'Mesaj onMessage işlevinde gereklidir.');
        };
        if (message.channel.type === 'dm') {
            return this.sendErrorEmbed(this.language.messages.noPrivateMessages, message);
        };
        const args = message.content.split(' ').slice(1).join(' ');
        // Play command
        if (message.content.startsWith(this.prefix + 'play') || message.content.startsWith(this.prefix + 'çal')) {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            const permissions = message.member.voice.channel.permissionsFor(message.client.user);
            if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
                return this.sendErrorEmbed(this.language.messages.cannotConnect, message);
            };

            if (!args) {
                return this.sendErrorEmbed(this.language.messages.noArgs, message);
            };

            if (serverQueue && !this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };

            if (this.isYouTubePlaylistURL(args)) {
                await this.playPlaylist(args, message);
            }

            if (this.isYouTubeVideoURL(args)) {
                return this.playVideoUrl(args, message);
            };

            if (!this.isYouTubePlaylistURL(args) && !this.isYouTubeVideoURL(args)) {
                return this.playQuery(args, message);
            };
        }
        // Durdur komutu
        else if (message.content === this.prefix + 'stop' || message.content === this.prefix + 'durdur' || message.content === this.prefix + 'ayrıl') {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };

            serverQueue.songs = [];

            if (serverQueue.playing === true) {
                serverQueue.connection.dispatcher.end();
                message.member.voice.channel.leave();
            } else {
                serverQueue.playing === true
                await serverQueue.connection.dispatcher.resume();
                await serverQueue.connection.dispatcher.end();
                await message.member.voice.channel.leave();
            };

            serverQueue.textChannel.messages.fetch({ limit: 1, around: this.messagesReactions.get(serverQueue.textChannel.guild.id) }).then(async messages => {
                await messages.first().reactions.removeAll().catch(console.error);
                await this.messagesReactions.delete(serverQueue.textChannel.guild.id);
            });
        }
        // Çalan komutu
        else if(message.content === this.prefix + 'çalan') {
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            const song = serverQueue.songs[0];
            const seek = (serverQueue.connection.dispatcher.streamTime - serverQueue.connection.dispatcher.pausedTime) / 1000;
            const left = song.duration - seek;

            let nowPlaying = new MessageEmbed()
                .setTitle(this.language.embeds.nowPlaying.title)
                .setDescription(`\`${song.title}\`\n**[${this.language.embeds.nowPlaying.videoLink}](${song.url})**`)
                .setColor('RANDOM')
                .setThumbnail(song.thumbnailUrl)

            return message.channel.send(nowPlaying);
        }
        // Geç komutu
        else if(message.content === this.prefix + 'skip' || message.content === this.prefix + 'geç') {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            if (!serverQueue.songs[1]) {
                return this.sendErrorEmbed(this.language.messages.noMoreSongs, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };

            serverQueue.connection.dispatcher.end();

            return message.channel.send(new MessageEmbed().setColor('RANDOM').setTitle(`Şarkı Geçildi! | Thendra Music`, this.client.user.displayAvatarURL()).setDescription(`[**${serverQueue.songs[0].title}**](${serverQueue.songs[0].url})`).setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL()).setThumbnail(serverQueue.songs[0].thumbnailUrl).setTimestamp())
        }
        // Sıra komutu
        else if(message.content === this.prefix + 'liste' || message.content === this.prefix + 'sıra') {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            if (!serverQueue.songs[1]) {
                return this.sendErrorEmbed(this.language.messages.noMoreSongs, message);
            };

            return this.sendQueueEmbed(serverQueue, message);
        }
        // Ses komutu
        else if(message.content.startsWith(this.prefix + 'volume') || message.content.startsWith(this.prefix + 'ses')) {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message)
            };

            const volumeNumber = parseInt(args, 10);
            if (!isNaN(volumeNumber) && (volumeNumber >= 0 && volumeNumber <= 100)) {
                message.channel.send(new MessageEmbed().setColor('RANDOM').setTitle(`Ses Seviyesi Ayarlandı! | Thendra Music`, this.client.user.displayAvatarURL()).setDescription(`\`${serverQueue.volume * 100}\` Seviyeden \`${volumeNumber}\`'e geçildi`).setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL()));
                serverQueue.volume = volumeNumber / 100;
                if (serverQueue.connection.dispatcher) {
                    serverQueue.connection.dispatcher.setVolumeLogarithmic(serverQueue.volume);
                };
            } else {
                return this.sendErrorEmbed(this.language.messages.volBeetween, message);
            }; 
        }
        // Duraklat komutu
        else if(message.content === this.prefix + 'pause' || message.content === this.prefix + 'duraklat') {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message)
            };

            if (serverQueue && serverQueue.playing) {
                serverQueue.playing = false;
                serverQueue.connection.dispatcher.pause();
                return message.channel.send(new MessageEmbed().setTitle(`Şarkı Durduruldu! | Thendra Music`, this.client.user.displayAvatarURL()).setColor('RANDOM').setDescription(`[**${serverQueue.songs[0].title}**](${serverQueue.songs[0].url})`).setTimestamp().setThumbnail(serverQueue.songs[0].thumbnailUrl).setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL()));
            };   
        }
        // Devam komutu
        else if(message.content === this.prefix + 'resume' || message.content === this.prefix + 'devam') {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            if (serverQueue && !serverQueue.playing) {
                serverQueue.playing = true;
                serverQueue.connection.dispatcher.resume();
                return message.channel.send(new MessageEmbed().setTitle(`Şarkı Devam Ediyor | Thendra Music`, this.client.user.displayAvatarURL()).setColor('RANDOM').setThumbnail(serverQueue.songs[0].thumbnailUrl).setDescription(`[**${serverQueue.songs[0].title}**](${serverQueue.songs[0].url})`).setTimestamp().setFooter(`Thendra Music | ${message.author.tag} Tarafından İstendi`, this.client.user.displayAvatarURL()));
            }; 
        }
        // Sil komutu
        if(message.content.startsWith(this.prefix + 'remove') || message.content.startsWith(this.prefix + 'sil')) {
            if (!message.member.voice.channel) {
                return this.sendErrorEmbed(this.language.messages.voiceChannelNeeded, message);
            };

            if (!this.sameVoiceChannel(message.member)) {
                return this.sendErrorEmbed(this.language.messages.sameVoiceChannel, message);
            };
            const serverQueue = this.queue.get(message.guild.id);
            if (!serverQueue) {
                return this.sendErrorEmbed(this.language.messages.nothingPlaying, message);
            };

            if (!serverQueue.songs[1]) {
                return this.sendErrorEmbed(this.language.messages.noMoreSongs, message);
            };

            const index = parseInt(args, 10);
            if (!isNaN(index) && index >= 1 && serverQueue.songs.length > index) {
                message.channel.send(new MessageEmbed().setTitle(`Şarkı Listeden Silindi! | Thendra Music`, this.client.user.displayAvatarURL()).setColor('RANDOM').setDescription(`[**${serverQueue.songs[index].title}**](${serverQueue.songs[index].url})`).addField(`İsimli Şarkı Listeden Çıkarıldı!`).setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL()));
                serverQueue.songs.splice(index, 1);
            } else {
                this.sendErrorEmbed(this.language.messages.validNumberPosition, message);
            };   
        }
    };

    /**
     * Youtube url'sini inceler
     * @param {string} url The video url from the message
     * @param {string} videoClass Check if the url in a video URL
     * @ignore
     * @private
     */
    isYouTubeVideoURL(url, videoClass = /^(https?:\/\/)?(www\.)?(m\.)?(youtube\.com|youtu\.?be)\/.+$/gi) {
        if (!url) {
            throw new Error(this.interErrorMsg + 'URL, isYouTubeVideoURL işlevinde gereklidir.');
        };

        if (videoClass.test(url)) {
            return true;
        } else {
            return false;
        };
    };

    /**
     * Çalma listesi url'sini inceler
     * @param {string} url The video url from the message
     * @param {string}  playlistClass Check if the url in a playlist URL
     * @ignore
     * @private
     */
    isYouTubePlaylistURL(url, playlistClass = /^.*(list=)([^#\&\?]*).*/gi) {
        if (!url) {
            throw new Error(this.interErrorMsg + 'URL, isYouTubePlaylistURL işlevinde gereklidir.');
        };

        if (playlistClass.test(url)) {
            return true;
        } else {
            return false;
        };
    };

    /**
     * Create progress bar
     * @param {string} totalTime The total video time
     * @param {string} currentTime The current time in the video progression
     * @ignore
     * @private
     */
    progressBar(totalTime, currentTime, barSize = 20, line = '▬', slider = '🔘') {
        if (!totalTime) {
            throw new Error(this.interErrorMsg + 'ProgressBar işlevinde toplam süre gereklidir.');
        };

        if (!currentTime) {
            throw new Error(this.interErrorMsg + 'ProgressBar işlevinde geçerli saat gereklidir.');
        };

        if (currentTime > totalTime) {
            const bar = line.repeat(barSize + 2);
            const percentage = (currentTime / totalTime) * 100;
            return [bar, percentage];
        } else {
            const percentage = currentTime / totalTime;
            const progress = Math.round((barSize * percentage));
            const emptyProgress = barSize - progress;
            const progressText = line.repeat(progress).replace(/.$/, slider);
            const emptyProgressText = line.repeat(emptyProgress);
            const bar = progressText + emptyProgressText;
            const calculated = percentage * 100;
            return [bar, calculated];
        };
    };

    /**
     * Hata embed'i yollar
     * @param {string} errorMessage The message to send in the error embed.
     * @param {string} The original message, from 'onMessage()' function.
     * @ignore
     * @private
     */
    sendErrorEmbed(errorMessage, message) {
        if (!errorMessage) {
            throw new Error(this.interErrorMsg + 'SendErrorEmbed işlevinde hata mesajı gereklidir.');
        };

        if (!message) {
            throw new Error(this.interErrorMsg + 'Mesaj, sendErrorEmbed işlevinde gereklidir.');
        };

        return message.channel.send(new MessageEmbed().setColor('RED').setTimestamp().setDescription('❌ ' + errorMessage).setAuthor(this.language.embeds.errorEmbed.title));
    };

    /**
     * Video'yu öalma
     * @param {string} args The args to find the video.
     * @param {string} message The original message, from 'onMessage()' function.
     * @ignore
     * @private
     */
    async playQuery(args, message) {
        if (!args) {
            throw new Error(this.interErrorMsg + 'Args, playQuery işlevinde gereklidir.');
        };

        if (!message) {
            throw new Error(this.interErrorMsg + 'Mesaj, playQuery işlevinde gereklidir.');
        };

        const youtube = new YouTube(this.apiKey);
        const infos = await youtube.searchVideos(args, 1);
        if (infos.results.length === 0) {
            return this.sendErrorEmbed(this.language.messages.couldNotBeFound, message);
        };

        const serverQueue = this.queue.get(message.guild.id);
        const songInfo = await ytdl.getInfo(infos.results[0].url);
        if (!songInfo) {
            return this.sendErrorEmbed(this.language.messages.restrictedOrNotFound, message);
        };

        const song = { id: songInfo.videoDetails.video_id, title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url, author: songInfo.videoDetails.author.name, authorUrl: songInfo.videoDetails.author.channel_url, duration: songInfo.videoDetails.lengthSeconds, thumbnailUrl: songInfo.player_response.videoDetails.thumbnail.thumbnails.pop().url, published: songInfo.videoDetails.publishDate, views: songInfo.player_response.videoDetails.viewCount };
        if (serverQueue) {
            await serverQueue.songs.push(song);
           return await message.channel.send(new MessageEmbed().setColor('RANDOM').setTimestamp().setThumbnail(song.thumbnailUrl).setTitle(`Oynatılıyor! | Thendra Music`, this.client.user.displayAvatarURL()).setDescription(`[**${song.title}**](${song.url})`).setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL()));
        };

        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: message.member.voice.channel,
            connection: null,
            songs: [],
            volume: 0.5,
            playing: true,
        };

        await this.queue.set(message.guild.id, queueConstruct);
        await queueConstruct.songs.push(song);
        try {
            const connection = await message.member.voice.channel.join();
            queueConstruct.connection = connection;
            this.playSong(queueConstruct.songs[0], message, serverQueue);
        } catch (error) {
            this.queue.delete(message.guild.id);
            await message.member.voice.channel.leave();
            //await this.updateClientPresence(message);
            return this.sendErrorEmbed(`${this.language.messages.cannotConnect} \`${error}\``, message);
        };
    };

    /**
     * Şarkıyı çalma
     * @param {string} song The song, with all it informations (title, author...).
     * @param {string} message The original message, from 'onMessage()' function.
     * @param {object} serverQueue The serverQueue, using the map.
     * @ignore
     * @private
     */
    async playSong(song, message, serverQueue) {
        const queue = this.queue.get(message.guild.id);
        if (!song) {
            await queue.voiceChannel.leave();
            await this.queue.delete(message.guild.id);
        };
        message.guild.me.voice.setSelfDeaf(true);
        const dispatcher = queue.connection.play(await ytdl(song.url), { type: 'opus' })
            .on('finish', async () => {
                queue.songs.shift();
                this.playSong(queue.songs[0], message, serverQueue);
                //await this.updateClientPresence(message);
            })
        dispatcher.setVolumeLogarithmic(queue.volume);
        if (!serverQueue) {
            //this.updateClientPresence(message);
            var çalanEmb = new MessageEmbed()
            .setTitle(`Oynatılıyor! | Thendra Music`, this.client.user.displayAvatarURL())
            .setDescription(`[**${song.title}**](${song.url})`)
            .setThumbnail(song.thumbnailUrl)
            .setTimestamp()
            .setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL())
            .setColor('RANDOM')
            queue.textChannel.send(çalanEmb)
        };
    };

    /**
     * Sıra embed'i yollar
     * @param {object} serverQueue The serverQueue using the map.
     * @param {string} message The original message, from 'onMessage()' function.
     * @ignore
     * @private
     */
    async sendQueueEmbed(serverQueue, message) {
        if (!serverQueue) {
            throw new Error(this.interErrorMsg + 'sendQueueEmbed işlevinde serverQueue gereklidir.');
        };

        if (!message) {
            throw new Error(this.interErrorMsg + 'Mesaj sendQueueEmbed işlevinde gereklidir.');
        };

        const QueueEmbed = new MessageEmbed()
            .setColor('Çalma Listesi | Thendra Music', this.client.user.displayAvatarURL())
            .setTimestamp()
            .setTitle('🎹 `' + message.guild.name + '`' + this.language.embeds.queueEmbed.queue);
        for (let i = 1; i < serverQueue.songs.length && i < 26; i++) {
            QueueEmbed.addField(`\`#${i}\``, `**[${serverQueue.songs[i].title}](${serverQueue.songs[i].url})**`);
        };
        return message.channel.send(QueueEmbed);
    };

    /**
     * Kullanıcının sesli kanalda olup olmadığına bakar
     * @param {member} member The member from the message.
     * @ignore
     * @private
     */
    sameVoiceChannel(member) {
        if (!member) {
            throw new Error(this.interErrorMsg + 'member, sameVoiceChannel işlevinde gereklidir.');
        };

        if (member.voice.channel.id !== member.guild.voice.channelID) {
            return false;
        };

        return true;
    };

    /**
     * Check if a user can react to the message
     * @param {string} member The member from the message.
     * @ignore
     * @private
     */
    canReact(member) {
        if (!member) {
            throw new Error(this.interErrorMsg + 'member, sameVoiceChannel işlevinde gereklidir.');
        };

        if (member.voice.channelID !== member.guild.voice.channelID) {
            return false;
        };

        return true;
    };

    /**
     * URL ile şarkı çalma
     * @param {string} url The video URL, to verify it.
     * @param {string} message The original message, from 'onMessage()' function.
     * @ignore
     * @private
     */
    async playVideoUrl(url, message) {
        if (!url) {
            throw new Error(this.interErrorMsg + 'URL, playVideoUrl işlevinde gereklidir.');
        };

        if (!message) {
            throw new Error(this.interErrorMsg + 'Mesaj, playVideoUrl işlevinde gereklidir.');
        };

        const serverQueue = this.queue.get(message.guild.id);
        if (serverQueue && serverQueue.songs && serverQueue.playing) {
            const songInfo = await ytdl.getInfo(url);
            if (!songInfo) {
                return this.sendErrorEmbed(this.language.messages.errorWhileParsingVideo, message);
            };

            const song = { id: songInfo.videoDetails.video_id, title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url, author: songInfo.videoDetails.author.name, authorUrl: songInfo.videoDetails.author.channel_url, duration: songInfo.videoDetails.lengthSeconds, thumbnailUrl: songInfo.player_response.videoDetails.thumbnail.thumbnails.pop().url, published: songInfo.videoDetails.publishDate, views: songInfo.player_response.videoDetails.viewCount };
            serverQueue.songs.push(song);
            return await message.channel.send(new MessageEmbed().setColor('RANDOM').setTimestamp().setTitle(`Şarkı Sıraya Eklendi | Thendra Music`, this.client.user.displayAvatarURL()).setThumbnail(song.thumbnailUrl).setDescription(`[**${song.title}**](${song.url})`).setFooter(`Thendra Music | ${message.author.tag} Tarafından İstendi`, this.client.user.displayAvatarURL()));
        } else {
            const songInfo = await ytdl.getInfo(url);
            if (!songInfo) {
                return this.sendErrorEmbed(this.language.messages.errorWhileParsingVideo, message);
            };

            const song = { id: songInfo.videoDetails.video_id, title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url, author: songInfo.videoDetails.author.name, authorUrl: songInfo.videoDetails.author.channel_url, duration: songInfo.videoDetails.lengthSeconds, thumbnailUrl: songInfo.player_response.videoDetails.thumbnail.thumbnails.pop().url, published: songInfo.videoDetails.publishDate, views: songInfo.player_response.videoDetails.viewCount };
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: message.member.voice.channel,
                connection: null,
                songs: [],
                volume: 0.5,
                playing: true,
                loop: false
            };
            this.queue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);
            try {
                const connection = await message.member.voice.channel.join();
                queueConstruct.connection = connection;
                this.playSong(song, message, serverQueue);
            } catch (error) {
                this.queue.delete(message.guild.id);
                await message.member.voice.channel.leave();
                //await this.updateClientPresence(message);
                return this.sendErrorEmbed(`${this.language.messages.cannotConnect} \`${error}\``, message);
            };
        };
    };


    /**
     * Çalma listesini başlatma
     * @param {string} query The args: search term in YouTube.
     * @param {string} message The original message, from 'onMessage()' function.
     * @ignore
     * @private
     */
    async playPlaylist(query, message) {
        if (!query) {
            throw new Error(this.interErrorMsg + 'sıra, oynatma listesi işlevinde gereklidir.');
        };

        if (!message) {
            throw new Error(this.interErrorMsg + 'Mesaj, oynatma listesi işlevinde gereklidir.');
        };

        const serverQueue = this.queue.get(message.guild.id);
        if (ytpl.validateID(query)) {
            const playlistID = await ytpl.getPlaylistID(query).catch(console.error);
            if (playlistID) {
                const playlist = await ytpl(playlistID).catch(console.error);
                if (playlist) {
                    const queueConstruct = {
                        textChannel: message.channel,
                        voiceChannel: message.member.voice.channel,
                        connection: null,
                        songs: [],
                        volume: 0.5,
                        playing: true,
                    };
                    if (serverQueue && serverQueue.playing) {
                        message.channel.send(new MessageEmbed().setColor('RANDOM').setTimestamp().setThumbnail(playlist.items[0].thumbnail).setTitle(`Çalma Listesi Oynatılıyor! | Thendra Music`, this.client.user.displayAvatarURL()).setDescription(`[**${playlist.title}**](${playlist.url})`).setFooter(`Thendra Music | ${message.author.username} Tarafından İstendi`, this.client.user.displayAvatarURL()).setTimestamp());
                    };
                    (playlist.items.map(async (i) => {
                        if (serverQueue && serverQueue.playing === true) {
                            const songInfo = await ytdl.getInfo(i.url);
                            if (!songInfo) {
                                return this.sendErrorEmbed(this.language.messages.errorWhileParsingPlaylist, message);
                            };
                            const song = { id: songInfo.videoDetails.video_id, title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url, author: songInfo.videoDetails.author.name, authorUrl: songInfo.videoDetails.author.channel_url, duration: songInfo.videoDetails.lengthSeconds, thumbnailUrl: songInfo.player_response.videoDetails.thumbnail.thumbnails.pop().url, published: songInfo.videoDetails.publishDate, views: songInfo.player_response.videoDetails.viewCount };
                            return serverQueue.songs.push(song);
                        } else {
                            const songInfo = await ytdl.getInfo(i.url);
                            if (!songInfo) {
                                return this.sendErrorEmbed(this.language.messages.errorWhileParsingPlaylist, message);
                            };
                            const song = { id: songInfo.videoDetails.video_id, title: songInfo.videoDetails.title, url: songInfo.videoDetails.video_url, author: songInfo.videoDetails.author.name, authorUrl: songInfo.videoDetails.author.channel_url, duration: songInfo.videoDetails.lengthSeconds, thumbnailUrl: songInfo.player_response.videoDetails.thumbnail.thumbnails.pop().url, published: songInfo.videoDetails.publishDate, views: songInfo.player_response.videoDetails.viewCount };
                            queueConstruct.songs.push(song);
                            this.queue.set(message.guild.id, queueConstruct);
                        };
                    }));
                    if (!serverQueue) {
                        try {
                            const connection = await message.member.voice.channel.join();
                            queueConstruct.connection = connection;
                            this.playSong(queueConstruct.songs[0], message, serverQueue);
                        } catch (error) {
                            this.queue.delete(message.guild.id);
                            await message.member.voice.channel.leave();
                            //await this.updateClientPresence(message);
                            return this.sendErrorEmbed(`${this.language.messages.cannotConnect} \`${error}\``, message);
                        };
                    };
                };
            };
        };
    };
};

module.exports = MusicBot;