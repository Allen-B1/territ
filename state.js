const FlatQueue = require("flatqueue");

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
		this.counter = 0;
	}

	update(data) {
		this.counter++;

		if (this.objectives == null) {
			this.objectives = [new Expand(), new Collect(data.generals[this.playerIndex])];
		}

		if (!this.start && data.armies[data.generals[this.playerIndex]] >= 5) {
			this.start = true;
		}

		if (!this.start) return;

		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == this.playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => ((data.cities.indexOf(tile) != -1 || (data.terrain[tile] == TILE_EMPTY && data.armies[tile] != 0)) && data.armies[data.generals[this.playerIndex]] > data.armies[tile] + 1 && data.armies[i] <= data.armies[tile] + 1 && data.terrain[tile] != this.playerIndex));
				if (adj != undefined) {
					let getCity = new Conquest(data.generals[this.playerIndex], adj);
					this.objectives.push(getCity);
					break;
				}
			}
		}

		let objs = Object.keys(this.objectives).slice(OBJ_VAR);
		if (this.counter % 500 >= 400) {
			objs = [OBJ_EXPAND, OBJ_COLLECT].concat(objs);
		} else {
			objs = [OBJ_EXPAND].concat(objs.concat([OBJ_COLLECT]));
		}

		objs = objs.filter(x => this.objectives[x] != null);

		console.log(objs);

		for (let obj of objs) {
			let ret = this.objectives[obj].exec(data, this.playerIndex);
			if (ret) {
				return ret;
			} else {
				if (obj >= OBJ_VAR) {
					this.objectives[obj] = null;
				}
			}
		}
		console.log("");
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
	constructor(source, target) {
		this.source = source;
		this.target = target;
		this.move = new Move(source, target);
	}

	toString() {
		return "Conquest(" + this.source + ", " + this.target + ")";
	}

	exec(data, playerIndex) {
		if (data.terrain[this.target] == playerIndex) {
			return; // conquest succeeded
		}
		return this.move.exec(data, playerIndex);
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
			let max = data.armies.reduce((acc, armies, tile) => armies > acc[1] && tile != this.target && armies > 1 && data.terrain[tile] == playerIndex ? [tile, armies] : acc, [-1, 0])[0];
			this.move = new Move(max, this.target);
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
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => (data.terrain[tile] != playerIndex && data.terrain[tile] != TILE_MOUNTAIN && (data.terrain[tile] != TILE_EMPTY || data.armies[tile] != 0) && data.armies[i] > data.armies[tile] + 1));
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}

		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => data.terrain[tile] == TILE_EMPTY && data.armies[tile] == 0);
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
