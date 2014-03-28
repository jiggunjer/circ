// Generated by CoffeeScript 1.4.0
(function() {
  "use strict";
  var ServerResponseHandler, exports, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  var exports = (_ref = window.irc) != null ? _ref : window.irc = {};

  //
  // Handles messages from an IRC server.
  //
  // Good references for numeric (raw) response codes:
  // https://www.alien.net.au/irc/irc2numerics.html
  // http://www.mirc.org/mishbox/reference/rawhelp.htm
  //
  ServerResponseHandler = (function(_super) {

    __extends(ServerResponseHandler, _super);

    function ServerResponseHandler(irc) {
      this.irc = irc;
      ServerResponseHandler.__super__.constructor.apply(this, arguments);
      this.ctcpHandler = new window.irc.CTCPHandler;
    }

    ServerResponseHandler.prototype.canHandle = function(type) {
      if (this._isErrorMessage(type)) {
        return true;
      } else {
        return ServerResponseHandler.__super__.canHandle.call(this, type);
      }
    };

    // Handle a message of the given type. Error messages are handled with the
    // default error handler unless a handler is explicitly specified.
    // @param {string} type The type of message (e.g. PRIVMSG).
    // @param {object...} params A variable number of arguments.
    //
    ServerResponseHandler.prototype.handle = function() {
      var params, type;
      type = arguments[0], params = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      if (this._isErrorMessage(type) && !(type in this._handlers)) {
        type = 'error';
      }
      return ServerResponseHandler.__super__.handle.apply(this, [type].concat(__slice.call(params)));
    };

    ServerResponseHandler.prototype._isErrorMessage = function(type) {
      var _ref1;
      return (400 <= (_ref1 = parseInt(type)) && _ref1 < 600);
    };

    ServerResponseHandler.prototype._handlers = {
      // RPL_WELCOME
      1: function(from, nick, msg) {
        var chan, _results;
        if (this.irc.state === 'disconnecting') {
          this.irc.quit();
          return;
        }
        this.irc.nick = nick;
        this.irc.state = 'connected';
        this.irc.emit('connect');
        this.irc.emitMessage('welcome', chat.SERVER_WINDOW, msg);
        _results = [];
        for (chan in this.irc.channels) {
          if (this.irc.channels[chan].key) {
            _results.push(this.irc.send('JOIN', chan, this.irc.channels[chan].key));
          } else {
            _results.push(this.irc.send('JOIN', chan));
          }
        }
        return _results;
      },

      // RPL_ISUPPORT
      // We might get multiple, so this just adds to the support object.
      //
      5: function() {
        // Parameters passed in arguments, pull out the parts we want.
        var m = Array.prototype.slice.call(arguments, 2, arguments.length - 1);
        for (var i = 0; i < m.length; i++) {
          var param = m[i].split(/=/, 2);
          var k = param[0].toLowerCase();
          if (param.length == 1)
            this.irc.support[k] = true;
          else
            this.irc.support[k] = param[1];
        }
      },

      // RPL_NAMREPLY
      353: function(from, target, privacy, channel, names) {
        var n, nameList, newNames, _base, _i, _len, _ref1, _ref2;
        nameList = (_ref1 = (_base = this.irc.partialNameLists)[channel]) != null ? _ref1 : _base[channel] = {};
        newNames = [];
        _ref2 = names.split(/\x20/);
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          n = _ref2[_i];
          /*
           * TODO: read the prefixes and modes that they imply out of the 005
           * message
           */

          n = n.replace(/^[~&@%+]/, '');
          if (n) {
            nameList[irc.util.normaliseNick(n)] = n;
            newNames.push(n);
          }
        }
        return this.irc.emit('names', channel, newNames);
      },

      // RPL_ENDOFNAMES
      366: function(from, target, channel, _) {
        if (this.irc.channels[channel]) {
          this.irc.channels[channel].names = this.irc.partialNameLists[channel];
        }
        return delete this.irc.partialNameLists[channel];
      },

      NICK: function(from, newNick, msg) {
        var chan, chanName, newNormNick, normNick, _ref1, _results;
        if (this.irc.isOwnNick(from.nick)) {
          this.irc.nick = newNick;
          this.irc.emit('nick', newNick);
          this.irc.emitMessage('nick', chat.SERVER_WINDOW, from.nick, newNick);
        }
        normNick = this.irc.util.normaliseNick(from.nick);
        newNormNick = this.irc.util.normaliseNick(newNick);
        _ref1 = this.irc.channels;
        _results = [];
        for (chanName in _ref1) {
          chan = _ref1[chanName];
          if (!(normNick in chan.names)) {
            continue;
          }
          delete chan.names[normNick];
          chan.names[newNormNick] = newNick;
          _results.push(this.irc.emitMessage('nick', chanName, from.nick, newNick));
        }
        return _results;
      },

      JOIN: function(from, chanName) {
        var chan = this.irc.channels[chanName];
        if (this.irc.isOwnNick(from.nick)) {
          if (chan != null) {
            chan.names = [];
          } else {
            chan = this.irc.channels[chanName] = {
              names: []
            };
          }
          this.irc.emit('joined', chanName);
        }
        if (chan) {
          chan.names[irc.util.normaliseNick(from.nick)] = from.nick;
          return this.irc.emitMessage('join', chanName, from.nick);
        } else {
          return console.warn("Got JOIN for channel we're not in (" + chan + ")");
        }
      },

      PART: function(from, chan) {
        var c;
        if (c = this.irc.channels[chan]) {
          this.irc.emitMessage('part', chan, from.nick);
          if (this.irc.isOwnNick(from.nick)) {
            delete this.irc.channels[chan];
            return this.irc.emit('parted', chan);
          } else {
            return delete c.names[irc.util.normaliseNick(from.nick)];
          }
        } else {
          return console.warn("Got TOPIC for a channel we're not in: " + chan);
        }
      },

      INVITE: function(from, target, channel) {
        return this.irc.emitMessage('notice', chat.CURRENT_WINDOW, from.nick + ' invites you to join ' + channel);
      },

      QUIT: function(from, reason) {
        var chan, chanName, normNick, _ref1, _results;
        normNick = irc.util.normaliseNick(from.nick);
        _ref1 = this.irc.channels;
        _results = [];
        for (chanName in _ref1) {
          chan = _ref1[chanName];
          if (!(normNick in chan.names)) {
            continue;
          }
          delete chan.names[normNick];
          _results.push(this.irc.emitMessage('quit', chanName, from.nick, reason));
        }
        return _results;
      },

      PRIVMSG: function(from, target, msg) {
        if (this.ctcpHandler.isCTCPRequest(msg)) {
          return this._handleCTCPRequest(from, target, msg);
        } else {
          return this.irc.emitMessage('privmsg', target, from.nick, msg);
        }
      },

      NOTICE: function(from, target, msg) {
        if (!from.user) {
          return this.irc.emitMessage('notice', chat.SERVER_WINDOW, msg);
        }
        var event = new Event('message', 'privmsg', from.nick, msg);
        event.setContext(this.irc.server, chat.CURRENT_WINDOW);
        event.addStyle('notice');
        return this.irc.emitCustomMessage(event);
      },

      PING: function(from, payload) {
        return this.irc.send('PONG', payload);
      },

      PONG: function(from, payload) {},

      TOPIC: function(from, channel, topic) {
        if (this.irc.channels[channel] != null) {
          this.irc.channels[channel].topic = topic;
          return this.irc.emitMessage('topic', channel, from.nick, topic);
        } else {
          return console.warn("Got TOPIC for a channel we're not in (" + channel + ")");
        }
      },

      KICK: function(from, channel, to, reason) {
        if (!this.irc.channels[channel]) {
          console.warn("Got KICK message from " + from + " to " + to + " in channel we are not in (" + channel + ")");
          return;
        }
        delete this.irc.channels[channel].names[to];
        this.irc.emitMessage('kick', channel, from.nick, to, reason);
        if (this.irc.isOwnNick(to)) {
          return this.irc.emit('parted', channel);
        }
      },

      MODE: function(from, chan, mode, to) {
        return this.irc.emitMessage('mode', chan, from.nick, to, mode);
      },

      // RPL_UMODEIS
      221: function(from, to, mode) {
        return this.irc.emitMessage('user_mode', chat.CURRENT_WINDOW, to, mode);
      },

      // RPL_AWAY
      301: function(from, to, nick, msg) {
        var message = "is away: " + msg;
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_UNAWAY
      305: function(from, to, msg) {
        this.irc.away = false;
        return this.irc.emitMessage('away', chat.CURRENT_WINDOW, msg);
      },

      // RPL_NOWAWAY
      306: function(from, to, msg) {
        this.irc.away = true;
        return this.irc.emitMessage('away', chat.CURRENT_WINDOW, msg);
      },

      // RPL_WHOISHELPOP (and others; overloaded)
      310: function(from, to, nick, msg) {}, // not useful; drop it

      // RPL_WHOISUSER
      311: function(from, to, nick, user, addr, _, info) {
        var message = "is " + nick + "!" + user + "@" + addr + " (" + info + ")";
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_WHOISSERVER
      312: function(from, to, nick, server, desc) {
        var message = "connected via " + server + " (" + desc + ")";
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_WHOISOPERATOR (is an IRCOp)
      313: function(from, to, nick, msg) {
        // server supplies the message text
        return this._emitUserNotice(to, nick, msg);
      },

      // RPL_WHOWASUSER
      314: function(from, to, nick, user, addr, _, info) {
        var message = "was " + nick + "!" + user + "@" + addr + " (" + info + ")";
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_ENDOFWHO
      315: function(from, to, nick, msg) {
        // server supplies the message text
        return this.irc.emitMessage('notice', chat.SERVER_WINDOW, msg);
      },

      // RPL_WHOISIDLE
      317: function(from, to, nick, seconds, signon, _) {
        var date = getReadableTime(parseInt(signon) * 1000);
        var message = "has been idle for " + seconds + " seconds, and signed on at: " + date;
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_ENDOFWHOIS
      318: function(from, to, nick, msg) {
        // server supplies the message text
        return this._emitUserNotice(to, nick, msg);
      },

      // RPL_WHOISCHANNELS
      319: function(from, to, nick, channels) {
        var message = "is on channels: " + channels;
        return this._emitUserNotice(to, nick, message);
      },

      //321 LIST START
      //322 LIST ENTRY
      //323 END OF LIST
      322: function(from, to, channel, users, topic) {
        var message = channel + " " + users + " " + topic;
        return this.irc.emitMessage('list', chat.SERVER_WINDOW, channel, users, topic);
      },


      // RPL_CHANNELMODEIS
      324: function(from, to, channel, mode, modeParams) {
        var message = "Channel modes: " + mode + " " + (modeParams != null ? modeParams : '');
        return this.irc.emitMessage('notice', channel, message);
      },

      // RPL_CHANNELCREATED
      329: function(from, to, channel, secondsSinceEpoch) {
        var message = "Channel created on " + (getReadableTime(parseInt(secondsSinceEpoch * 1000)));
        return this.irc.emitMessage('notice', channel, message);
      },

      // RPL_WHOISACCOUNT (NickServ registration)
      330: function(from, to, nick, loggedin, msg) {
        var message = msg + " " + loggedin;
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_NOTOPIC
      331: function(from, to, channel, msg) {
        return this.handle('TOPIC', {}, channel);
      },

      // RPL_TOPIC
      332: function(from, to, channel, topic) {
        return this.handle('TOPIC', {}, channel, topic);
      },

      // RPL_TOPICWHOTIME
      333: function(from, to, channel, who, time) {
        return this.irc.emitMessage('topic_info', channel, who, time);
      },

      // RPL_WHOISACTUALLY (ircu, and others)
      338: function(from, to, nick, realident, realip, msg) {
        var message = "is actually " + realident + "/" + realip + " (" + msg + ")";
        return this._emitUserNotice(to, nick, message);
      },

      // RPL_WHOREPLY
      352: function(from, to, chan, ident, addr, serv, nick, flags, data) {
        var space = data.indexOf(' ');
        var m1 = chan + ": " + nick;
        var m2 = (flags.substring(0, 1) == "G" ? " (AWAY)" : "");
        var m3 = " | " + ident + "@" + addr + " (" + data.substring(space + 1) +
          ") | via " + serv + ", hops " + data.substring(0, space);
        return this.irc.emitMessage('notice', chat.SERVER_WINDOW, m1 + m2 + m3);
      },

      // RPL_ENDOFWHOWAS
      369: function(from, to, nick, msg) {
        // server supplies the message text
        return this._emitUserNotice(to, nick, msg);
      },

      // Overloaded by Freenode, ignorable WHOIS reply (repeat of info in 311)
      378: function(from, to, nick, msg) {},

      // ERR_NICKNAMEINUSE
      433: function(from, nick, taken) {
        var newNick = taken + '_';
        if (nick === newNick) {
          newNick = void 0;
        }
        this.irc.emitMessage('nickinuse', chat.CURRENT_WINDOW, taken, newNick);
        if (newNick) {
          return this.irc.send('NICK', newNick);
        }
      },

      // RPL_WHOISSECURE
      671: function(from, to, nick, msg) {
        // server supplies the message text
        return this._emitUserNotice(to, nick, msg);
      },

      // The default error handler for error messages. This handler is used for
      // all 4XX error messages unless a handler is explicitly specified.
      //
      // Messages are displayed in the following format:
      // "<arg1> <arg2> ... <argn>: <message>
      //
      error: function() {
        var args, from, message, msg, to, _i;
        from = arguments[0], to = arguments[1], args = 4 <= arguments.length ? __slice.call(arguments, 2, _i = arguments.length - 1) : (_i = 2, []), msg = arguments[_i++];
        if (args.length > 0) {
          message = "" + (args.join(' ')) + " :" + msg;
        } else {
          message = msg;
        }
        return this.irc.emitMessage('error', chat.CURRENT_WINDOW, message);
      },

      KILL: function(from, victim, killer, msg) {
        return this.irc.emitMessage('kill', chat.CURRENT_WINDOW, killer.nick, victim, msg);
      }
    };

    ServerResponseHandler.prototype._handleCTCPRequest = function(from, target, msg) {
      var message, name, response, _i, _len, _ref1, _results;
      name = this.ctcpHandler.getReadableName(msg);
      message = "Received a CTCP " + name + " from " + from.nick;
      this.irc.emitMessage('notice', chat.CURRENT_WINDOW, message);
      _ref1 = this.ctcpHandler.getResponses(msg);
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        response = _ref1[_i];
        _results.push(this.irc.doCommand('NOTICE', from.nick, response, true));
      }
      return _results;
    };

    // Called by various nick-specific raw server responses (e.g., /WHOIS
    // responses).
    ServerResponseHandler.prototype._emitUserNotice = function(to, nick, msg) {
      var event = new Event('message', 'privmsg', nick, msg);
      event.setContext(this.irc.server, to);
      event.addStyle('notice');
      return this.irc.emitCustomMessage(event);
    };

    return ServerResponseHandler;

  })(MessageHandler);

  exports.ServerResponseHandler = ServerResponseHandler;

}).call(this);
