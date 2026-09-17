import { useCallback, useEffect } from "react";

import { useGameAudioControl } from "~/game-audio/ui/useGameAudioControl";
import { useRuntimeSelector } from "~/game-presentation/ui/useRuntimeSelector";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemDetailState } from "~/item-detail-frame/type/ItemDetailControl";
import type { GameEngine } from "~/playable-game/type/GameEngine";

/** The visible detail owns one music request, independent of its scene and tab lifetimes. */
export const useItemDetailMusic = (game: GameEngine, state: ItemDetailState) => {
	const { requestDetailMusicFn } = useGameAudioControl();
	const target = state.phase === "entering" || state.phase === "open" ? state.target : undefined;
	const selectMusicFn = useCallback(
		(runtime: RuntimeSchema.Type) => {
			if (target === undefined) return undefined;
			return target.kind === "definition"
				? game.config.items[target.itemId]?.music
				: runtime.items.find((item) => item.id === target.itemId)?.item.music;
		},
		[
			game,
			target,
		],
	);
	const music = useRuntimeSelector(game, selectMusicFn);

	useEffect(() => {
		requestDetailMusicFn(music);
	}, [
		music,
		requestDetailMusicFn,
	]);

	// Target changes replace the request directly; only owner disposal releases it.
	useEffect(
		() => () => requestDetailMusicFn(undefined),
		[
			requestDetailMusicFn,
		],
	);
};
