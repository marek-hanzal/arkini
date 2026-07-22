import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useGameEvents } from "~/bridge/event/useGameEvents";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";

interface TileMotionCueState {
	readonly nextGeneration: number;
	readonly cues: ReadonlyMap<string, TileMotionCueSchema.Type>;
	readonly retained: ReadonlyMap<string, useTileActors.Item>;
}

interface TileMotionCueFallback {
	readonly generation: number;
	readonly timer: ReturnType<typeof setTimeout>;
}

const cueFallbackMs = 1_200;

const emptyState = (): TileMotionCueState => ({
	nextGeneration: 0,
	cues: new Map(),
	retained: new Map(),
});

/** Translates committed item facts into bounded actor-local cue generations. */
export const useTileMotionCues = ({
	liveItems,
	onSceneReset,
}: {
	readonly liveItems: ReadonlyArray<useTileActors.Item>;
	readonly onSceneReset: () => void;
}) => {
	const game = useGameEngine();
	const liveItemsRef = useRef(liveItems);
	const previousLiveItemsRef = useRef(liveItems);
	const fallbacks = useRef(new Map<string, TileMotionCueFallback>());
	const gameRef = useRef(game);
	const [state, setState] = useState<TileMotionCueState>(emptyState);

	useLayoutEffect(() => {
		previousLiveItemsRef.current = liveItemsRef.current;
		liveItemsRef.current = liveItems;
	}, [
		liveItems,
	]);

	const complete = useCallback((itemId: string, generation: number) => {
		setState((current) => {
			if (current.cues.get(itemId)?.generation !== generation) return current;
			const cues = new Map(current.cues);
			const retained = new Map(current.retained);
			cues.delete(itemId);
			retained.delete(itemId);
			return { nextGeneration: current.nextGeneration, cues, retained };
		});
	}, []);

	useGameEvents((batch) => {
		if (batch.events.some((event) => event.type === "current-space:changed")) {
			onSceneReset();
		}
		setState((current) => {
			const cues = new Map(current.cues);
			const retained = new Map(current.retained);
			const liveById = new Map([
				...previousLiveItemsRef.current.map((item) => [item.id, item] as const),
				...liveItemsRef.current.map((item) => [item.id, item] as const),
			]);
			let changed = false;
			let nextGeneration = current.nextGeneration;

			const cue = (
				itemId: string,
				kind: TileMotionCueSchema.Type["kind"],
				retain: boolean,
			) => {
				const existing = cues.get(itemId);
				if (existing?.kind === "exit" && kind !== "exit") return;
				if (existing?.kind === "spawn" && kind === "spawn") return;
				if (retain) {
					const snapshot = liveById.get(itemId) ?? retained.get(itemId);
					if (snapshot !== undefined) retained.set(itemId, snapshot);
				}
				const strength =
					existing?.kind === kind && (kind === "impact" || kind === "accept")
						? Math.min(3, existing.strength + 1)
						: 1;
				cues.set(itemId, {
					generation: ++nextGeneration,
					kind,
					strength,
				});
				changed = true;
			};

			for (const event of batch.events) {
				switch (event.type) {
					case "current-space:changed":
						for (const itemId of cues.keys()) {
							const item = liveById.get(itemId) ?? retained.get(itemId);
							if (item?.location.scope !== "board") continue;
							cues.delete(itemId);
							retained.delete(itemId);
							changed = true;
						}
						for (const item of liveItemsRef.current) {
							if (
								item.location.scope === "board" &&
								item.location.space === event.currentSpace
							) {
								cue(item.id, "settle", false);
							}
						}
						break;
					case "item:spawned":
						cue(event.itemId, "spawn", false);
						break;
					case "item:stacked":
					case "item:split":
						cue(event.itemId, "impact", false);
						break;
					case "item:depleted":
						if (event.quantity > 0) cue(event.itemId, "impact", false);
						break;
					case "item:removed":
						cue(event.itemId, "exit", true);
						break;
					case "item:replaced":
						cue(event.outgoingItemId, "exit", true);
						cue(event.incomingItemId, "spawn", false);
						break;
					case "job:started":
						cue(event.ownerItemId, "accept", false);
						break;
					case "item:consumed":
					case "item:expired":
					case "item:merged":
					case "job:completed":
						break;
				}
			}

			return changed ? { nextGeneration, cues, retained } : current;
		});
	});

	useEffect(() => {
		for (const [itemId, fallback] of fallbacks.current) {
			const cue = state.cues.get(itemId);
			if (cue?.generation === fallback.generation) continue;
			clearTimeout(fallback.timer);
			fallbacks.current.delete(itemId);
		}
		for (const [itemId, cue] of state.cues) {
			if (fallbacks.current.get(itemId)?.generation === cue.generation) continue;
			fallbacks.current.set(itemId, {
				generation: cue.generation,
				timer: setTimeout(() => complete(itemId, cue.generation), cueFallbackMs),
			});
		}
	}, [
		complete,
		state.cues,
	]);

	useLayoutEffect(() => {
		if (gameRef.current === game) return;
		gameRef.current = game;
		onSceneReset();
		setState(emptyState());
		for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
		fallbacks.current.clear();
	}, [
		game,
		onSceneReset,
	]);

	useEffect(
		() => () => {
			for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
			fallbacks.current.clear();
		},
		[],
	);

	return {
		cues: state.cues,
		retainedItems: [...state.retained.values()],
		complete,
	};
};
