var irc = require("irc");
var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var request = require('request');
var cheerio = require('cheerio');
var config = require('./config.json')
var app = express();


var bot = new irc.Client(config.server, config.botName, {userName: config.userName,
                                                         realName: config.realName,
                                                         channels: config.channels,
                                                         floodProtection: true,
                                                         autoRejoin: true});

app.use(bodyParser.json({
    // Additional verify function, creating a digest on the fly
    verify: function(req, res, buf, encoding) {

        //sha1 content
        var hash = crypto.createHmac('sha1', config.secret);
        hash.update(buf);
        req.hash = 'sha1=' + hash.digest('hex');

        // get rawBody        
        req.rawBody = buf.toString();
    }
}));

// Respond kindly to questions
app.get('/', function(request, response) {
      response.status(200).send('Oh, hi.');
});

// Webhook handler
app.post('/', function(request, response) {
    // TODO: Use a constant-time comparison of hashes for security
      if (request.headers['x-hub-signature'] == request.hash 
            && request.headers['x-github-event'] == "push") {
            var branch = request.body.ref.replace('refs/heads/','');
            var message = request.body.repository.full_name + " (" + branch +") przez " + request.body.head_commit.committer.name + ': ' + request.body.head_commit.message
            var chanLength = config.channels.length
            for (var i = 0; i < chanLength; i++) {
                bot.say(config.channels[i], message);
                bot.say(config.channels[i], "Url: " + request.body.head_commit.url);
            };
            response.json({msg: "Thank you."});
      } else {
         response.status(403).json({msg: "Wrong hash or event type"});  
      };
});
app.listen(config.port);


// IRC Bot features
var parseMessage = function(message) {
    if (config.autorespond.enabled && message.args[1].indexOf(config.botName) == 0) {
        var randInt = Math.floor(Math.random() * config.autorespond.messages.length);
        bot.say(message.args[0], message.nick + ": " + config.autorespond.messages[randInt]);
    }
};

var sendWelcome = function(channel, nick, message) {
    if ( nick === config.botName ) {
        bot.say(channel, config.joinMsg.message.replace("%channel%", channel))
    };
};

// IRC Event handlers
bot.addListener("message", function(from, to, text, message) {
    parseMessage(message);
});

if (config.joinMsg.enabled) {
    bot.addListener("join", sendWelcome);
}

var sendBashMessage = function() {
    var minutes = config.bashMessages.interval, interval = minutes * 60 * 1000;
    if (minutes > 0) {
        setInterval(function() {
            for (var i = 0; i < config.channels.length; i++) {
                (function(index) {
                    request(config.bashMessages.url,function(error, response, html){
                        if (!error) {
                            var $ = cheerio.load(html);
                            $(config.bashMessages.tag).each(function(i, e) {
                                bot.say(config.channels[index], config.bashMessages.introduceText + ":");
                                bot.say(config.channels[index], $(e).text().trim());
                            });
                        } else {
                            console.log("error while fetching data from ", config.channels[index]);  
                        }
                    });
                })(i);
            };
        }, interval);
    }
}
sendBashMessage();