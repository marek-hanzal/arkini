import { useAtomMount, useAtomSet } from "@effect/atom-react";
import type { Effect } from "effect";
import { useEffect, useLayoutEffect, useRef } from "react";

import { useGameEvents } from "~/bridge/event/useGameEvents";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import { createGameAudioSynthFx } from "~/ui/audio/createGameAudioSynthFx";
import { useGameAudioAtoms } from "~/ui/audio/useGameAudioAtoms";

export namespace GameAudio {
	export type CreateSynthFx = () => Effect.Effect<createGameAudioSynthFx.Result>;

	export interface Props {
		readonly createSynthFx?: CreateSynthFx;
	}
}

/** Owns one failure-isolated synthetic audio runtime for the current Game route. */
export const GameAudio = ({ createSynthFx = createGameAudioSynthFx }: GameAudio.Props) => {
	const game = useGameEngine();
	const audioAtoms = useGameAudioAtoms(game, createSynthFx);
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
