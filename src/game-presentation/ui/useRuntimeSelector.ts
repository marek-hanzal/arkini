import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Selects a stable projection from the latest committed runtime snapshot. */
export const useRuntimeSelector = <Selected>(
	game: PlayableGame,
	selectorFn: (runtime: RuntimeSchema.Type) => Selected,
	isEqualFn: (left: Selected, right: Selected) => boolean = Object.is,
): Selected => {
	const selectedAtom = useMemo(
		() =>
			Atom.readable((get) => {
				const selected = selectorFn(get(game.committedTransitionAtom).runtime);
				return Option.match(get.self<Selected>(), {
					onNone: () => selected,
					onSome: (previous) => (isEqualFn(previous, selected) ? previous : selected),
				});
			}),
		[
			game,
			isEqualFn,
			selectorFn,
		],
	);

	return useAtomValue(selectedAtom);
};
