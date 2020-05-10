const OBJ_EXPAND = 0;
const OBJ_COLLECT = 1;
const OBJ_VAR = 2;

const TILE_EMPTY = -1;
const TILE_MOUNTAIN  = -2;

class State {
	constructor(playerIndex) {
		this.playerIndex = playerIndex;
		this.objectives = null;
		this.start = false;
		this.exploration = null;
	}

	update(data) {	
		if (this.objectives == null) {
			this.objectives = [new Expand(), new Collect(data.generals[this.playerIndex])];
		}

		if (!this.start && data.armies[data.generals[this.playerIndex]] >= 5) {
			this.start = true;
		}

		if (!this.start) return;

		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == this.playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.hewight);
				let adj = adjacents.find(tile => (
					(data.cities.indexOf(tile) != -1 ||
						(data.terrain[tile] == TILE_EMPTY && data.armies[tile] != 0)) &&
					data.armies[data.generals[this.playerIndex]] > data.armies[tile] + 1 &&
					data.armies[i] <= data.armies[tile] + 1 && data.terrain[tile] != this.playerIndex));
				if (adj != undefined) {
					let getCity = new Conquest(data.generals[this.playerIndex], adj);
					console.log("City: " + getCity);
					this.objectives.push(getCity);
					break;
				}
			}
		}

		// Explore Swamps & Empty Tiles
		if (!this.exploration)
			for (var i = 0; i < data.width * data.height; i++) {
				if (data.terrain[i] == this.playerIndex) {
					let adjacents = adjacentTiles(i, data.width, data.hewight);
					let adj = adjacents.find(tile => (
						data.terrain[tile] == TILE_EMPTY && data.armies[tile] == 0 &&
						data.armies[data.generals[this.playerIndex]] >= 50
					));
					if (adj != undefined) {
						let getEmpty = new Conquest(data.generals[this.playerIndex], adj, 50);
						console.log("Swamp / Empty: " + getEmpty);
						this.exploration = getEmpty;
						this.objectives.push(getEmpty);
					}
				}
			}


		if (this.objectives.length > 64)
			this.objectives.length = 64;

		let objs = Object.keys(this.objectives).slice(OBJ_VAR);
		if (this.turn % 250 >= 200) {
			objs = [OBJ_EXPAND, OBJ_COLLECT].concat(objs);
		} else {
			objs = [OBJ_EXPAND].concat(objs.concat([OBJ_COLLECT]));
		}

		objs = objs.filter(x => this.objectives[x] != null);

		console.log("Objectives = " + objs.join(",") + " ; Exploration = " + this.objectives.indexOf(this.exploration == null ? NaN : this.exploration));

		for (let obj of objs) {
			let ret = this.objectives[obj].exec(data, this.playerIndex);
			if (ret) {
				return ret;
			} else {
				if (this.exploration === this.objectives[obj]) {
					this.exploration = null;
				}
				if (obj >= OBJ_VAR) {
					this.objectives[obj] = null;
				}
			}
		}
	}
}

class Move {
	constructor(from, to) {
		this.target = to;
		this.source = from;
		this.path = null;
	}

	toString() {
		return "Move(" + this.source + ", " + this.target + ")";
	}

	exec(data, playerIndex) {
		if (this.path == null) {
			let arr = Array(data.width * data.height).fill(Infinity);

			arr[this.target] = 0;
			for(let i = 0; i < 256; i++) {
				for (let tile = 0; tile < arr.length; tile++) {
					if (arr[tile] != Infinity) {
						let value = arr[tile] + 1;
						for (let adjacent of adjacentTiles(tile, data.width, data.height)) {
							if (data.terrain[adjacent] == playerIndex && arr[adjacent] > value) {
								arr[adjacent] = value;
							}
						}
					}
				}

				if (arr[this.source] != Infinity) {
					break;
				}
			}

			this.path = [];
			for (let tile = this.source; tile != this.target;) {
				this.path.push(tile);
				let list = adjacentTiles(tile, data.width, data.height);
				tile = list.reduce((acc, tile) => (arr[tile] < acc[1] ? [tile, arr[tile]] : acc), [-1, Infinity])[0];
				if (tile == -1) {
					// Impossible path
					return;
				}
			}
			this.path.push(this.target);

			console.log("Path = " + this.path.join(","));
		}

		if (this.path.length <= 1) {
			return;
		}

		let move = [this.path[0], this.path[1]];
		this.path.shift();
		return move;
	}
}

class Conquest {
	constructor(source, target, min) {
		this.min = min | 0;
		this.source = source;
		this.target = target;
		this.move = new Move(source, target);
		this.first = true;
	}

	toString() {
		return "Conquest(" + this.source + ", " + this.target + ")";
	}

	exec(data, playerIndex) {
		if (data.terrain[this.target] == playerIndex) {
			return; // conquest succeeded
		}
		let move = this.move.exec(data, playerIndex);
		if (this.first) {
			if (data.armies[this.target] >= data.armies[this.source] ||
				data.armies[this.source] < this.min)
				return undefined;
			if (data.armies[this.source] > data.armies[this.source] / 2 && move != undefined)
				move = move.concat(true);
			this.first = false;
		}
		return move;
	}
}

class Collect {
	constructor(target) {
		this.move = null;
		this.target = target;
	}

	toString() {
		return "Collect(" + this.target + ")";
	}

	exec(data, playerIndex) {
		if (this.move == null) {
			let tries = [];
			while(tries.length < 32) {
				let max = data.armies.reduce((acc, armies, tile) => armies > acc[1] &&
					 tile != this.target &&
					 tries.indexOf(tile) == -1 &&
					 data.terrain[tile] == playerIndex ? [tile, armies] : acc, [-1, 0])[0];
				this.move = new Move(max, this.target);
	
				let ret = this.move.exec(data, playerIndex);
				if (ret) {
					return ret;
				}
				tries.push(max);
			}
		}

		let ret = this.move.exec(data, playerIndex);
		if (!ret) {
			this.move = null;
		}
		return ret;
	}
}

class Expand {
	constructor() {}

	toString() {
		return "Expand";
	}

	exec(data, playerIndex) {
		// Generals
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => (data.terrain[tile] != playerIndex && 
					data.generals.indexOf(tile) !== -1 && data.armies[i] > data.armies[tile] + 1));
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}
		
		// Cities & Enemy
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => (data.terrain[tile] != playerIndex &&
						data.terrain[tile] != TILE_MOUNTAIN && 
						(data.terrain[tile] != TILE_EMPTY || data.armies[tile] != 0) &&
						 data.armies[i] > data.armies[tile] + 1));
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}

		// Empty
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => data.terrain[tile] == TILE_EMPTY && data.armies[tile] == 0
					&& data.swamps.indexOf(tile) === -1);
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}

		// Swamp | 35+ => Swamp
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == playerIndex && data.armies[i] > 1 && 
				(data.swamps.indexOf(i) !== -1 || data.armies[i] >= 35)) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				adjacents = shuffle(adjacents);
				let adj = adjacents.find(tile =>
					data.terrain[tile] == TILE_EMPTY && data.armies[tile] == 0
					&& data.swamps.indexOf(tile) !== -1);
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}

		return undefined;
	}
}

module.exports.State = State;

function adjacentTiles(tile, width, height) {
	const row = (tile/width) | 0;
	const col = tile % width;

	var out = [];
	if (col < width - 1) {
		out.push(tile + 1);
	}
	if (col > 0) {
		out.push(tile - 1);
	}
	if (row > 0) {
		out.push(tile - width);
	}
	if (row < height - 1) {
		out.push(tile + width);
	}
	return out;
}

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}