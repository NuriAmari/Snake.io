var express = require("express");
var app = express();
var serv = require("http").Server(app);
var path = require('path');
var bodyParser = require('body-parser');
var io = require("socket.io")(serv, {});

// PLAYER LISTS
var SOCKET_LIST = {};
var PLAYER_LIST = {};

// ITEM LISTS
var SNACK_LIST = [];

// GAME TIME VARIABLES
var timePassed = 0;
var lastSnackTime = 0;

var colours = ["turq", "midnight", ""];

const gameWidth = 3600;
const gameHeight = 3600;
const playerSize = 20;
const numColumns = gameWidth / playerSize;
const numRows = gameHeight / playerSize;
var startColumn = function() { return Math.round(Math.random() * numColumns / 1.2);};
var startRow = function() { return Math.round(Math.random() * numRows / 1.2);};


app.use(express.static(__dirname + '/public'));


app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.post("/startGame", function(req, res) {

  var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  //console.log("CLICK IP: " + ip);

  var player = Player(ip, startColumn(), startRow());
  player.colour = colours[Math.round(Math.random() * 3)];
  player.name = req.body.name;
  PLAYER_LIST[ip] = player;
	res.redirect("/newGame");

});

app.use(function (req, res) {

	if (req.url === "/") {

			//response.writeHead(200, { "Content-Type": "text/html" });
			res.sendFile(__dirname + "/homepage.html");
			//res.end();
	}

	else if (req.url === "/newGame") {

		res.sendFile(__dirname + "/index.html");
		//res.end();
	}
});

serv.listen(8000);

//console.log("Server has started");


io.on("connection", function(socket) {

	socket.id = socket.request.connection.remoteAddress;
	SOCKET_LIST[socket.id] = socket;
  var player = PLAYER_LIST[socket.id];

  console.log('New connection from ' + socket.request.connection.remoteAddress);

	//console.log("socket connection");

	socket.on("disconnect", function() {

		delete SOCKET_LIST[socket.id];
		delete PLAYER_LIST[socket.id];
	});

	socket.on("test", function(data) {

		console.log("test success");
	});

	socket.emit("ID", {id:socket.id});

	socket.on("keyPress", function(data) {

		if(data.inputId === "left" && player.dir !== "RIGHT") {

			player.dir = "LEFT";
		}

		else if(data.inputId === "right" && player.dir !== "LEFT") {

			player.dir = "RIGHT";
		}

		else if(data.inputId === "down" && player.dir !== "UP") {

			player.dir = "DOWN";
		}

		else if(data.inputId === "up" && player.dir !== "DOWN") {

			player.dir = "UP";
		}

	});

});


setInterval(function() {

	var pack = [];

	timePassed += 100;

	if (timePassed - lastSnackTime > Math.round(Math.random() * 1000) + 100 && SNACK_LIST.length < 50) {

		SNACK_LIST.push({x:Math.round(Math.random() * numColumns), y:Math.round(Math.random() * numRows)});
		lastSnackTime = timePassed;
	}


  for (var i in PLAYER_LIST) {

    var player = PLAYER_LIST[i];
    player.updatePosition();

    for (var j = 0; j < PLAYER_LIST[i].positions.length; j++) {

        var bodyPiece = PLAYER_LIST[i].positions[j];

        if (j === 0) {

            PLAYER_LIST[i].positions[j].type = "head" + (player.dir).toLowerCase();
        }

        else if (j === PLAYER_LIST[i].positions.length - 1) {

            PLAYER_LIST[i].positions[j].type = "tail" + getType(PLAYER_LIST[i].positions,j, "tail");
        }

        else {

            PLAYER_LIST[i].positions[j].type = "body" + getType(PLAYER_LIST[i].positions, j, "body");
        }
    }
  }

	for (var i in PLAYER_LIST) {

		var player = PLAYER_LIST[i];

		for (var j in PLAYER_LIST) {

			for (var h = 0; h < PLAYER_LIST[j].positions.length; h++) {

				if (player.x === PLAYER_LIST[j].positions[h].x && player.y === PLAYER_LIST[j].positions[h].y) {

						if(player.id === PLAYER_LIST[j].id && h !== 0 && player.positions.length > 4) {

							suicide(player.id, i);
						}

						else if (player.id !== PLAYER_LIST[j].id){

							eatEnemy(PLAYER_LIST[j].id, j, player.id, i);
						}
				}
			}
		}

		if (player.x < 0 || player.x > numColumns || player.y < 0 || player.y > numRows) {

			player.reset();
		}


		pack.push({
			id:player.id,
			positions:player.positions,
			score:player.score,
			snacks:SNACK_LIST,
      name:player.name
		});

		for (var j = 0; j < SNACK_LIST.length; j++) {

			var snack = SNACK_LIST[j];

			if (player.x === snack.x && player.y === snack.y) {

				SNACK_LIST.splice(j, 1);
				player.eatSnack();
			}
		}
	}

	for (var i in SOCKET_LIST) {

		var socket = SOCKET_LIST[i];
		socket.emit("newPosition", pack);
	}

}, 100);

