import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { GameEventEnumSchema, useGameEvents } from "~/bridge/event/useGameEvents";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";

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
		if (batch.events.some((event) => event.type === GameEventEnumSchema.enum.CurrentSpaceChanged)) {
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
					case GameEventEnumSchema.enum.CurrentSpaceChanged:
						for (const itemId of cues.keys()) {
							const item = liveById.get(itemId) ?? retained.get(itemId);
							if (item?.location.scope !== LocationScopeEnumSchema.enum.Board) continue;
							cues.delete(itemId);
							retained.delete(itemId);
							changed = true;
						}
						for (const item of liveItemsRef.current) {
							if (
								item.location.scope === LocationScopeEnumSchema.enum.Board &&
								item.location.space === event.currentSpace
							) {
								cue(item.id, "settle", false);
							}
						}
						break;
					case GameEventEnumSchema.enum.ItemSpawned:
					case GameEventEnumSchema.enum.ItemPlaced:
						cue(event.itemId, "spawn", false);
						break;
					case GameEventEnumSchema.enum.ItemStacked:
					case GameEventEnumSchema.enum.ItemSplit:
						cue(event.itemId, "impact", false);
						break;
					case GameEventEnumSchema.enum.ItemConsumed:
						cue(
							event.sourceItemId,
							event.resultingQuantity === 0 ? "exit" : "impact",
							event.resultingQuantity === 0,
						);
						break;
					case GameEventEnumSchema.enum.ItemExpired:
						cue(event.itemId, "exit", true);
						break;
					case GameEventEnumSchema.enum.ItemDepleted:
						cue(
							event.itemId,
							event.resultingQuantity === 0 ? "exit" : "impact",
							event.resultingQuantity === 0,
						);
						break;
					case GameEventEnumSchema.enum.JobStarted:
						cue(event.ownerItemId, "accept", false);
						break;
					case GameEventEnumSchema.enum.ItemMerged:
					case GameEventEnumSchema.enum.JobCompleted:
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
