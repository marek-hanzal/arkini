import { Equal, Hash } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { Game } from "~/bridge/game/Game";

class ExactGameIdentity implements Equal.Equal {
	readonly game: Game;

	constructor(game: Game) {
		this.game = game;
	}

	[Equal.symbol](that: Equal.Equal): boolean {
		return that instanceof ExactGameIdentity && that.game === this.game;
	}

	[Hash.symbol](): number {
		return Hash.random(this.game);
	}
}

/**
 * Memoizes one Atom object by exact live Game reference.
 * The explicit identity key prevents Effect Hash from traversing the Game facade.
 */
export const makeExactGameAtomFamily = <Result extends object>(make: (game: Game) => Result) => {
	const identities = new WeakMap<Game, ExactGameIdentity>();
	const family = Atom.family((identity: ExactGameIdentity) => make(identity.game));

	return (game: Game) => {
		const current = identities.get(game);
		if (current !== undefined) return family(current);
		const identity = new ExactGameIdentity(game);
		identities.set(game, identity);
		return family(identity);
	};
};
