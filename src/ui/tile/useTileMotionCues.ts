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
	readonly followUps: ReadonlyMap<string, TileMotionCueSchema.Type>;
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
	followUps: new Map(),
	retained: new Map(),
});

const isTerminalCue = (kind: TileMotionCueSchema.Type["kind"]) =>
	kind === "exit" ||
	kind === "consume-exit" ||
	kind === "deplete-exit" ||
	kind === "expiry";

const isStrengthCue = (kind: TileMotionCueSchema.Type["kind"]) =>
	kind === "absorb" ||
	kind === "impact" ||
	kind === "accept" ||
	kind === "complete" ||
	kind === "deplete";

const cuePriority = (kind: TileMotionCueSchema.Type["kind"]) => {
	switch (kind) {
		case "exit":
		case "consume-exit":
		case "deplete-exit":
		case "expiry":
			return 100;
		case "spawn":
			return 90;
		case "consume":
			return 50;
		case "absorb":
			return 40;
		case "complete":
			return 35;
		case "accept":
			return 30;
		case "deplete":
			return 25;
		case "impact":
			return 20;
		case "settle":
			return 10;
	}
};

const coalesceCue = (
	existing: TileMotionCueSchema.Type,
	incoming: TileMotionCueSchema.Type,
): TileMotionCueSchema.Type => ({
	...incoming,
	strength:
		existing.kind === incoming.kind && isStrengthCue(incoming.kind)
			? Math.min(3, existing.strength + 1)
			: incoming.strength,
});

const resolveFollowUp = (
	existing: TileMotionCueSchema.Type | undefined,
	incoming: TileMotionCueSchema.Type,
) => {
	if (existing === undefined) return incoming;
	if (existing.kind === incoming.kind) return coalesceCue(existing, incoming);
	return cuePriority(incoming.kind) >= cuePriority(existing.kind) ? incoming : existing;
};

const applyTransition = (
	current: TileMotionCueState,
	transition: TileActorTransitionSource["initial"],
): TileMotionCueState => {
	if (transition.sequence <= current.sequence) return current;
	if (transition.events.length === 0 && transition.liveItems === current.liveItems) {
		return current;
	}
	const cues = new Map(current.cues);
	const followUps = new Map(current.followUps);
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
		if (retain) {
			const snapshot = liveById.get(itemId) ?? retained.get(itemId);
			if (snapshot !== undefined) retained.set(itemId, snapshot);
		}
		const incoming: TileMotionCueSchema.Type = {
			generation: ++nextGeneration,
			kind,
			strength: 1,
			...(originItemId === undefined ? {} : { originItemId }),
			...(deliveryQuantity === undefined ? {} : { deliveryQuantity }),
			...(targetItemId === undefined ? {} : { targetItemId }),
			...(previousQuantity === undefined ? {} : { previousQuantity }),
		};
		const existing = cues.get(itemId);
		if (existing === undefined) {
			cues.set(itemId, incoming);
			return;
		}
		if (isTerminalCue(existing.kind)) return;
		if (isTerminalCue(incoming.kind)) {
			cues.set(itemId, incoming);
			followUps.delete(itemId);
			return;
		}
		if (existing.kind === "spawn") {
			if (incoming.kind === "spawn" || incoming.kind === "settle") return;
			followUps.set(itemId, resolveFollowUp(followUps.get(itemId), incoming));
			return;
		}
		if (incoming.kind === "spawn") {
			cues.set(itemId, incoming);
			if (existing.kind !== "settle") {
				followUps.set(itemId, resolveFollowUp(followUps.get(itemId), existing));
			}
			return;
		}
		if (existing.kind === incoming.kind) {
			cues.set(itemId, coalesceCue(existing, incoming));
			return;
		}
		if (incoming.kind === "settle") return;
		if (existing.kind === "settle") {
			cues.set(itemId, incoming);
			return;
		}
		followUps.set(itemId, resolveFollowUp(followUps.get(itemId), incoming));
	};

	for (const event of transition.events) {
		switch (event.type) {
			case GameEventEnumSchema.enum.CurrentSpaceChanged:
				for (const itemId of new Set([...cues.keys(), ...followUps.keys()])) {
					const item = liveById.get(itemId) ?? retained.get(itemId);
					if (item?.location.scope !== LocationScopeEnumSchema.enum.Board) continue;
					cues.delete(itemId);
					followUps.delete(itemId);
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
				cue(event.itemId, "expiry", true);
				break;
			case GameEventEnumSchema.enum.ItemDepleted:
				cue(
					event.itemId,
					event.resultingQuantity === 0 ? "deplete-exit" : "deplete",
					event.resultingQuantity === 0,
				);
				break;
			case GameEventEnumSchema.enum.JobStarted:
				cue(event.ownerItemId, "accept", false);
				break;
			case GameEventEnumSchema.enum.JobCompleted:
				cue(event.ownerItemId, "complete", false);
				break;
			case GameEventEnumSchema.enum.ItemMerged:
				break;
		}
	}

	if (settleSpace !== null) {
		for (const item of transition.liveItems) {
			if (
				item.location.scope !== LocationScopeEnumSchema.enum.Board ||
				item.location.space !== settleSpace ||
				cues.has(item.id) ||
				followUps.has(item.id)
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
		followUps,
		retained,
	};
};

const stateFromSource = (source: TileActorTransitionSource): TileMotionCueState => ({
	...emptyState(),
	sequence: source.initial.sequence - 1,
	liveItems: source.initial.liveItems,
});

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
	const stateRef = useRef(state);
	useLayoutEffect(() => {
		stateRef.current = state;
	}, [state]);

	const complete = useCallback((itemId: string, generation: number) => {
		setState((current) => {
			if (current.cues.get(itemId)?.generation !== generation) return current;
			const cues = new Map(current.cues);
			const followUps = new Map(current.followUps);
			const retained = new Map(current.retained);
			const followUp = followUps.get(itemId);
			followUps.delete(itemId);
			if (followUp === undefined) {
				cues.delete(itemId);
				retained.delete(itemId);
			} else {
				cues.set(itemId, followUp);
			}
			return {
				...current,
				cues,
				followUps,
				retained,
			};
		});
	}, []);

	const start = useCallback(
		(itemId: string, generation: number) => {
			if (stateRef.current.cues.get(itemId)?.generation !== generation) return;
			const existing = fallbacks.current.get(itemId);
			if (existing?.generation === generation) return;
			if (existing !== undefined) clearTimeout(existing.timer);
			fallbacks.current.set(itemId, {
				generation,
				timer: setTimeout(() => complete(itemId, generation), cueFallbackMs),
			});
		},
		[complete],
	);

	useLayoutEffect(() => {
		if (sourceRef.current !== source) {
			sourceRef.current = source;
			onSceneReset();
			setState(stateFromSource(source));
			for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
			fallbacks.current.clear();
		}

		setState((current) => applyTransition(current, source.claimCurrent()));

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
		const renderedIds = new Set([
			...state.liveItems.map((item) => item.id),
			...state.retained.keys(),
		]);
		for (const [itemId, cue] of state.cues) {
			if (renderedIds.has(itemId)) continue;
			start(itemId, cue.generation);
		}
	}, [start, state.cues, state.liveItems, state.retained]);

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
		start,
		complete,
	};
};
