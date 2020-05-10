const opt = require('node-getopt').create([
	["h", "help", "display help"],
	["", "ffa", "use FFA"],
	["", "1v1", "use 1v1"],
	["c", "custom=ARG", "use custom game"],
	["s", "server=ARG", "na, eu, or bot"],
	["i", "id=ARG", "user id"],
	["t", "token=ARG", "user token (na & eu only)"],
])
	.bindHelp()
	.parseSystem();
const user_id = opt.options.id;

const website = 
	(opt.options.server == "na" ? "https://generals.io/" :
	opt.options.server == "eu" ? "https://eu.generals.io/" : 
	"https://bot.generals.io");

const io = require('socket.io-client');
const socket = io(
	opt.options.server == "na" ? "http://ws.generals.io/" :
	opt.options.server == "eu" ? "http://euws.generals.io/" : 
	"http://botws.generals.io");

const state = require("./state.js");

socket.on('disconnect', function() {
	console.error('Disconnected from server.');
	process.exit(2);
});


socket.on('connect', function() {
	console.log('Connected to server.');

	if (opt.options.custom) {
		socket.emit('join_private', opt.options.custom, user_id, opt.options.token);
		console.log("Joined: " + website + "games/" + opt.options.custom);

		setTimeout(function() {
			socket.emit("make_custom_public", opt.options.custom);
			socket.emit("set_custom_options", opt.options.custom, {map: "Map", game_speed: 2});
		}, 1000);
	} else if (opt.options["1v1"]) {
		console.log("Joined: " + website + " 1v1");
		socket.emit('join_1v1', user_id, opt.options.token);
	} else {
		console.log("Joined: " + website + " ffa");
		socket.emit('play', user_id, opt.options.token);
	}

	var playerIndex;
	var cities = [];
	var map = [];

	var state_;

	socket.on("chat_message", function(room, data) {
		let args = data.text.trim().split(" ");
		switch (args[0].toLowerCase()) {
		case "help":
			socket.emit("chat_message", room, "I'll get back to you in 5 seconds.");
			const msgs = [
				"* force - Force start",
				"* speed [1-4] - Change game speed",
				"* map [MAP] - Change map",
				"* reset - Remove map",
				"* join [1-8] - Join a team"
			];
			for (let i = 0; i < msgs.length; i++) {
				setTimeout(function() {
					socket.emit("chat_message", room, msgs[i]);
				}, i * 500 + 5000);
			}
			break;
		case "go":
			socket.emit("chat_message", room, "Force me.");
			break;
		case "hi":
		case "hello":
			socket.emit("chat_message", room, "Hi! Imabot. Say 'help' for a list of commands.");
			break;
		case "die":
			socket.emit("chat_message", room, "No.");
			break;
		case "test":
			socket.emit("set_custom_options", opt.options.custom, {map: "small king of hill", game_speed: 4});
			socket.emit('set_force_start', opt.options.custom, true);
			break;
		case "force":
			socket.emit('set_force_start', opt.options.custom, true);
			break;
		case "speed":
			socket.emit("set_custom_options", opt.options.custom, {game_speed: args[1] | 0});
			break;
		case "map":
			socket.emit("set_custom_options", opt.options.custom, {map: args.slice(1).join(" ")});
			break;
		case "reset":
			socket.emit("set_custom_options", opt.options.custom, {map: null});
			break;
		case "join":
			let team =  args[1] | 0;
			if (team > 8 || team <= 0) {
				socket.emit("chat_message", room, "No.");
				break;
			}
			socket.emit("set_custom_team", opt.options.custom, team);
			break;

		// Shell utilities
		case "say":
			socket.emit("chat_message", room, args.slice(1).join(" "));
			break;
		case "who":
			if (args[1].toLowerCase() == "are" && args[2].toLowerCase() == "you") {
				socket.emit("chat_message", room, "imabot");
			}
			break;
		case "simplify":
			if (args.length == 2) {
				socket.emit("chat_message", room, args[1]);
			} else if (args.length == 4) {
				if (args[2] == "+" || args[2] == "-" || args[2] == "*" || args[2] == "/" || args[2] == "%") {
					socket.emit("chat_message", room, eval((args[1]|0) + args[2] + (args[3]|0)));
				}
			} else {
				socket.emit("chat_message", room, "expr: invalid syntax");
			}
			break;
		}
	});

	let swamps = [];

	socket.on('game_start', function(data) {
		swamps = data.swamps;
		state_ = new state.State(data.playerIndex);
		var replay_url = website + "replays/" + encodeURIComponent(data.replay_id);
		console.log('Game starting!');
		console.log('\tPlayers: ' + data.usernames.join(", "));
		console.log("\tReplay: " + replay_url);
	});

	socket.on('game_update', function(data) {	
		cities = patch(cities, data.cities_diff);
		map = patch(map, data.map_diff);

		var width = map[0];
		var height = map[1];
		var size = width * height;
		var armies = map.slice(2, size + 2);
		var terrain = map.slice(size + 2, size + 2 + size);

		var move = state_.update({
			turn: data.turn,
			width: width, height: height,
			armies: armies,
			terrain: terrain,
			cities: cities,
			generals: data.generals,
			swamps: swamps,
		});
		if (move)
			socket.emit("attack", move[0], move[1], move[2]);
	});

	socket.on('game_won', function(data) {
		console.log("Won!");
		process.exit(0);
	});

	socket.on('game_lost', function(data) {
		console.log("Lost!");
		process.exit(1);
	});
});

function patch(old, diff) {
	var out = [];
	var i = 0;
	while (i < diff.length) {
		if (diff[i]) {  // matching
			Array.prototype.push.apply(out, old.slice(out.length, out.length + diff[i]));
		}
		i++;
		if (i < diff.length && diff[i]) {  // mismatching
			Array.prototype.push.apply(out, diff.slice(i + 1, i + 1 + diff[i]));
			i += diff[i];
		}
		i++;
	}
	return out;
}
