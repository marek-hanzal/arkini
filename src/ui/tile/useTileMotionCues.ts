import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

import { GameEventEnumSchema } from "~/bridge/event/useGameEvents";
import { JobStatusEnumSchema } from "~/bridge/job/JobStatusEnumSchema";
import { LocationScopeEnumSchema } from "~/bridge/tile/LocationScopeEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import {
	type TileActorTransitionSource,
	useTileActorTransitionSource,
} from "~/bridge/tile/useTileActorTransitionSource";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { tileProducerEmissionReleaseDelay } from "~/ui/tile/tileProducerEmissionTiming";

interface TileMotionCueState {
	readonly sequence: number;
	readonly liveItems: ReadonlyArray<useTileActors.Item>;
	readonly nextGeneration: number;
	readonly cues: ReadonlyMap<string, TileMotionCueSchema.Type>;
	readonly followUps: ReadonlyMap<string, TileMotionCueSchema.Type>;
	readonly retained: ReadonlyMap<string, useTileActors.Item>;
	readonly morphPreviousItems: ReadonlyMap<
		string,
		{
			readonly generation: number;
			readonly item: useTileActors.Item;
		}
	>;
}

interface TileMotionCueFallback {
	readonly generation: number;
	readonly timer: ReturnType<typeof setTimeout>;
}

interface TileProducerEmissionRelease {
	readonly producerItemId: string;
	readonly producerGeneration: number;
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
	morphPreviousItems: new Map(),
});

const isTerminalCue = (kind: TileMotionCueSchema.Type["kind"]) =>
	kind === "exit" || kind === "consume-exit" || kind === "deplete-exit" || kind === "expiry";

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
		case "morph":
			return 45;
		case "consume":
			return 50;
		case "absorb":
			return 40;
		case "complete":
			return 35;
		case "charge":
			return 32;
		case "accept":
			return 30;
		case "pause":
		case "resume":
			return 28;
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
): TileMotionCueSchema.Type => {
	if (existing.kind === "absorb" && incoming.kind === "absorb") {
		const waitingForContact = existing.deliveryContacted !== true;
		return {
			...incoming,
			...(waitingForContact && existing.previousQuantity !== undefined
				? {
						previousQuantity: existing.previousQuantity,
					}
				: {}),
			...(waitingForContact &&
			existing.deliveryQuantity !== undefined &&
			incoming.deliveryQuantity !== undefined
				? {
						deliveryQuantity: existing.deliveryQuantity + incoming.deliveryQuantity,
					}
				: {}),
			strength: Math.min(3, existing.strength + 1),
		};
	}
	return {
		...incoming,
		strength:
			existing.kind === incoming.kind && isStrengthCue(incoming.kind)
				? Math.min(3, existing.strength + 1)
				: incoming.strength,
	};
};

