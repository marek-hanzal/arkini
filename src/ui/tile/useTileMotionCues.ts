import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import {
	type TileActorTransitionSource,
	useTileActorTransitionSource,
} from "~/bridge/tile/useTileActorTransitionSource";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";

interface TileMotionCueState {
	readonly sequence: number;
	readonly liveItems: ReadonlyArray<useTileActors.Item>;
	readonly nextGeneration: number;
	readonly cues: ReadonlyMap<string, TileMotionCueSchema.Type>;
	readonly retained: ReadonlyMap<string, useTileActors.Item>;
}

interface TileMotionCueFallback {
	readonly generation: number;
	readonly timer: ReturnType<typeof setTimeout>;
}

const cueFallbackMs = 2_000;

const emptyState = (): TileMotionCueState => ({
	sequence: -1,
	liveItems: [],
	nextGeneration: 0,
	cues: new Map(),
	retained: new Map(),
});

const applyTransition = (
	current: TileMotionCueState,
	transition: TileActorTransitionSource["initial"],
): TileMotionCueState => {
	if (transition.sequence <= current.sequence) return current;
	if (transition.events.length === 0 && transition.liveItems === current.liveItems) {
		return current;
	}
	const cues = new Map(current.cues);
	const retained = new Map(current.retained);
	const liveById = new Map([
		...(transition.previousItems ?? []).map((item) => [item.id, item] as const),
		...transition.liveItems.map((item) => [item.id, item] as const),
		...retained.entries(),
	]);
	let nextGeneration = current.nextGeneration;
	let settleSpace: number | null = null;

	const cue = (
		itemId: string,
		kind: TileMotionCueSchema.Type["kind"],
		retain: boolean,
		originItemId?: string,
		deliveryQuantity?: number,
		targetItemId?: string,
		previousQuantity?: number,
	) => {
		const existing = cues.get(itemId);
		if (existing?.kind === "exit" && kind !== "exit") return;
		if (existing?.kind === "spawn" && kind === "spawn") return;
		if (retain) {
			const snapshot = liveById.get(itemId) ?? retained.get(itemId);
			if (snapshot !== undefined) retained.set(itemId, snapshot);
		}
		const strength =
			existing?.kind === kind &&
			(kind === "absorb" || kind === "impact" || kind === "accept")
				? Math.min(3, existing.strength + 1)
				: 1;
		cues.set(itemId, {
			generation: ++nextGeneration,
			kind,
			strength,
			...(originItemId === undefined ? {} : { originItemId }),
			...(deliveryQuantity === undefined ? {} : { deliveryQuantity }),
			...(targetItemId === undefined ? {} : { targetItemId }),
			...(previousQuantity === undefined ? {} : { previousQuantity }),
		});
	};

	for (const event of transition.events) {
		switch (event.type) {
			case GameEventEnumSchema.enum.CurrentSpaceChanged:
				for (const itemId of cues.keys()) {
					const item = liveById.get(itemId) ?? retained.get(itemId);
					if (item?.location.scope !== LocationScopeEnumSchema.enum.Board) continue;
					cues.delete(itemId);
					retained.delete(itemId);
				}
				settleSpace = event.currentSpace;
				break;
			case GameEventEnumSchema.enum.ItemSpawned:
			case GameEventEnumSchema.enum.ItemPlaced:
				cue(event.itemId, "spawn", false, event.originItemId);
				break;
			case GameEventEnumSchema.enum.ItemStacked:
				cue(
					event.itemId,
					"absorb",
					false,
					event.originItemId,
					event.quantity - event.previousQuantity,
				);
				break;
			case GameEventEnumSchema.enum.ItemSplit:
				cue(event.itemId, "impact", false);
				break;
			case GameEventEnumSchema.enum.ItemConsumed:
				break;
			case GameEventEnumSchema.enum.ItemInputStored:
				cue(
					event.sourceItemId,
					event.resultingQuantity === 0 ? "consume-exit" : "consume",
					event.resultingQuantity === 0,
					undefined,
					undefined,
					event.ownerItemId,
					event.previousQuantity,
				);
				cue(event.ownerItemId, "accept", false);
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

	if (settleSpace !== null) {
		for (const item of transition.liveItems) {
			if (
				item.location.scope !== LocationScopeEnumSchema.enum.Board ||
				item.location.space !== settleSpace ||
				cues.has(item.id)
			) {
				continue;
			}
			cues.set(item.id, {
				generation: ++nextGeneration,
				kind: "settle",
				strength: 1,
			});
		}
	}

	return {
		sequence: transition.sequence,
		liveItems: transition.liveItems,
		nextGeneration,
		cues,
		retained,
	};
};

const stateFromSource = (source: TileActorTransitionSource) =>
	applyTransition(emptyState(), source.initial);

/** Translates exact ordered committed transitions into bounded actor-local cue generations. */
export const useTileMotionCues = ({
	onSceneReset,
}: {
	readonly onSceneReset: () => void;
}) => {
	const source = useTileActorTransitionSource();
	const sourceRef = useRef(source);
	const fallbacks = useRef(new Map<string, TileMotionCueFallback>());
	const [state, setState] = useState<TileMotionCueState>(() => stateFromSource(source));

	const complete = useCallback((itemId: string, generation: number) => {
		setState((current) => {
			if (current.cues.get(itemId)?.generation !== generation) return current;
			const cues = new Map(current.cues);
			const retained = new Map(current.retained);
			cues.delete(itemId);
			retained.delete(itemId);
			return {
				...current,
				cues,
				retained,
			};
		});
	}, []);

	useLayoutEffect(() => {
		if (sourceRef.current !== source) {
			sourceRef.current = source;
			onSceneReset();
			setState(stateFromSource(source));
			for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
			fallbacks.current.clear();
		}

		return source.subscribe((transition) => {
			if (sourceRef.current !== source) return;
			if (
				transition.events.some(
					(event) => event.type === GameEventEnumSchema.enum.CurrentSpaceChanged,
				)
			) {
				onSceneReset();
			}
			setState((current) => applyTransition(current, transition));
		});
	}, [onSceneReset, source]);

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
	}, [complete, state.cues]);

	useEffect(
		() => () => {
			for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
			fallbacks.current.clear();
		},
		[],
	);

	return {
		liveItems: state.liveItems,
		cues: state.cues,
		retainedItems: [...state.retained.values()],
		complete,
	};
};
