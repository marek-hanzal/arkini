import { useAtomMount, useAtomSet } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import { readGameAudioCuesFn } from "~/game-audio/fn/readGameAudioCuesFn";
import { createGameAudioSynthFx } from "~/game-audio/fx/createGameAudioSynthFx";
import { useGameEvents } from "~/game-presentation/ui/useGameEvents";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";

const useGameAudioAtoms = (game: ReturnType<typeof useGameEngine>) =>
	useMemo(() => {
		const logGameAudioFailureFx = (message: string, cause: Cause.Cause<unknown>) =>
			Effect.sync(() => {
				const failure = readExactCauseFailureFn(cause);
				console.error(message, Option.isSome(failure) ? failure.value : cause);
			});
		const synthAtom = Atom.make(
			Effect.acquireRelease(
				Effect.suspend(createGameAudioSynthFx),
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
					Effect.flatMap((audio) => audio.playFx(readGameAudioCuesFn(batch))),
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
		game,
	]);

/** Owns one failure-isolated synthetic audio runtime for the current Game route. */
export const GameAudio = () => {
	const game = useGameEngine();
	const audioAtoms = useGameAudioAtoms(game);
	const activeAudioAtomsRef = useRef<typeof audioAtoms | null>(null);
	useAtomMount(audioAtoms.synthAtom);
	const prepare = useAtomSet(audioAtoms.prepareAtom);
	const unlock = useAtomSet(audioAtoms.unlockAtom);
	const playBatch = useAtomSet(audioAtoms.playBatchAtom);

	useLayoutEffect(() => {
		activeAudioAtomsRef.current = audioAtoms;
		return () => {
			if (activeAudioAtomsRef.current === audioAtoms) {
				activeAudioAtomsRef.current = null;
			}
		};
	}, [
		audioAtoms,
	]);

	useEffect(() => {
		prepare();
	}, [
		prepare,
	]);

	useEffect(() => {
		const onUnlock = () => {
			if (activeAudioAtomsRef.current !== audioAtoms) return;
			unlock();
		};
		window.addEventListener("pointerdown", onUnlock, true);
		window.addEventListener("keydown", onUnlock, true);

		return () => {
			window.removeEventListener("pointerdown", onUnlock, true);
			window.removeEventListener("keydown", onUnlock, true);
		};
	}, [
		audioAtoms,
		unlock,
	]);

	useGameEvents((batch) => {
		if (activeAudioAtomsRef.current !== audioAtoms) return;
		playBatch(batch);
	});

	return null;
};
