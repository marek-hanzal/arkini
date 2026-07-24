import { Effect, Equal, Hash } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { Game } from "~/bridge/game/Game";

interface ExactGameIdentity extends Equal.Equal {
	readonly game: Game;
}

/**
 * Memoizes one Atom object by exact live Game reference.
 * The explicit identity key prevents Effect Hash from traversing the Game facade.
 */
export const makeExactGameAtomFamilyFx = Effect.fn("makeExactGameAtomFamilyFx")(
	<Result extends object>(make: (game: Game) => Result) =>
		Effect.sync(() => {
			const identities = new WeakMap<Game, ExactGameIdentity>();
			const family = Atom.family((identity: ExactGameIdentity) => make(identity.game));

			return (game: Game) => {
				const current = identities.get(game);
				if (current !== undefined) return family(current);
				const identity: ExactGameIdentity = {
					game,
					[Equal.symbol](that) {
						return that === this;
					},
					[Hash.symbol]() {
						return Hash.random(game);
					},
				};
				identities.set(game, identity);
				return family(identity);
			};
		}),
);
