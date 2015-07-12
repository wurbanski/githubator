var irc = require("irc");
var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');
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
        bot.say(message.args[0], message.nick + ": " + config.autorespond.message);
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

