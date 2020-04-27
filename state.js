const FlatQueue = require("flatqueue");

const TILE_EMPTY = -1;
const TILE_MOUNTAIN  = -2;

class State {
	constructor(playerIndex) {
		this.playerIndex = playerIndex;
		this.objectives = new FlatQueue();
		this.start = false;
	}

	update(data) {
		if (!this.start && data.armies[data.generals[this.playerIndex]] >= 15) {
			this.start = true;
		}

		if (!this.start) return;

		// Conquer cities or other players
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == this.playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => (data.terrain[tile] != this.playerIndex && data.terrain[tile] != TILE_MOUNTAIN && data.armies[i] > data.armies[tile]));
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}

		// Expand
		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == this.playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => data.terrain[tile] == TILE_EMPTY && data.armies[tile] == 0);
				if (adj !== undefined) {
					return [i, adj];
				}
			}
		}

		for (var i = 0; i < data.width * data.height; i++) {
			if (data.terrain[i] == this.playerIndex && data.armies[i] > 1) {
				let adjacents = adjacentTiles(i, data.width, data.height);
				let adj = adjacents.find(tile => (data.cities.indexOf(tile) != -1 && data.armies[data.generals[this.playerIndex]] > data.armies[tile] && data.terrain[tile] != this.playerIndex));
				if (adj != undefined) {
					let getCity = new Conquest(data.generals[this.playerIndex], adj);
					console.log(getCity.toString());
					this.objectives.push(getCity, 1);
					break;
				}
			}
		}

		if (this.objectives.peek() === undefined) {
			let max = data.armies.reduce((acc, armies, tile) => armies > acc[1] && tile != data.generals[this.playerIndex] && armies > 1 && data.terrain[tile] == this.playerIndex ? [tile, armies] : acc, [-1, 0])[0];
			if (max >= 0) {
				let gather = new Move(max, data.generals[this.playerIndex]);
				console.log(gather.toString());
				this.objectives.push(gather, 2);
			}
		}

		if (this.objectives.peek() !== undefined) {
			let objective = this.objectives.peek();
			let result = objective.exec(data, this.playerIndex);
			if (!result) {
				this.objectives.pop();
			}
			return result;
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
