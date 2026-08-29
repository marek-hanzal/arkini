import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { GameRuntimeAtom } from "~/ui/game/GameRuntimeAtom";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Selects a stable projection from the latest committed runtime snapshot. */
export const useRuntimeSelector = <Selected>(
	game: PlayableGame,
	selector: (runtime: RuntimeSchema.Type) => Selected,
	isEqual: (left: Selected, right: Selected) => boolean = Object.is,
): Selected => {
	const selectedAtom = useMemo(
		() =>
			Atom.readable((get) => {
				const selected = selector(get(GameRuntimeAtom(game.committedTransitionAtom)));
				return Option.match(get.self<Selected>(), {
					onNone: () => selected,
					onSome: (previous) => (isEqual(previous, selected) ? previous : selected),
				});
			}),
		[
			game,
			isEqual,
			selector,
		],
	);

	return useAtomValue(selectedAtom);
};