var Player = function(id, x, y) {

	var self = {

		x:x,
		y:y,
		id:id,
		dir:"UP",
		positions:[{x:x, y:y, type:"headup"}, {x:x, y:y+1, type:"taildown"}],
		len:2,
		score:0,
    name: "no_name",
    colour: ""
	}

	self.updatePosition = function() {

		for (var i = self.positions.length; i > 1; i--) {

			var x1 = self.positions[i-2].x;
			var y1 = self.positions[i-2].y;

			self.positions[i-1].x = x1;
			self.positions[i-1].y = y1;
		}

		if(self.dir === "DOWN") {

	      self.y += 1;
	    }

	    if(self.dir === "UP") {

	      self.y -= 1;
	    }

	    if(self.dir === "LEFT") {

	      self.x -= 1;
	    }

	    if(self.dir === "RIGHT") {

	      self.x += 1;
	    }

	  self.positions[0].x = self.x;
		self.positions[0].y = self.y;


	}

	self.reset = function() {

		self.x = startColumn();
		self.y = startRow();
		self.positions = [{x:self.x, y:self.y}, {x:self.x, y:self.y + 1}];
		self.len = 1;
		self.dir = "UP";
		self.score = 0;
	}

	self.eatSnack = function() {

		self.len += 1;
		self.positions.push(getTailCoordinate(self.positions));
		self.score++;
	}

	return self;
}

var suicide = function(id, index) {

	PLAYER_LIST[index].reset();
}

var eatEnemy = function(playerId, playerIndex, victimId, victimIndex) {

	//console.log("fatality");
	//console.log("Player ID: " + playerId + " Victim ID: " + victimId);

	for (var i = 0; i < PLAYER_LIST[victimIndex].score; i++) {

			PLAYER_LIST[playerIndex].eatSnack();
	}

	PLAYER_LIST[victimIndex].reset();
}

var getType = function(positions, index, bodyType) {


  if (bodyType === "body") {

    var xb = positions[index - 1].x;
    var yb = positions[index - 1].y;
    var xc = positions[index].x;
    var yc = positions[index].y;
    var xa = positions[index + 1].x;
    var ya = positions[index + 1].y;

    if (xb === xa || yb === ya) {

      return "";
    }

    else if (xb < xa && yb > ya && xc === xb) {

      return "north-west";
    }

    else if (xb < xa && yb < ya && xc === xa) {

      return "north-east";
    }

    else if (xb > xa && yb < ya && xc === xb) {

      return "south-east";
    }

    else if (xb > xa && yb > ya && xc === xa) {

      return "south-west";
    }

    else if (xb > xa && yb < ya && xc === xa) {

      return "north-west";
    }

    else if (xb > xa && yb > ya && xc === xb) {

      return "north-east";
    }

    else if (xb < xa && yb > ya && xc === xa) {

      return "south-east";
    }

    else if (xb < xa && yb < ya && xc === xb) {

      return "south-west";
    }

    else {

      //console.log("SOMETHING IS WRONG");
      //console.log("XB: " + xb + " XA: " + xa + " YB: " + yb + " YA: " + ya + " XC: " + xc);
    }
  }

  else if (bodyType === "tail") {

    var xl = positions[positions.length - 1].x;
  	var yl = positions[positions.length - 1].y;
  	var xsl = positions[positions.length - 2].x;
  	var ysl = positions[positions.length - 2].y;

    // going up or down
  	if (xl === xsl) {

      // going up
  		if (yl > ysl) {

  			return "up";
  		}

      // going down
  		else {

  			return "down";
  		}
  	}

    // going left or right
  	else if (yl === ysl) {

      // going left
  		if (xl > xsl) {

  			return "left";
  		}

  		else {

  			return "right";
  		}
  	}
  }
}

var getTailCoordinate = function(positions) {

	var xl = positions[positions.length - 1].x;
	var yl = positions[positions.length - 1].y;
	var xsl = positions[positions.length - 2].x;
	var ysl = positions[positions.length - 2].y;

  // going up or down
	if (xl === xsl) {

    // going up
		if (yl > ysl) {

			return {x:xl, y:yl - 1, type: "tailup"};
		}

    // going down
		else {

			return {x:xl, y:yl + 1, type: "taildown"
      };
		}
	}

  // going left or right
	else if (yl === ysl) {

    // going left
		if (xl > xsl) {


			return {x:xl + 1, y:yl, type: "tailleft"};
		}

		else {

			return {x:xl - 1, y:yl, type: "tailright"};
		}
	}

	else {

		console.log("yeeeaaaa, something went wrong");
	}
}
