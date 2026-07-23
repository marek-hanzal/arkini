import { Effect } from "effect";
import { useEffect, useRef } from "react";

import { useGameEvents } from "~/bridge/event/useGameEvents";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { createGameAudioSynthFx } from "~/ui/audio/createGameAudioSynthFx";
import { readGameAudioCuesFx } from "~/ui/audio/readGameAudioCuesFx";

export namespace GameAudio {
	export type CreateSynthFx = () => Effect.Effect<createGameAudioSynthFx.Result>;

	export interface Props {
		readonly createSynthFx?: CreateSynthFx;
	}
}

/** Owns one failure-isolated synthetic audio runtime for the current Game route. */
export const GameAudio = ({ createSynthFx = createGameAudioSynthFx }: GameAudio.Props) => {
	const game = useGameEngine();
	const audioRef = useRef<createGameAudioSynthFx.Result | null>(null);

	useEffect(() => {
		const audio = RendererRuntime.runSync(createSynthFx());
		audioRef.current = audio;
		const unlock = () => {
			void RendererRuntime.runPromise(audio.unlockFx).catch((cause: unknown) => {
				console.error("Arkini game audio unlock failed; gameplay continues.", cause);
			});
		};
		window.addEventListener("pointerdown", unlock, true);
		window.addEventListener("keydown", unlock, true);

		return () => {
			window.removeEventListener("pointerdown", unlock, true);
			window.removeEventListener("keydown", unlock, true);
			if (audioRef.current === audio) audioRef.current = null;
			void RendererRuntime.runPromise(audio.closeFx).catch((cause: unknown) => {
				console.error("Arkini game audio disposal failed; gameplay continues.", cause);
			});
		};
	}, [
		createSynthFx,
		game,
	]);

	useGameEvents((batch) => {
		const audio = audioRef.current;
		if (audio === null) return;
		void RendererRuntime.runPromise(
			readGameAudioCuesFx(batch).pipe(Effect.flatMap(audio.playFx)),
		).catch((cause: unknown) => {
			console.error("Arkini game audio batch failed; gameplay continues.", cause);
		});
	});

	return null;
};
