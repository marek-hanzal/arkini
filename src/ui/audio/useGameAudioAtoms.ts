import { Cause, Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { readExactCauseFailureFn } from "~/renderer/diagnostics/fn/readExactCauseFailureFn";
import type { useGameEvents } from "~/ui/game/useGameEvents";
import type { createGameAudioSynthFx } from "~/ui/audio/createGameAudioSynthFx";
import { readGameAudioCuesFx } from "~/ui/audio/readGameAudioCuesFx";

export namespace useGameAudioAtoms {
	export type CreateSynthFx = () => Effect.Effect<createGameAudioSynthFx.Result>;
}

/** Owns one exact Game/createSynth audio resource and its interruptible commands. */
export const useGameAudioAtoms = (
	game: PlayableGame,
	createSynthFx: useGameAudioAtoms.CreateSynthFx,
) =>
	useMemo(() => {
		const logGameAudioFailureFx = (message: string, cause: Cause.Cause<unknown>) =>
			Effect.sync(() => {
				const failure = readExactCauseFailureFn(cause);
				console.error(message, Option.isSome(failure) ? failure.value : cause);
			});
		const synthAtom = Atom.make(
			Effect.acquireRelease(
				Effect.suspend(createSynthFx),
				(audio) =>
					audio.closeFx.pipe(
						Effect.catchCause((cause) =>
							Cause.hasInterruptsOnly(cause)
								? Effect.void
								: logGameAudioFailureFx(
										"Arkini game audio disposal failed; gameplay continues.",
										cause,
									),
						),
					),
				{
					interruptible: true,
				},
			),
		).pipe(Atom.setIdleTTL(0));
		// TODO(#397): Revalidate stable command scheduling and resource interruption
		// before removing the yields from either audio command.
		const unlockAtom = Atom.fn(
			(_: void, get) =>
				Effect.yieldNow.pipe(
					Effect.andThen(get.result(synthAtom)),
					Effect.flatMap((audio) => audio.unlockFx),
					Effect.catchCause((cause) =>
						Cause.hasInterruptsOnly(cause)
							? Effect.void
							: logGameAudioFailureFx(
									"Arkini game audio unlock failed; gameplay continues.",
									cause,
								),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));
		const prepareAtom = Atom.fn(
			(_: void, get) =>
				Effect.yieldNow.pipe(
					Effect.andThen(get.result(synthAtom)),
					Effect.flatMap((audio) => audio.prepareFx),
					Effect.catchCause((cause) =>
						Cause.hasInterruptsOnly(cause)
							? Effect.void
							: logGameAudioFailureFx(
									"Arkini game audio preparation failed; gameplay continues.",
									cause,
								),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));
		const playBatchAtom = Atom.fn(
			(batch: useGameEvents.Batch, get) =>
				Effect.yieldNow.pipe(
					Effect.andThen(get.result(synthAtom)),
					Effect.flatMap((audio) =>
						readGameAudioCuesFx(batch).pipe(Effect.flatMap(audio.playFx)),
					),
					Effect.catchCause((cause) =>
						Cause.hasInterruptsOnly(cause)
							? Effect.void
							: logGameAudioFailureFx(
									"Arkini game audio batch failed; gameplay continues.",
									cause,
								),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));

		return {
			playBatchAtom,
			prepareAtom,
			synthAtom,
			unlockAtom,
		};
	}, [
		createSynthFx,
		game,
	]);
