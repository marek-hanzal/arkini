import { Effect, Equal, Hash } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import type { PlayableGame } from "~/renderer/game/PlayableGame";

interface ExactGameIdentity<GameType extends PlayableGame> extends Equal.Equal {
	readonly game: GameType;
}

/**
 * Memoizes one Atom object by exact live Game reference.
 * The explicit identity key prevents Effect Hash from traversing the live Game object.
 */
export const makeExactGameAtomFamilyFx = Effect.fn("makeExactGameAtomFamilyFx")(
	<GameType extends PlayableGame, Result extends object>(make: (game: GameType) => Result) =>
		Effect.sync(() => {
			const identities = new WeakMap<GameType, ExactGameIdentity<GameType>>();
			const family = Atom.family((identity: ExactGameIdentity<GameType>) =>
				make(identity.game),
			);

			return (game: GameType) => {
				const current = identities.get(game);
				if (current !== undefined) return family(current);
				const identity: ExactGameIdentity<GameType> = {
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
