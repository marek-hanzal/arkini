import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Cause, Effect, Option } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
	type PropsWithChildren,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";

import type { SoundSettings } from "~electron/contract/sound/SoundSettings";
import { readExactCauseFailureFn } from "~/application-diagnostics/fn/readExactCauseFailureFn";
import { SoundSettingsAtom } from "~/application-settings/atom/SoundSettingsAtom";
import { createGameAudioRuntimeFx } from "~/game-audio/fx/createGameAudioRuntimeFx";
import { readGameAudioCuesFn } from "~/game-audio/fn/readGameAudioCuesFn";
import { GameAudioContext } from "~/game-audio/context/GameAudioContext";
import type { GameEventBatchSchema } from "~/game-event/schema/GameEventBatchSchema";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import { useGameEvents } from "~/game-presentation/ui/useGameEvents";
import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";

const useGameAudioAtoms = (game: GameEngine, initialSound: SoundSettings) =>
	useMemo(() => {
		const logGameAudioFailureFx = (message: string, cause: Cause.Cause<unknown>) =>
			Effect.sync(() => {
				const failure = readExactCauseFailureFn(cause);
				console.error(message, Option.isSome(failure) ? failure.value : cause);
			});
		const audioAtom = Atom.make(
			Effect.acquireRelease(
				Effect.suspend(() =>
					createGameAudioRuntimeFx({
						game,
						sound: initialSound,
					}),
				),
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
		const unlockAtom = Atom.fn(
			(_: void, get) =>
				Effect.yieldNow.pipe(
					Effect.andThen(get.result(audioAtom)),
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
					Effect.andThen(get.result(audioAtom)),
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
			(batch: GameEventBatchSchema.Type, get) =>
				Effect.yieldNow.pipe(
					Effect.andThen(get.result(audioAtom)),
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
		const playSfxEventAtom = Atom.fn(
			(event: PresentationSfxEventEnumSchema.Type, get) =>
				Effect.yieldNow.pipe(
					Effect.andThen(get.result(audioAtom)),
					Effect.flatMap((audio) =>
						audio.playFx([
							{
								event,
								strength: 1,
							},
						]),
					),
					Effect.catchCause((cause) =>
						Cause.hasInterruptsOnly(cause)
							? Effect.void
							: logGameAudioFailureFx(
									"Arkini game audio cue failed; gameplay continues.",
									cause,
								),
					),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));
		const setSoundAtom = Atom.fn(
			(sound: SoundSettings, get) =>
				get.result(audioAtom).pipe(
					Effect.flatMap((audio) => audio.setSoundFx(sound)),
					Effect.catch(() => Effect.void),
				),
			{
				concurrent: true,
			},
		).pipe(Atom.setIdleTTL(0));

		return {
			audioAtom,
			playBatchAtom,
			playSfxEventAtom,
			prepareAtom,
			setSoundAtom,
			unlockAtom,
		};
	}, [
		game,
	]);

/** Owns one failure-isolated packaged-audio runtime for the current Game route. */
export const GameAudio = ({ children }: PropsWithChildren) => {
	const game = useGameEngine();
	const sound = useAtomValue(SoundSettingsAtom);
	const audioAtoms = useGameAudioAtoms(game, sound);
	const activeAudioAtomsRef = useRef<typeof audioAtoms | null>(null);
	useAtomMount(audioAtoms.audioAtom);
	const prepareFn = useAtomSet(audioAtoms.prepareAtom);
	const unlockFn = useAtomSet(audioAtoms.unlockAtom);
	const playBatchFn = useAtomSet(audioAtoms.playBatchAtom);
	const playSfxEventAtomFn = useAtomSet(audioAtoms.playSfxEventAtom);
	const setSoundFn = useAtomSet(audioAtoms.setSoundAtom);

	useLayoutEffect(() => {
		activeAudioAtomsRef.current = audioAtoms;
		return () => {
			if (activeAudioAtomsRef.current === audioAtoms) activeAudioAtomsRef.current = null;
		};
	}, [
		audioAtoms,
	]);

	useEffect(() => {
		prepareFn();
		unlockFn();
	}, [
		prepareFn,
		unlockFn,
	]);

	useEffect(() => {
		setSoundFn(sound);
	}, [
		setSoundFn,
		sound,
	]);

	useEffect(() => {
		const onUnlockFn = () => {
			if (activeAudioAtomsRef.current === audioAtoms) unlockFn();
		};
		window.addEventListener("pointerdown", onUnlockFn, true);
		window.addEventListener("keydown", onUnlockFn, true);
		return () => {
			window.removeEventListener("pointerdown", onUnlockFn, true);
			window.removeEventListener("keydown", onUnlockFn, true);
		};
	}, [
		audioAtoms,
		unlockFn,
	]);

	useGameEvents((batch) => {
		if (activeAudioAtomsRef.current === audioAtoms) playBatchFn(batch);
	});

	const playSfxEventFn = useCallback(
		(event: PresentationSfxEventEnumSchema.Type) => {
			if (activeAudioAtomsRef.current === audioAtoms) playSfxEventAtomFn(event);
		},
		[
			audioAtoms,
			playSfxEventAtomFn,
		],
	);
	const control = useMemo(
		() => ({
			playSfxEventFn,
		}),
		[
			playSfxEventFn,
		],
	);

	return <GameAudioContext.Provider value={control}>{children}</GameAudioContext.Provider>;
};
