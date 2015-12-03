/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2015 (original work) Open Assessment Technologies SA ;
 */
/**
 * @author Jean-Sébastien Conan <jean-sebastien.conan@vesperiagroup.com>
 */
define([
    'jquery',
    'lodash',
    'i18n',
    'urlParser',
    'core/eventifier',
    'tpl!ui/mediaplayer/tpl/player',
    'css!ui/mediaplayer/css/player',
    'nouislider'
], function ($, _, __, UrlParser, eventifier, playerTpl) {
    'use strict';

    /**
     * CSS namespace
     * @type {String}
     * @private
     */
    var _ns = '.mediaplayer';

    /**
     * A Regex to extract ID from Youtube URLs
     * @type {RegExp}
     * @private
     */
    var _reYoutube = /([?&\/]v[=\/])([\w-]+)([&\/]?)/;

    /**
     * A Regex to detect Apple mobile browsers
     * @type {RegExp}
     * @private
     */
    var _reAppleMobiles = /ip(hone|od)/i;

    /**
     * A Regex to detect Apple device browsers
     * @type {RegExp}
     * @private
     */
    var _reAppleDevices = /ip(hone|od|ad)/i;

    /**
     * Array slice method needed to slice arguments
     * @type {Function}
     * @private
     */
    var _slice = [].slice;

    /**
     * Minimum value of the volume
     * @type {Number}
     * @private
     */
    var _volumeMin = 0;

    /**
     * Maximum value of the volume
     * @type {Number}
     * @private
     */
    var _volumeMax = 100;

    /**
     * Range value of the volume
     * @type {Number}
     * @private
     */
    var _volumeRange = _volumeMax - _volumeMin;

    /**
     * Some default values
     * @type {Object}
     * @private
     */
    var _defaults = {
        type : 'video/mp4',
        video : {
            width : 480,
            height : 270,
            minWidth: 200,
            minHeight: 200
        },
        audio : {
            width : 400,
            height : 30,
            minWidth: 200,
            minHeight: 36
        },
        options : {
            volume : Math.floor(_volumeRange * .8),
            startMuted : false,
            maxPlays : 0,
            canPause : true,
            loop : false,
            autoStart : false
        }
    };

    /**
     * A list of MIME types with codec declaration
     * @type {Object}
     * @private
     */
    var _mimeTypes = {
        // video
        'video/webm': 'video/webm; codecs="vp8, vorbis"',
        'video/mp4': 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
        'video/ogg': 'video/ogg; codecs="theora, vorbis"',
        // audio
        'audio/mpeg': 'audio/mpeg;',
        'audio/mp4': 'audio/mp4; codecs="mp4a.40.5"',
        'audio/ogg': 'audio/ogg; codecs="vorbis"',
        'audio/wav': 'audio/wav; codecs="1"'
    };

    /**
     * Extracts the ID of a Youtube video from an URL
     * @param {String} url
     * @returns {String}
     * @private
     */
    var _extractYoutubeId = function(url) {
        var res = _reYoutube.exec(url);
        return res && res[2] || url;
    };

    /**
     * Ensures a value is a number
     * @param {Number|String} value
     * @returns {Number}
     * @private
     */
    var _ensureNumber = function(value) {
        value = parseFloat(value);
        return isFinite(value) ? value : 0;
    };

    /**
     * Format a number to string with leading zeros
     * @param {Number} n
     * @param {Number} len
     * @returns {String}
     * @private
     */
    var _leadingZero = function(n, len) {
        var value = n.toString();
        while (value.length < len) {
            value = '0' + value;
        }
        return value;
    };

    /**
     * Formats a time value to string
     * @param {Number} time
     * @returns {String}
     * @private
     */
    var _timerFormat = function(time) {
        var seconds = Math.floor(time % 60);
        var minutes = Math.floor(time / 60) % 60;
        var hours = Math.floor(time / 3600);
        var parts = [];

        if (hours) {
            parts.push(hours);
        }
        parts.push(_leadingZero(minutes, 2));
        parts.push(_leadingZero(seconds, 2));

        return parts.join(':');
    };

    /**
     * Extract a list of media sources from a config object
     * @param {Object} config
     * @returns {Array}
     * @private
     */
    var _configToSources = function(config) {
        var sources = config.sources || [];

        if (!_.isArray(sources)) {
            sources = [sources];
        }

        if (config.url) {
            if (_.isArray(config.url)) {
                sources = sources.concat(config.url);
            } else {
                sources.push(config.url);
            }
        }

        return sources;
    };

    /**
     * Checks if the browser can play media
     * @param {HTMLMediaElement} media The media element on which check support
     * @param {String} [mimeType] An optional MIME type to precise the support
     * @returns {Boolean}
     * @private
     */
    var _checkSupport = function(media, mimeType) {
        var support = !!media.canPlayType;
        if (mimeType && support) {
            support = !!media.canPlayType(_mimeTypes[mimeType] || mimeType).replace(/no/, '');
        }
        return support;
    };

    /**
     * Support dection
     * @type {Object}
     * @private
     */
    var _support = {
        /**
         * Checks if the browser can play video and audio
         * @param {String} [type] The type of media (audio or video)
         * @param {String} [mime] A media MIME type to check
         * @returns {Boolean}
         */
        canPlay: function canPlay(type, mime) {
            if (type) {
                switch (type.toLowerCase()) {
                    case 'audio': return this.canPlayAudio(mime);
                    case 'youtube':
                    case 'video': return this.canPlayVideo(mime);
                    default: return false;
                }
            }
            return this.canPlayAudio() && this.canPlayVideo();
        },

        /**
         * Checks if the browser can play audio
         * @param {String} [mime] A media MIME type to check
         * @returns {Boolean}
         */
        canPlayAudio: function canPlayAudio(mime) {
            if (!this._mediaAudio) {
                this._mediaAudio = document.createElement('audio');
            }

            return _checkSupport(this._mediaAudio, mime);
        },

        /**
         * Checks if the browser can play video
         * @param {String} [mime] A media MIME type to check
         * @returns {Boolean}
         */
        canPlayVideo: function canPlayVideo(mime) {
            if (!this._mediaVideo) {
                this._mediaVideo = document.createElement('video');
            }

            return _checkSupport(this._mediaVideo, mime);
        },

        /**
         * Checks if the browser allows to control the media playback
         * @returns {Boolean}
         */
        canControl: function canControl() {
            return !_reAppleMobiles.test(navigator.userAgent);
        }
    };

    /**
     * A local manager for Youtube players.
     * Relies on https://developers.google.com/youtube/iframe_api_reference
     * @type {Object}
     * @private
     */
    var _youtubeManager = {
        /**
         * The Youtube API injection state
         * @type {Boolean}
         */
        injected : false,

        /**
         * The Youtube API ready state
         * @type {Boolean}
         */
        ready : false,

        /**
         * A list of pending players
         * @type {Array}
         */
        pending : [],

        /**
         * Add a Youtube player
         * @param {String|jQuery|HTMLElement} elem
         * @param {Object} player
         * @param {Object} [options]
         * @param {Boolean} [options.controls]
         */
        add : function add(elem, player, options) {
            if (this.ready) {
                this.create(elem, player, options);
            } else {
                this.pending.push([elem, player, options]);

                if (!this.injected) {
                    this.injectApi();
                }
            }
        },

        /**
         * Removes a pending Youtube player
         * @param {String|jQuery|HTMLElement} elem
         * @param {Object} player
         */
        remove : function remove(elem, player) {
            var pending = this.pending;
            _.forEach(pending, function(args, idx) {
                if (args && elem === args[0] && player === args[1]) {
                    pending[idx] = null;
                }
            });
        },

        /**
         * Install a Youtube player. The Youtube API must be ready
         * @param {String|jQuery|HTMLElement} elem
         * @param {Object} player
         * @param {Object} [options]
         * @param {Boolean} [options.controls]
         */
        create : function create(elem, player, options) {
            var $elem;

            if (!this.ready) {
                return this.add(elem, player, options);
            }

            if (!options) {
                options = {};
            }

            $elem = $(elem);

            new YT.Player($elem.get(0), {
                height: $elem.width(),
                width: $elem.height(),
                videoId: $elem.data('videoId'),
                playerVars: {
                    //hd: true,
                    autoplay: 0,
                    controls: options.controls ? 1 : 0,
                    rel: 0,
                    showinfo: 0,
                    wmode: 'transparent',
                    modestbranding: 1,
                    disablekb: 1,
                    playsinline: 1,
                    enablejsapi: 1,
                    origin: location.hostname
                },
                events: {
                    onReady: player.onReady.bind(player),
                    onStateChange: player.onStateChange.bind(player)
                }
            });
        },

        /**
         * Called when the Youtube API is ready. Should install all pending players.
         */
        apiReady : function apiReady() {
            var self = this;
            var pending = this.pending;

            this.pending = [];
            this.ready = true;

            _.forEach(pending, function(args) {
                if (args) {
                    self.create.apply(self, args);
                }
            });
        },

        /**
         * Checks if the Youtube API is ready to use
         * @returns {Boolean}
         */
        isApiReady : function isApiReady() {
            var apiReady = (undefined !== window.YT && undefined !== window.YT.Player);
            if (apiReady && !this.ready) {
                _youtubeManager.apiReady();
            }
            return apiReady;
        },

        /**
         * Injects the Youtube API into the page
         */
        injectApi : function injectApi() {
            var self = this;
            if (!self.isApiReady()) {
                require(['https://www.youtube.com/iframe_api'], function() {
                    var check = function() {
                        if (!self.isApiReady()) {
                            setTimeout(check, 100);
                        }
                    };
                    check();
                });
            }

            this.injected = true;
        }
    };

    /**
     * Defines a player object dedicated to youtube media
     * @param {mediaplayer} mediaplayer
     * @private
     */
    var _youtubePlayer = function(mediaplayer) {
        var $media;
        var media;
        var player;
        var interval;
        var destroyed;

        if (mediaplayer) {
            player = {
                init : function _youtubePlayerInit() {
                    $media = mediaplayer.$media;
                    media = null;
                    destroyed = false;

                    if ($media) {
                        _youtubeManager.add($media, this, {
                            controls : mediaplayer.is('nogui')
                        });
                    }

                    return !!$media;
                },

                onReady : function _youtubePlayerOnReady(event) {
                    var callbacks = this._callbacks;

                    media = event.target;
                    $media = $(media.getIframe());
                    this._callbacks = null;

                    if (!destroyed) {
                        mediaplayer._onReady();

                        if (callbacks) {
                            _.forEach(callbacks, function(cb) {
                                cb();
                            });
                        }
                    } else {
                        this.destroy();
                    }
                },

                onStateChange : function _youtubePlayerOnStateChange(event) {
                    this.stopPolling();

                    if (!destroyed) {
                        switch (event.data) {
                            // ended
                            case 0:
                                mediaplayer._onEnd();
                                break;

                            // playing
                            case 1:
                                mediaplayer._onPlay();
                                this.startPolling();
                                break;

                            // paused
                            case 2:
                                mediaplayer._onPause();
                                break;
                        }
                    }
                },

                stopPolling : function _youtubePlayerStopPolling() {
                    if (interval) {
                        clearInterval(interval);
                        interval = null;
                    }
                },

                startPolling : function _youtubePlayerStartPolling() {
                    interval = setInterval(function() {
                        mediaplayer._onTimeUpdate();
                    }, mediaplayerFactory.youtubePolling);
                },

                destroy : function _youtubePlayerDestroy() {
                    destroyed = true;

                    if (media) {
                        media.destroy();
                    } else {
                        _youtubeManager.remove($media, this);
                    }

                    this.stopPolling();

                    $media = null;
                    media = null;
                },

                getPosition : function _youtubePlayerGetPosition() {
                    if (media) {
                        return media.getCurrentTime();
                    }
                    return 0;
                },

                getDuration : function _youtubePlayerGetDuration() {
                    if (media) {
                        return media.getDuration();
                    }
                    return 0;
                },

                getVolume : function _youtubePlayerGetVolume() {
                    var value = 0;
                    if (media) {
                        value = media.getVolume() * _volumeRange / 100 + _volumeMin;
                    }
                    return value;
                },

                setVolume : function _youtubePlayerSetVolume(value) {
                    if (media) {
                        media.setVolume((parseFloat(value) - _volumeMin) / _volumeRange * 100);
                    }
                },

                setSize : function _youtubePlayerSetSize(width, height) {
                    if ($media) {
                        $media.width(width).height(height);
                    }
                    if (media) {
                        media.setSize(width, height);
                    }
                },

                seek : function _youtubePlayerSeek(value) {
                    if (media) {
                        media.seekTo(parseFloat(value), true);
                    }
                },

                play : function _youtubePlayerPlay() {
                    if (media) {
                        media.playVideo();
                    }
                },

                pause : function _youtubePlayerPause() {
                    if (media) {
                        media.pauseVideo();
                    }
                },

                stop : function _youtubePlayerStop() {
                    if (media) {
                        media.stopVideo();
                        mediaplayer._onEnd();
                    }
                },

                mute : function _youtubePlayerMute(state) {
                    if (media) {
                        media[state ? 'mute' : 'unMute']();
                    }
                },

                isMuted : function _youtubePlayerIsMuted() {
                    if (media) {
                        return media.isMuted();
                    }
                    return false;
                },

                addMedia : function _youtubePlayerSetMedia(url) {
                    var id = _extractYoutubeId(url);
                    var cb = id && function() {
                        media.cueVideoById(id);
                    };
                    if (cb) {
                        if (media) {
                            cb();
                        } else {
                            this._callbacks = this._callbacks || [];
                            this._callbacks.push(cb);
                        }
                        return true;
                    }
                    return false;
                },

                setMedia : function _youtubePlayerSetMedia(url) {
                    var id = _extractYoutubeId(url);
                    var cb = id && function() {
                        media.loadVideoById(id);
                    };
                    if (cb) {
                        if (media) {
                            cb();
                        } else {
                            this._callbacks = [cb];
                        }
                        return true;
                    }
                    return false;
                }
            };
        }

        return player;
    };

    /**
     * Defines a player object dedicated to native player
     * @param {mediaplayer} mediaplayer
     * @private
     */
    var _nativePlayer = function(mediaplayer) {
        var $media;
        var media;
        var player;
        var played;

        if (mediaplayer) {
            player = {
                init : function _nativePlayerInit() {
                    var result = false;
                    var mediaElem;

                    $media = mediaplayer.$media;
                    media = null;
                    played = false;

                    if ($media) {
                        mediaElem = $media.get(0);
                        if (mediaElem && mediaElem.canPlayType) {
                            media = mediaElem;
                            result = true;
                        }

                        if (!mediaplayer.is('nogui')) {
                            $media.removeAttr('controls');
                        }

                        $media
                            .on('play' + _ns, function() {
                                played = true;
                                mediaplayer._onPlay();
                            })
                            .on('pause' + _ns, function() {
                                mediaplayer._onPause();
                            })
                            .on('ended' + _ns, function() {
                                played = false;
                                mediaplayer._onEnd();
                            })
                            .on('timeupdate' + _ns, function() {
                                mediaplayer._onTimeUpdate();
                            })
                            .on('error' + _ns, function() {
                                mediaplayer._setState('error', true);
                            })
                            .on('loadedmetadata' + _ns, function() {
                                mediaplayer._onReady();
                            });
                    }

                    return result;
                },

                destroy : function _nativePlayerDestroy() {
                    if ($media) {
                        $media.off(_ns).attr('controls', '');
                    }

                    this.stop();

                    $media = null;
                    media = null;
                    played = false;
                },

                getPosition : function _nativePlayerGetPosition() {
                    if (media) {
                        return media.currentTime;
                    }
                    return 0;
                },

                getDuration : function _nativePlayerGetDuration() {
                    if (media) {
                        return media.duration;
                    }
                    return 0;
                },

                getVolume : function _nativePlayerGetVolume() {
                    var value = 0;
                    if (media) {
                        value = parseFloat(media.volume) * _volumeRange + _volumeMin;
                    }
                    return value;
                },

                setVolume : function _nativePlayerSetVolume(value) {
                    if (media) {
                        media.volume = (parseFloat(value) - _volumeMin) / _volumeRange;
                    }
                },

                setSize : function _nativePlayerSetSize(width, height) {
                    if ($media) {
                        $media.width(width).height(height);
                    }
                },

                seek : function _nativePlayerSeek(value) {
                    if (media) {
                        media.currentTime = parseFloat(value);
                        if (!played) {
                            this.play();
                        }
                    }
                },

                play : function _nativePlayerPlay() {
                    if (media) {
                        media.play();
                    }
                },

                pause : function _nativePlayerPause() {
                    if (media) {
                        media.pause();
                    }
                },

                stop : function _nativePlayerStop() {
                    if (media && played) {
                        media.currentTime = media.duration;
                    }
                },

                mute : function _nativePlayerMute(state) {
                    if (media) {
                        media.muted = !!state;
                    }
                },

                isMuted : function _nativePlayerIsMuted() {
                    if (media) {
                        return !!media.muted;
                    }
                    return false;
                },

                addMedia : function _nativePlayerSetMedia(url, type) {
                    type = type || _defaults.type;
                    if (media) {
                        if (!_checkSupport(media, type)) {
                            return false;
                        }
                    }

                    if (url && $media) {
                        $media.append('<source src="' + url + '" type="' + (_mimeTypes[type] || type) + '" />');
                        return true;
                    }
                    return false;
                },

                setMedia : function _nativePlayerSetMedia(url, type) {
                    if ($media) {
                        $media.empty();
                        return this.addMedia(url, type);
                    }
                    return false;
                }
            };
        }

        return player;
    };

    /**
     * Defines the list of available players
     * @type {Object}
     * @private
     */
    var _players = {
        'audio' : _nativePlayer,
        'video' : _nativePlayer,
        'youtube' : _youtubePlayer
    };

    /**
     * Defines a media player object
     * @type {Object}
     */
    var mediaplayer = {
        /**
         * Initializes the media player
         * @param {Object} config
         * @param {String} config.type - The type of media to play
         * @param {String|Array} config.url - The URL to the media
         * @param {String|jQuery|HTMLElement} [config.renderTo] - An optional container in which renders the player
         * @param {Boolean} [config.loop] - The media will be played continuously
         * @param {Boolean} [config.canPause] - The play can be paused
         * @param {Boolean} [config.startMuted] - The player should be initially muted
         * @param {Boolean} [config.autoStart] - The player starts as soon as it is displayed
         * @param {Number} [config.autoStartAt] - The time position at which the player should start
         * @param {Number} [config.maxPlays] - Sets a few number of plays (default: infinite)
         * @param {Number} [config.volume] - Sets the sound volume (default: 80)
         * @param {Number} [config.width] - Sets the width of the player (default: depends on media type)
         * @param {Number} [config.height] - Sets the height of the player (default: depends on media type)
         * @param {Function} [config.onrender] - Event listener called when the player is rendering
         * @param {Function} [config.onready] - Event listener called when the player is fully ready
         * @param {Function} [config.onplay] - Event listener called when the playback is starting
         * @param {Function} [config.onupdate] - Event listener called while the player is playing
         * @param {Function} [config.onpause] - Event listener called when the playback is paused
         * @param {Function} [config.onended] - Event listener called when the playback is ended
         * @param {Function} [config.onlimitreached] - Event listener called when the play limit has been reached
         * @param {Function} [config.ondestroy] - Event listener called when the player is destroying
         * @returns {mediaplayer}
         */
        init : function init(config) {
            var initConfig = config || {};

            this._initEvents(initConfig);
            this._initConfig(initConfig);
            this._initType(initConfig);
            this._initSize(initConfig);
            this._initSources(initConfig);
            this._initOptions(initConfig);

            if (initConfig.renderTo) {
                this.render(initConfig.renderTo);
            }

            return this;
        },

        /**
         * Uninstalls the media player
         * @returns {mediaplayer}
         */
        destroy : function destroy() {
            /**
             * Triggers a destroy event
             * @event mediaplayer#destroy
             * @param {mediaplayer} this
             */
            this.trigger('destroy', this);

            if (this.player) {
                this.player.destroy();
            }

            if (this.$component) {
                this._unbindEvents();
                this._destroySlider(this.$seekSlider);
                this._destroySlider(this.$volumeSlider);

                this.$component.remove();
            }

            this._reset();

            return this;
        },

        /**
         * Renders the media player according to the media type
         * @param {String|jQuery|HTMLElement} [to]
         * @returns {jQuery}
         */
        render : function render(to) {
            if (this.$component) {
                this.destroy();
            }

            this._initState();
            this._buildDom();
            this._updateDuration(0);
            this._updatePosition(0);
            this._bindEvents();
            this._playingState(false, true);
            this._initPlayer();

            this.resize(this.config.width, this.config.height);
            this.config.is.rendered = true;

            if (to) {
                $(to).append(this.$component);
            }

            /**
             * Triggers a render event
             * @event mediaplayer#render
             * @param {jQuery} $component
             * @param {mediaplayer} this
             */
            this.trigger('render', this.$component, this);

            return this.$component;
        },

        /**
         * Sets the start position inside the media
         * @param {Number} time - The start position in seconds
         * @param {*} [internal] - Internal use
         * @returns {mediaplayer}
         */
        seek : function seek(time, internal) {
            if (this._canPlay()) {
                this._updatePosition(time, internal);

                this.execute('seek', this.position);

                if (!this.is('ready')) {
                    this.autoStartAt = this.position;
                }
                this.loop = !!this.config.loop;
            }

            return this;
        },

        /**
         * Plays the media
         * @param {Number} [time] - An optional start position in seconds
         * @returns {mediaplayer}
         */
        play : function play(time) {
            if (this._canPlay()) {
                if (undefined !== time) {
                    this.seek(time);
                }

                this.execute('play');

                if (!this.is('ready')) {
                    this.autoStart = true;
                }

                this.loop = !!this.config.loop;
            }

            return this;
        },

        /**
         * Pauses the media
         * @param {Number} [time] - An optional time position in seconds
         * @returns {mediaplayer}
         */
        pause : function pause(time) {
            if (this._canPause()) {
                if (undefined !== time) {
                    this.seek(time);
                }

                this.execute('pause');

                if (!this.is('ready')) {
                    this.autoStart = false;
                }
            }

            return this;
        },

        /**
         * Resumes the media
         * @returns {mediaplayer}
         */
        resume : function resume() {
            if (this._canResume()) {
                this.play();
            }

            return this;
        },

        /**
         * Stops the playback
         * @returns {mediaplayer}
         */
        stop : function stop() {
            this.loop = false;
            this.execute('stop');

            if (!this.is('ready')) {
                this.autoStart = false;
            }

            return this;
        },

        /**
         * Restarts the media from the beginning
         * @returns {mediaplayer}
         */
        restart : function restart() {
            this.play(0);

            return this;
        },

        /**
         * Rewind the media to the beginning
         * @returns {mediaplayer}
         */
        rewind : function rewind() {
            this.seek(0);

            return this;
        },

        /**
         * Mutes the media
         * @param {Boolean} [state] - A flag to set the mute state (default: true)
         * @returns {mediaplayer}
         */
        mute : function mute(state) {
            if (undefined === state) {
                state = true;
            }
            this.execute('mute', state);
            this._setState('muted', state);

            if (!this.is('ready')) {
                this.startMuted = state;
            }

            return this;
        },

        /**
         * Restore the sound of the media after a mute
         * @returns {mediaplayer}
         */
        unmute : function unmute() {
            this.mute(false);

            return this;
        },

        /**
         * Sets the sound volume of the media being played
         * @param {Number} value - A value between 0 and 100
         * @param {*} [internal] - Internal use
         * @returns {mediaplayer}
         */
        setVolume : function setVolume(value, internal) {
            this._updateVolume(value, internal);

            this.execute('setVolume', this.volume);

            return this;
        },

        /**
         * Gets the sound volume applied to the media being played
         * @returns {Number} Returns a value between 0 and 100
         */
        getVolume : function getVolume() {
            return this.volume;
        },

        /**
         * Gets the current displayed position inside the media
         * @returns {Number}
         */
        getPosition : function getPosition() {
            return this.position;
        },

        /**
         * Gets the duration of the media
         * @returns {Number}
         */
        getDuration : function getDuration() {
            return this.duration;
        },

        /**
         * Gets the number of times the media has been played
         * @returns {Number}
         */
        getTimesPlayed : function getTimesPlayed() {
            return this.timesPlayed;
        },

        /**
         * Gets the type of player
         * @returns {String}
         */
        getType : function getType() {
            return this.config.type;
        },

        /**
         * Gets the underlying DOM element
         * @returns {jQuery}
         */
        getDom : function getDom() {
            return this.$component;
        },

        /**
         * Gets the list of media
         * @returns {Array}
         */
        getSources : function getSources() {
            return this.config.sources.slice();
        },

        /**
         * Sets the media source. If a source has been already set, it will be replaced.
         * @param {String|Object} src - The media URL, or an object containing the source and the type
         * @param {String} [type] - The media MIME type
         * @returns {mediaplayer}
         */
        setSource : function setSource(src, type) {
            var source = this._getSource(src, type);
            this.config.sources = [source];

            if (this.is('rendered')) {
                this.player.setMedia(source.src, source.type);
            }

            return this;
        },

        /**
         * Adds a media source.
         * @param {String|Object} src - The media URL, or an object containing the source and the type
         * @param {String} [type] - The media MIME type
         * @returns {mediaplayer}
         */
        addSource : function addSource(src, type) {
            var source = this._getSource(src, type);
            this.config.sources.push(source);

            if (this.is('rendered')) {
                this.player.addMedia(source.src, source.type);
            }

            return this;
        },

        /**
         * Tells if the media is in a particular state
         * @param {String} state
         * @returns {Boolean}
         */
        is : function is(state) {
            return !!this.config.is[state];
        },

        /**
         * Changes the size of the player
         * @param {Number} width
         * @param {Number} height
         * @returns {mediaplayer}
         */
        resize : function resize(width, height) {
            var type = this.is('video') ? 'video' : 'audio';
            var defaults = _defaults[type] || _defaults.video;

            width = Math.max(defaults.minWidth, width);
            height = Math.max(defaults.minHeight, height);

            if (this.$component) {
                height -= this.$component.outerHeight() - this.$component.height();
                width -= this.$component.outerWidth() - this.$component.width();
                this.$component.width(width).height(height);

                if (!this.is('nogui')) {
                    height -= this.$controls.outerHeight();
                }
            }

            this.execute('setSize', width, height);

            return this;
        },

        /**
         * Enables the media player
         * @returns {mediaplayer}
         */
        enable : function enable() {
            this._fromState('disabled');

            return this;
        },

        /**
         * Disables the media player
         * @returns {mediaplayer}
         */
        disable : function disable() {
            this._toState('disabled');

            return this;
        },

        /**
         * Shows the media player
         * @returns {mediaplayer}
         */
        show : function show() {
            this._fromState('hidden');

            return this;
        },

        /**
         * hides the media player
         * @returns {mediaplayer}
         */
        hide : function hide() {
            this._toState('hidden');

            return this;
        },

        /**
         * Gets a source descriptor.
         * @param {String|Object} src - The media URL, or an object containing the source and the type
         * @param {String} [type] - The media MIME type
         * @returns {Object}
         */
        _getSource : function _getSource(src, type) {
            var source;

            if (_.isString(src)) {
                source = {
                    src : src
                };
            } else {
                source = _.clone(src);
            }

            if (!source.type) {
                source.type = type || _defaults.type;
            }

            if (this.is('youtube')) {
                source.id = _extractYoutubeId(source.src);
            }

            return source;
        },

        /**
         * Installs the events manager onto the instance
         * @private
         */
        _initEvents : function _initEvents() {
            var triggerEvent;

            eventifier(this);

            triggerEvent = this.trigger;
            this.trigger = function trigger(eventName) {
                if (this.$component) {
                    this.$component.trigger(eventName + _ns, _slice.call(arguments, 1));
                }
                return triggerEvent.apply(this, arguments);
            };
        },

        /**
         * Loads the config set
         * @param {Object} config - The initial config set
         * @private
         */
        _initConfig : function _initConfig(config) {
            var self = this;
            this.config = _.omit(config, function(value, name) {
                var omit = value === undefined || value === null;

                if (!omit && name.length > 3 && name.indexOf('on') === 0) {
                    self.on(name.substr(2), value);
                    omit = true;
                }
                return omit;
            });
        },

        /**
         * Ensures the right media type is set
         * @param {Object} config - The initial config set
         * @private
         */
        _initType : function _initType(config) {
            var type = '' + (this.config.type || _defaults.type);
            var isYoutube = false;
            var isVideo = false;
            var isAudio = false;

            if (type.indexOf('application/ogg') !== -1) {
                type = 'video/ogg';
                _.forEach(_configToSources(config), function(source) {
                    var url = source.src || source;
                    var ext = url && url.substr(-4);
                    if (ext === '.ogg' || ext === '.oga') {
                        type = 'audio/ogg';
                        return false;
                    }
                });
            }

            if (type.indexOf('youtube') !== -1) {
                type = 'youtube';
                isYoutube = true;
                isVideo = true;
            } else if (type.indexOf('video') === 0) {
                type = 'video';
                isVideo = true;
            } else if (type.indexOf('audio') === 0) {
                type = 'audio';
                isAudio = true;
            }

            this.config.type = type;
            this.kind = {
                audio : isAudio,
                video : isVideo,
                youtube : isYoutube
            };

            this._reset();
        },

        /**
         * Ensures the right size is set according to the media type
         * @private
         */
        _initSize : function _initSize() {
            var type = this.is('video') ? 'video' : 'audio';
            var defaults = _defaults[type] || _defaults.video;

            this.config.width = _.parseInt(this.config.width) || defaults.width;
            this.config.height = _.parseInt(this.config.height) || defaults.height;
        },

        /**
         * Ensures the sources are correctly set
         * @param {Object} config - The initial config set
         * @private
         */
        _initSources : function _initSources(config) {
            var self = this;
            var sources = _configToSources(config);

            this.config.sources = [];

            _.forEach(sources, function(source) {
                self.addSource(source, config.type);
            });
        },

        /**
         * Ensures some options are sets
         * @private
         */
        _initOptions : function _initOptions() {
            _.defaults(this.config, _defaults.options);

            // these options can be overridden by the GUI
            this.volume = this.config.volume;
            this.autoStart = this.config.autoStart;
            this.autoStartAt = this.config.autoStartAt;
            this.startMuted = this.config.startMuted;
        },

        /**
         * Initializes the right player instance
         * @private
         */
        _initPlayer : function _initPlayer() {
            var player = _players[this.config.type];
            var error;

            if (_support.canPlay(this.config.type)) {
                if (_.isFunction(player)) {
                    this.player = player(this);
                }

                if (this.player) {
                    error = !this.player.init();
                } else {
                    error = true;
                }
            } else {
                error = true;
            }

            this._setState('error', error);
            this._setState('nogui', !_support.canControl());
        },

        /**
         * Initializes the player state
         * @private
         */
        _initState : function _initState() {
            var isCORS = false;
            var page;

            if (!this.is('youtube')) {
                page = new UrlParser(window.location);
                _.forEach(this.config.sources, function(source) {
                    var url = new UrlParser(source.src);
                    if (!url.checkCORS(page)) {
                        isCORS = true;
                        return false;
                    }
                });
            }

            this._setState('cors', isCORS);
            this._setState('ready', false);
        },

        /**
         * Resets the internals attributes
         * @private
         */
        _reset : function _reset() {
            this.config.is = _.clone(this.kind);

            this.$component = null;
            this.$player = null;
            this.$media = null;
            this.$controls = null;
            this.$seek = null;
            this.$seekSlider = null;
            this.$volume = null;
            this.$volumeSlider = null;
            this.$position = null;
            this.$duration = null;
            this.player = null;

            this.duration = 0;
            this.position = 0;
            this.timesPlayed = 0;
        },

        /**
         * Builds the DOM content
         * @private
         */
        _buildDom : function _buildDom() {
            this.$component = $(playerTpl(this.config));
            this.$player = this.$component.find('.player');
            this.$media = this.$component.find('.media');
            this.$controls = this.$component.find('.controls');

            this.$seek = this.$controls.find('.seek .slider');
            this.$volume = this.$controls.find('.volume .slider');
            this.$position = this.$controls.find('[data-control="time-cur"]');
            this.$duration = this.$controls.find('[data-control="time-end"]');

            this.$volumeSlider = this._renderSlider(this.$volume, this.volume, _volumeMin, _volumeMax, this.is('video'));
        },

        /**
         * Renders a slider onto an element
         * @param {jQuery} $elt - The element on which renders the slider
         * @param {Number} [value] - The current value of the slider
         * @param {Number} [min] - The min value of the slider
         * @param {Number} [max] - The max value of the slider
         * @param {Boolean} [vertical] - Tells if the slider must be vertical
         * @returns {jQuery} - Returns the element
         * @private
         */
        _renderSlider : function _renderSlider($elt, value, min, max, vertical) {
            var orientation, direction;

            if (vertical) {
                orientation = 'vertical';
                direction = 'rtl';
            } else {
                orientation = 'horizontal';
                direction = 'ltr';
            }

            return $elt.noUiSlider({
                start: _ensureNumber(value) || 0,
                step: 1,
                connect: 'lower',
                orientation: orientation,
                direction: direction,
                animate: true,
                range: {
                    min: _ensureNumber(min) || 0,
                    max : _ensureNumber(max) || 0
                }
            })
        },

        /**
         * Destroys a slider bound to an element
         * @param {jQuery} $elt
         * @private
         */
        _destroySlider : function _destroySlider($elt) {
            if ($elt) {
                $elt.get(0).destroy();
            }
        },

        /**
         * Binds events onto the rendered player
         * @private
         */
        _bindEvents : function _bindEvents() {
            var self = this;

            this.$component.on('contextmenu' + _ns, function(event) {
                event.preventDefault();
            });

            this.$controls.on('click' + _ns, '.action', function(event) {
                var $target = $(event.target);
                var $action = $target.closest('.action');
                var id = $action.data('control');

                if (_.isFunction(self[id])) {
                    self[id]();
                }
            });

            this.$player.on('click' + _ns, function() {
                if (self.is('playing')) {
                    self.pause();
                } else {
                    self.play();
                }
            });

            this.$seek.on('change' + _ns, function(event, value) {
                self.seek(value, true);
            });

            this.$volume.on('change' + _ns, function(event, value) {
                self.unmute();
                self.setVolume(value, true);
            });
        },

        /**
         * Unbinds events from the rendered player
         * @private
         */
        _unbindEvents : function _unbindEvents() {
            this.$component.off(_ns);
            this.$player.off(_ns);
            this.$controls.off(_ns);
            this.$seek.off(_ns);
            this.$volume.off(_ns);
        },

        /**
         * Updates the volume slider
         * @param {Number} value
         * @private
         */
        _updateVolumeSlider : function _updateVolumeSlider(value) {
            if (this.$volumeSlider) {
                this.$volumeSlider.val(value);
            }
        },

        /**
         * Updates the displayed volume
         * @param {Number} value
         * @param {*} [internal]
         * @private
         */
        _updateVolume : function _updateVolume(value, internal) {
            this.volume = Math.max(_volumeMin, Math.min(_volumeMax, parseFloat(value)));

            if (!internal) {
                this._updateVolumeSlider(value);
            }
        },

        /**
         * Updates the time slider
         * @param {Number} value
         * @private
         */
        _updatePositionSlider : function _updatePositionSlider(value) {
            if (this.$seekSlider) {
                this.$seekSlider.val(value);
            }
        },

        /**
         * Updates the time label
         * @param {Number} value
         * @private
         */
        _updatePositionLabel : function _updatePositionLabel(value) {
            if (this.$position) {
                this.$position.text(_timerFormat(value));
            }
        },

        /**
         * Updates the displayed time position
         * @param {Number} value
         * @param {*} [internal]
         * @private
         */
        _updatePosition : function _updatePosition(value, internal) {
            this.position = Math.max(0, Math.min(this.duration, parseFloat(value)));

            if (!internal) {
                this._updatePositionSlider(this.position);
            }
            this._updatePositionLabel(this.position);
        },

        /**
         * Updates the duration slider
         * @param {Number} value
         * @private
         */
        _updateDurationSlider : function _updateDurationSlider(value) {
            if (this.$seekSlider) {
                this._destroySlider(this.$seekSlider);
                this.$seekSlider = null;
            }

            if (value && isFinite(value)) {
                this.$seekSlider = this._renderSlider(this.$seek, 0, 0, value);
            }
        },

        /**
         * Updates the duration label
         * @param {Number} value
         * @private
         */
        _updateDurationLabel : function _updateDurationLabel(value) {
            if (this.$duration) {
                if (value && isFinite(value)) {
                    this.$duration.text(_timerFormat(value)).show();
                } else {
                    this.$duration.hide();
                }
            }
        },

        /**
         * Updates the displayed duration
         * @param {Number} value
         * @private
         */
        _updateDuration : function _updateDuration(value) {
            this.duration = Math.abs(parseFloat(value));
            this._updateDurationSlider(this.duration);
            this._updateDurationLabel(this.duration);
        },

        /**
         * Event called when the media is ready
         * @private
         */
        _onReady : function _onReady() {
            this._updateDuration(this.player.getDuration());
            this._setState('ready', true);
            this._setState('canplay', true);
            this._setState('canpause', this.config.canPause);

            /**
             * Triggers a media ready event
             * @event mediaplayer#ready
             * @param {mediaplayer} this
             */
            this.trigger('ready', this);

            // set the initial state
            this.setVolume(this.volume);
            this.mute(!!this.startMuted);
            if (this.autoStartAt) {
                this.seek(this.autoStartAt);
            } else if (this.autoStart) {
                this.play();
            }
        },

        /**
         * Event called when the media is played
         * @private
         */
        _onPlay : function _onPlay() {
            this._playingState(true);

            /**
             * Triggers a media playback event
             * @event mediaplayer#play
             * @param {mediaplayer} this
             */
            this.trigger('play', this);
        },

        /**
         * Event called when the media is paused
         * @private
         */
        _onPause : function _onPause() {
            this._playingState(false);

            /**
             * Triggers a media paused event
             * @event mediaplayer#pause
             * @param {mediaplayer} this
             */
            this.trigger('pause', this);
        },

        /**
         * Event called when the media is ended
         * @private
         */
        _onEnd : function _onEnd() {
            this.timesPlayed ++;
            this._playingState(false, true);
            this._updatePosition(0);

            /**
             * Triggers a media ended event
             * @event mediaplayer#ended
             * @param {mediaplayer} this
             */
            this.trigger('ended', this);

            // disable GUI when the play limit is reached
            if (this._playLimitReached()) {
                this._setState('ready', false);
                this._setState('canplay', false);

                /**
                 * Triggers a play limit reached event
                 * @event mediaplayer#limitreached
                 * @param {mediaplayer} this
                 */
                this.trigger('limitreached', this);
            } else {
                if (this.loop) {
                    this.restart();
                }
            }
        },

        /**
         * Event called when the time position has changed
         * @private
         */
        _onTimeUpdate : function _onTimeUpdate() {
            this._updatePosition(this.player.getPosition());

            /**
             * Triggers a media time update event
             * @event mediaplayer#update
             * @param {mediaplayer} this
             */
            this.trigger('update', this);
        },

        /**
         * Checks if the play limit has been reached
         * @returns {Boolean}
         * @private
         */
        _playLimitReached : function _playLimitReached() {
            return this.config.maxPlays && this.timesPlayed >= this.config.maxPlays;
        },

        /**
         * Checks if the media can be played
         * @returns {Boolean}
         * @private
         */
        _canPlay : function _canPlay() {
            return  this.is('ready') && !this.is('disabled') && !this.is('hidden') && !this._playLimitReached();
        },

        /**
         * Checks if the media can be paused
         * @returns {Boolean}
         * @private
         */
        _canPause : function _canPause() {
            return !!this.config.canPause;
        },

        /**
         * Checks if the playback can be resumed
         * @returns {Boolean}
         * @private
         */
        _canResume : function _canResume() {
            return  this.is('paused') && this._canPlay();
        },

        /**
         * Sets the media is in a particular state
         * @param {String} name
         * @param {Boolean} value
         * @returns {mediaplayer}
         */
        _setState : function _setState(name, value) {
            value = !!value;

            this.config.is[name] = value;

            if (this.$component) {
                this.$component.toggleClass(name, value);
            }

            return this;
        },

        /**
         * Restores the media player from a particular state and resumes the playback
         * @param {String} stateName
         * @returns {mediaplayer}
         * @private
         */
        _fromState : function _fromState(stateName) {
            this._setState(stateName, false);
            this.resume();

            return this;
        },

        /**
         * Sets the media player to a particular state and pauses the playback
         * @param {String} stateName
         * @returns {mediaplayer}
         * @private
         */
        _toState : function _toState(stateName) {
            this.pause();
            this._setState(stateName, true);

            return this;
        },

        /**
         * Sets the playing state
         * @param {Boolean} state
         * @param {Boolean} [ended]
         * @returns {mediaplayer}
         * @private
         */
        _playingState : function _playingState(state, ended) {
            this._setState('playing', !!state);
            this._setState('paused', !state);
            this._setState('ended', !!ended);

            return this;
        },

        /**
         * Executes a command onto the media
         * @param {String} command - The name of the command to execute
         * @returns {*}
         * @private
         */
        execute : function execute(command) {
            var ctx = this.player;
            var method = ctx && ctx[command];

            if (_.isFunction(method)) {
                return method.apply(ctx, _slice.call(arguments, 1));
            }
        }
    };

    /**
     * Builds a media player instance
     * @param {Object} config
     * @param {String} config.type - The type of media to play
     * @param {String|Array} config.url - The URL to the media
     * @param {String|jQuery|HTMLElement} [config.renderTo] - An optional container in which renders the player
     * @param {Boolean} [config.loop] - The media will be played continuously
     * @param {Boolean} [config.canPause] - The play can be paused
     * @param {Boolean} [config.startMuted] - The player should be initially muted
     * @param {Boolean} [config.autoStart] - The player starts as soon as it is displayed
     * @param {Number} [config.autoStartAt] - The time position at which the player should start
     * @param {Number} [config.maxPlays] - Sets a few number of plays (default: infinite)
     * @param {Number} [config.volume] - Sets the sound volume (default: 80)
     * @param {Number} [config.width] - Sets the width of the player (default: depends on media type)
     * @param {Number} [config.height] - Sets the height of the player (default: depends on media type)
     * @param {Function} [config.onrender] - Event listener called when the player is rendering
     * @param {Function} [config.onready] - Event listener called when the player is fully ready
     * @param {Function} [config.onplay] - Event listener called when the playback is starting
     * @param {Function} [config.onupdate] - Event listener called while the player is playing
     * @param {Function} [config.onpause] - Event listener called when the playback is paused
     * @param {Function} [config.onended] - Event listener called when the playback is ended
     * @param {Function} [config.onlimitreached] - Event listener called when the play limit has been reached
     * @param {Function} [config.ondestroy] - Event listener called when the player is destroying
     * @returns {mediaplayer}
     */
    var mediaplayerFactory = function mediaplayerFactory(config) {
        var player = _.clone(mediaplayer);
        return player.init(config);
    };

    /**
     * Tells if the browser can play audio and video
     * @param {String} [type] The type of media (audio or video)
     * @param {String} [mime] A media MIME type to check
     * @type {Boolean}
     */
    mediaplayerFactory.canPlay = function canPlay(type, mime) {
        return _support.canPlay(type, mime);
    };

    /**
     * Tells if the browser can play audio
     * @param {String} [mime] A media MIME type to check
     * @type {Boolean}
     */
    mediaplayerFactory.canPlayAudio = function canPlayAudio(mime) {
        return _support.canPlayAudio(mime);
    };

    /**
     * Tells if the browser can play video
     * @param {String} [mime] A media MIME type to check
     * @type {Boolean}
     */
    mediaplayerFactory.canPlayVideo = function canPlayVideo(mime) {
        return _support.canPlayVideo(mime);
    };

    /**
     * Checks if the browser allows to control the media playback
     * @returns {Boolean}
     */
    mediaplayerFactory.canControl = function canControl() {
        return _support.canControl();
    };

    /**
     * The polling interval used to update the progress bar while playing a YouTube video.
     * Note : the YouTube API does not provide events to update this progress bar...
     * @type {Number}
     */
    mediaplayerFactory.youtubePolling = 100;

    return mediaplayerFactory;
});