const resolveFollowUp = (
	existing: TileMotionCueSchema.Type | undefined,
	incoming: TileMotionCueSchema.Type,
) => {
	if (existing === undefined) return incoming;
	if (existing.kind === incoming.kind) {
		if (
			existing.kind === "absorb" &&
			incoming.kind === "absorb" &&
			(existing.originItemId !== incoming.originItemId ||
				existing.producerEmissionId !== incoming.producerEmissionId)
		) {
			return existing;
		}
		return coalesceCue(existing, incoming);
	}
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
	const morphPreviousItems = new Map(current.morphPreviousItems);
	const liveById = new Map([
		...(transition.previousItems ?? []).map(
			(item) =>
				[
					item.id,
					item,
				] as const,
		),
		...transition.liveItems.map(
			(item) =>
				[
					item.id,
					item,
				] as const,
		),
		...retained.entries(),
	]);
	let nextGeneration = current.nextGeneration;
	let settleSpace: number | null = null;
	const terminalDepletionIds = new Set(
		transition.events.flatMap((event) =>
			event.type === GameEventEnumSchema.enum.ItemDepleted && event.resultingQuantity === 0
				? [
						event.itemId,
					]
				: [],
		),
	);
	const emissionOwnerIds = new Set([
		...terminalDepletionIds,
		...transition.events.flatMap((event) =>
			event.type === GameEventEnumSchema.enum.JobCompleted
				? [
						event.ownerItemId,
					]
				: [],
		),
	]);
	const emissionTargetIdsByOrigin = new Map<string, string[]>();
	for (const event of transition.events) {
		if (
			event.type !== GameEventEnumSchema.enum.ItemSpawned &&
			event.type !== GameEventEnumSchema.enum.ItemPlaced &&
			event.type !== GameEventEnumSchema.enum.ItemStacked
		) {
			continue;
		}
		if (!emissionOwnerIds.has(event.originItemId)) continue;
		const targets = emissionTargetIdsByOrigin.get(event.originItemId) ?? [];
		if (!targets.includes(event.itemId)) targets.push(event.itemId);
		emissionTargetIdsByOrigin.set(event.originItemId, targets);
	}
	const emissionIdByOrigin = new Map(
		[
			...emissionTargetIdsByOrigin.keys(),
		].map((originItemId) => [
			originItemId,
			`${transition.sequence}:${originItemId}`,
		]),
	);

	const cue = (
		itemId: string,
		kind: TileMotionCueSchema.Type["kind"],
		retain: boolean,
		originItemId?: string,
		deliveryQuantity?: number,
		targetItemId?: string,
		previousQuantity?: number,
		emissionTargetItemIds?: ReadonlyArray<string>,
		producerEmissionId?: string,
		emissionFromCollapse?: boolean,
		resultingQuantity?: number,
	) => {
		if (retain) {
			const snapshot = liveById.get(itemId) ?? retained.get(itemId);
			if (snapshot !== undefined) retained.set(itemId, snapshot);
		}
		const incoming: TileMotionCueSchema.Type = {
			generation: ++nextGeneration,
			kind,
			strength: 1,
			...(originItemId === undefined
				? {}
				: {
						originItemId,
					}),
			...(deliveryQuantity === undefined
				? {}
				: {
						deliveryQuantity,
					}),
			...(targetItemId === undefined
				? {}
				: {
						targetItemId,
					}),
			...(previousQuantity === undefined
				? {}
				: {
						previousQuantity,
					}),
			...(emissionTargetItemIds === undefined
				? {}
				: {
						emissionTargetItemIds: [
							...emissionTargetItemIds,
						],
					}),
			...(producerEmissionId === undefined
				? {}
				: {
						producerEmissionId,
					}),
			...(emissionFromCollapse === true
				? {
						emissionFromCollapse: true as const,
					}
				: {}),
			...(resultingQuantity === undefined
				? {}
				: {
						resultingQuantity,
					}),
		};
		const existing = cues.get(itemId);
		if (existing === undefined) {
			cues.set(itemId, incoming);
			return;
		}
		if (isTerminalCue(existing.kind)) return;
		if (isTerminalCue(incoming.kind)) {
			const emissionOwner = [
				existing,
				followUps.get(itemId),
			].find(
				(candidate) =>
					candidate?.producerEmissionId !== undefined &&
					candidate.emissionTargetItemIds !== undefined,
			);
			const terminalEmissionOwner =
				incoming.producerEmissionId !== undefined &&
				incoming.emissionTargetItemIds !== undefined
					? incoming
					: emissionOwner;
			cues.set(
				itemId,
				terminalEmissionOwner === undefined
					? incoming
					: {
							...incoming,
							emissionTargetItemIds: terminalEmissionOwner.emissionTargetItemIds,
							producerEmissionId: terminalEmissionOwner.producerEmissionId,
						},
			);
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
			if (
				existing.kind === "absorb" &&
				incoming.kind === "absorb" &&
				(existing.originItemId !== incoming.originItemId ||
					existing.producerEmissionId !== incoming.producerEmissionId)
			) {
				followUps.set(itemId, resolveFollowUp(followUps.get(itemId), incoming));
				return;
			}
			if (
				incoming.kind === "complete" &&
				existing.producerEmissionId !== undefined &&
				incoming.producerEmissionId !== undefined &&
				existing.producerEmissionId !== incoming.producerEmissionId
			) {
				const reboundTargetItemIds = new Set<string>();
				const rebindPendingOutputs = (
					sourceCues: Map<string, TileMotionCueSchema.Type>,
				) => {
					for (const [outputItemId, outputCue] of sourceCues) {
						if (
							(outputCue.kind !== "spawn" && outputCue.kind !== "absorb") ||
							outputCue.producerEmissionId !== existing.producerEmissionId ||
							outputCue.producerEmissionReleased === true
						) {
							continue;
						}
						sourceCues.set(outputItemId, {
							...outputCue,
							producerEmissionId: incoming.producerEmissionId,
						});
						reboundTargetItemIds.add(outputItemId);
					}
				};
				rebindPendingOutputs(cues);
				rebindPendingOutputs(followUps);
				cues.set(
					itemId,
					coalesceCue(existing, {
						...incoming,
						emissionTargetItemIds: [
							...new Set([
								...reboundTargetItemIds,
								...(incoming.emissionTargetItemIds ?? []),
							]),
						],
					}),
				);
				return;
			}
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

	if (transition.previousItems !== null) {
		const previousItemsById = new Map(
			transition.previousItems.map((item) => [
				item.id,
				item,
			]),
		);
		for (const item of transition.liveItems) {
			const previous = previousItemsById.get(item.id);
			if (
				previous?.jobStatus === JobStatusEnumSchema.enum.Running &&
				item.jobStatus === JobStatusEnumSchema.enum.Paused
			) {
				cue(item.id, "pause", false);
			} else if (
				previous?.jobStatus === JobStatusEnumSchema.enum.Paused &&
				item.jobStatus === JobStatusEnumSchema.enum.Running
			) {
				cue(item.id, "resume", false);
			}
		}
	}

	for (const event of transition.events) {
		switch (event.type) {
			case GameEventEnumSchema.enum.CurrentSpaceChanged:
				for (const itemId of new Set([
					...cues.keys(),
					...followUps.keys(),
				])) {
					const item = liveById.get(itemId) ?? retained.get(itemId);
					if (item?.location.scope !== LocationScopeEnumSchema.enum.Board) continue;
					cues.delete(itemId);
					followUps.delete(itemId);
					retained.delete(itemId);
					morphPreviousItems.delete(itemId);
				}
				settleSpace = event.currentSpace;
				break;
			case GameEventEnumSchema.enum.ItemSpawned:
			case GameEventEnumSchema.enum.ItemPlaced:
				cue(
					event.itemId,
					"spawn",
					false,
					event.originItemId,
					undefined,
					undefined,
					undefined,
					undefined,
					emissionIdByOrigin.get(event.originItemId),
					terminalDepletionIds.has(event.originItemId) ? true : undefined,
				);
				break;
			case GameEventEnumSchema.enum.ItemStacked:
				cue(
					event.itemId,
					"absorb",
					false,
					event.originItemId,
					event.quantity - event.previousQuantity,
					undefined,
					event.previousQuantity,
					undefined,
					emissionIdByOrigin.get(event.originItemId),
					terminalDepletionIds.has(event.originItemId) ? true : undefined,
					event.quantity,
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
			case GameEventEnumSchema.enum.ItemChargeSpent:
				cue(event.itemId, "charge", false);
				break;
			case GameEventEnumSchema.enum.ItemExpired:
				cue(event.itemId, "expiry", true);
				break;
			case GameEventEnumSchema.enum.ItemDepleted:
				cue(
					event.itemId,
					event.resultingQuantity === 0 ? "deplete-exit" : "deplete",
					event.resultingQuantity === 0,
					undefined,
					undefined,
					undefined,
					undefined,
					event.resultingQuantity === 0
						? emissionTargetIdsByOrigin.get(event.itemId)
						: undefined,
					event.resultingQuantity === 0
						? emissionIdByOrigin.get(event.itemId)
						: undefined,
				);
				break;
			case GameEventEnumSchema.enum.ItemExplicitlyRemoved:
				cue(event.itemId, "exit", true);
				break;
			case GameEventEnumSchema.enum.JobStarted:
				cue(event.ownerItemId, "accept", false);
				break;
			case GameEventEnumSchema.enum.JobCompleted:
				cue(
					event.ownerItemId,
					"complete",
					false,
					undefined,
					undefined,
					undefined,
					undefined,
					emissionTargetIdsByOrigin.get(event.ownerItemId),
					emissionIdByOrigin.get(event.ownerItemId),
				);
				break;
			case GameEventEnumSchema.enum.ItemMerged:
				if (
					event.effect !== "replace" ||
					event.resultCanonicalItemId === undefined ||
					transition.previousItems === null
				) {
					break;
				}
				{
					const previousTarget = transition.previousItems.find(
						(item) => item.id === event.targetItemId,
					);
					const committedTarget = transition.liveItems.find(
						(item) => item.id === event.targetItemId,
					);
					if (
						previousTarget === undefined ||
						committedTarget === undefined ||
						previousTarget.itemId === committedTarget.itemId ||
						committedTarget.itemId !== event.resultCanonicalItemId
					) {
						break;
					}
					const pendingMorphCue =
						cues.get(event.targetItemId)?.kind === "morph"
							? cues.get(event.targetItemId)
							: followUps.get(event.targetItemId)?.kind === "morph"
								? followUps.get(event.targetItemId)
								: undefined;
					const pendingMorphPrevious = morphPreviousItems.get(event.targetItemId);
					cue(event.targetItemId, "morph", false);
					const morphCue =
						cues.get(event.targetItemId)?.kind === "morph"
							? cues.get(event.targetItemId)
							: followUps.get(event.targetItemId)?.kind === "morph"
								? followUps.get(event.targetItemId)
								: undefined;
					if (morphCue !== undefined) {
						morphPreviousItems.set(event.targetItemId, {
							generation: morphCue.generation,
							item:
								pendingMorphCue !== undefined &&
								pendingMorphPrevious?.generation === pendingMorphCue.generation
									? pendingMorphPrevious.item
									: previousTarget,
						});
					}
				}
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
		morphPreviousItems,
	};
};

const stateFromSource = (source: TileActorTransitionSource): TileMotionCueState => ({
	...emptyState(),
	sequence: source.initial.sequence - 1,
	liveItems: source.initial.liveItems,
});

/** Translates exact ordered committed transitions into bounded actor-local cue generations. */
export const useTileMotionCues = ({ onSceneReset }: { readonly onSceneReset: () => void }) => {
	const source = useTileActorTransitionSource();
	const reducedMotion = useReducedMotion();
	const sourceRef = useRef(source);
	const fallbacks = useRef(new Map<string, TileMotionCueFallback>());
	const emissionReleases = useRef(new Map<string, TileProducerEmissionRelease>());
	const [state, setState] = useState<TileMotionCueState>(() => stateFromSource(source));
	const stateRef = useRef(state);
	useLayoutEffect(() => {
		stateRef.current = state;
	}, [
		state,
	]);

	const complete = useCallback((itemId: string, generation: number) => {
		setState((current) => {
			if (current.cues.get(itemId)?.generation !== generation) return current;
			const cues = new Map(current.cues);
			const followUps = new Map(current.followUps);
			const retained = new Map(current.retained);
			const morphPreviousItems = new Map(current.morphPreviousItems);
			const followUp = followUps.get(itemId);
			followUps.delete(itemId);
			if (followUp === undefined) {
				cues.delete(itemId);
				retained.delete(itemId);
				morphPreviousItems.delete(itemId);
			} else {
				cues.set(itemId, followUp);
				const morphPrevious = morphPreviousItems.get(itemId);
				if (
					followUp.kind !== "morph" ||
					morphPrevious?.generation !== followUp.generation
				) {
					morphPreviousItems.delete(itemId);
				}
			}
			return {
				...current,
				cues,
				followUps,
				retained,
				morphPreviousItems,
			};
		});
	}, []);

	const contact = useCallback((itemId: string, generation: number) => {
		setState((current) => {
			const currentCue = current.cues.get(itemId);
			if (
				currentCue?.generation !== generation ||
				currentCue.kind !== "absorb" ||
				currentCue.deliveryContacted === true
			) {
				return current;
			}
			const cues = new Map(current.cues);
			cues.set(itemId, {
				...currentCue,
				deliveryContacted: true,
			});
			return {
				...current,
				cues,
			};
		});
	}, []);

	const start = useCallback(
		(itemId: string, generation: number) => {
			const currentCue = stateRef.current.cues.get(itemId);
			if (currentCue?.generation !== generation) return;
			const hasPendingEmissionOutput =
				currentCue.producerEmissionId !== undefined &&
				[
					...stateRef.current.cues.values(),
					...stateRef.current.followUps.values(),
				].some(
					(candidate) =>
						(candidate.kind === "spawn" || candidate.kind === "absorb") &&
						candidate.producerEmissionId === currentCue.producerEmissionId &&
						candidate.producerEmissionReleased !== true,
				);
			if (
				currentCue.producerEmissionId !== undefined &&
				currentCue.emissionTargetItemIds !== undefined &&
				hasPendingEmissionOutput &&
				!emissionReleases.current.has(currentCue.producerEmissionId)
			) {
				const emissionId = currentCue.producerEmissionId;
				const release = () => {
					const pending = emissionReleases.current.get(emissionId);
					if (
						pending?.producerItemId !== itemId ||
						pending.producerGeneration !== generation
					) {
						return;
					}
					emissionReleases.current.delete(emissionId);
					setState((current) => {
						const producerCue = current.cues.get(itemId);
						if (
							producerCue?.generation !== generation ||
							producerCue.producerEmissionId !== emissionId ||
							producerCue.emissionTargetItemIds === undefined
						) {
							return current;
						}
						let changed = false;
						const releaseOutputs = (
							sourceCues: ReadonlyMap<string, TileMotionCueSchema.Type>,
						) => {
							const next = new Map(sourceCues);
							for (const [outputItemId, outputCue] of sourceCues) {
								if (
									outputCue.producerEmissionId !== emissionId ||
									(outputCue.kind !== "spawn" && outputCue.kind !== "absorb") ||
									outputCue.producerEmissionReleased === true
								) {
									continue;
								}
								next.set(outputItemId, {
									...outputCue,
									producerEmissionReleased: true,
								});
								changed = true;
							}
							return next;
						};
						const cues = releaseOutputs(current.cues);
						const followUps = releaseOutputs(current.followUps);
						return changed
							? {
									...current,
									cues,
									followUps,
								}
							: current;
					});
				};
				const timer = setTimeout(
					release,
					reducedMotion ? 0 : tileProducerEmissionReleaseDelay * 1_000,
				);
				emissionReleases.current.set(emissionId, {
					producerItemId: itemId,
					producerGeneration: generation,
					timer,
				});
			}
			const existing = fallbacks.current.get(itemId);
			if (existing?.generation === generation) return;
			if (existing !== undefined) clearTimeout(existing.timer);
			fallbacks.current.set(itemId, {
				generation,
				timer: setTimeout(() => complete(itemId, generation), cueFallbackMs),
			});
		},
		[
			complete,
			reducedMotion,
		],
	);

	useLayoutEffect(() => {
		if (sourceRef.current !== source) {
			sourceRef.current = source;
			onSceneReset();
			setState(stateFromSource(source));
			for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
			fallbacks.current.clear();
			for (const release of emissionReleases.current.values()) clearTimeout(release.timer);
			emissionReleases.current.clear();
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
	}, [
		onSceneReset,
		source,
	]);

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
	}, [
		start,
		state.cues,
		state.liveItems,
		state.retained,
	]);

	useEffect(() => {
		for (const [emissionId, release] of emissionReleases.current) {
			const producerCue = state.cues.get(release.producerItemId);
			if (
				producerCue?.generation === release.producerGeneration &&
				producerCue.producerEmissionId === emissionId
			) {
				continue;
			}
			clearTimeout(release.timer);
			emissionReleases.current.delete(emissionId);
		}

		const ownedEmissionIds = new Set(
			[
				...state.cues.values(),
				...state.followUps.values(),
			].flatMap((cue) =>
				cue.emissionTargetItemIds !== undefined && cue.producerEmissionId !== undefined
					? [
							cue.producerEmissionId,
						]
					: [],
			),
		);
		const hasOrphan = [
			...state.cues.values(),
			...state.followUps.values(),
		].some(
			(cue) =>
				cue.producerEmissionId !== undefined &&
				(cue.kind === "spawn" || cue.kind === "absorb") &&
				cue.producerEmissionReleased !== true &&
				!ownedEmissionIds.has(cue.producerEmissionId),
		);
		if (!hasOrphan) return;
		setState((current) => {
			const releaseOrphans = (sourceCues: ReadonlyMap<string, TileMotionCueSchema.Type>) => {
				const next = new Map(sourceCues);
				for (const [itemId, cue] of sourceCues) {
					if (
						cue.producerEmissionId === undefined ||
						(cue.kind !== "spawn" && cue.kind !== "absorb") ||
						cue.producerEmissionReleased === true ||
						ownedEmissionIds.has(cue.producerEmissionId)
					) {
						continue;
					}
					next.set(itemId, {
						...cue,
						producerEmissionReleased: true,
					});
				}
				return next;
			};
			return {
				...current,
				cues: releaseOrphans(current.cues),
				followUps: releaseOrphans(current.followUps),
			};
		});
	}, [
		state.cues,
		state.followUps,
	]);

	useEffect(
		() => () => {
			for (const fallback of fallbacks.current.values()) clearTimeout(fallback.timer);
			fallbacks.current.clear();
			for (const release of emissionReleases.current.values()) clearTimeout(release.timer);
			emissionReleases.current.clear();
		},
		[],
	);

	return {
		liveItems: state.liveItems,
		cues: state.cues,
		retainedItems: [
			...state.retained.values(),
		],
		morphPreviousItems: state.morphPreviousItems,
		start,
		contact,
		complete,
	};
};
