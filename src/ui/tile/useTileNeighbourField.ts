import { useCallback, useEffect, useRef } from "react";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import { TileActorBaseScale } from "~/ui/tile/TileActorBaseScale";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";

interface TileNeighbourMotionValue {
	readonly get: () => number;
	readonly set: (value: number) => void;
}

interface TileNeighbourActorRegistration {
	readonly itemId: string;
	readonly node: HTMLElement;
	source: TileDragSource;
	readonly x: TileNeighbourMotionValue;
	readonly y: TileNeighbourMotionValue;
	readonly appliedX: TileNeighbourMotionValue;
	readonly appliedY: TileNeighbourMotionValue;
	readonly scale: TileNeighbourMotionValue;
	readonly appliedScale: TileNeighbourMotionValue;
	readonly canonicalWidth: TileNeighbourMotionValue;
	readonly canonicalHeight: TileNeighbourMotionValue;
	enabled: boolean;
}

export interface TileActorPose {
	readonly bounds: DOMRect;
	readonly source: TileDragSource;
}

interface TileActorPoseFollower {
	readonly listener: (pose: TileActorPose | null) => void;
}

interface TileNeighbourMover {
	readonly generation: number;
}

interface TileNeighbourTravelTarget {
	readonly itemId: string;
	readonly feedback: "accepted" | "merge" | "rejected";
}

type TileNeighbourCandidateKind = "accepted" | "merge" | "rejected" | "incompatible";

const combinedDisplacementLimit = 18;
const acceptedCandidateScaleLimit = 0.96;
const acceptingTargetScaleLimit = 0.96;

const translatedRect = (bounds: DOMRect, x: number, y: number, scale: number): DOMRect => {
	const safeScale = Number.isFinite(scale) && scale > 0.01 ? scale : 1;
	const width = bounds.width / safeScale;
	const height = bounds.height / safeScale;
	const centerX = bounds.left + bounds.width / 2 - x;
	const centerY = bounds.top + bounds.height / 2 - y;
	const left = centerX - width / 2;
	const top = centerY - height / 2;
	return {
		x: left,
		y: top,
		left,
		top,
		right: left + width,
		bottom: top + height,
		width,
		height,
		toJSON: () => bounds.toJSON(),
	};
};

const scaleMultiplierForAbsoluteTarget = (
	registration: TileNeighbourActorRegistration,
	bounds: DOMRect,
	targetScale: number,
) => {
	const canonicalWidth = registration.canonicalWidth.get();
	const canonicalHeight = registration.canonicalHeight.get();
	if (canonicalWidth <= 0 || canonicalHeight <= 0) return 1;
	const currentScale = Math.max(bounds.width / canonicalWidth, bounds.height / canonicalHeight);
	if (!Number.isFinite(currentScale) || currentScale <= 0.01) return 1;
	return Math.max(1, targetScale / currentScale);
};

const travelTargetForPreview = (
	itemId: string | null,
	previewKind: useDropItemPreview.Result["kind"] | null,
): TileNeighbourTravelTarget | null => {
	if (itemId === null) return null;
	if (previewKind === DropItemResultKindEnumSchema.enum.Merge) {
		return {
			itemId,
			feedback: "merge",
		};
	}
	if (previewKind === DropItemResultKindEnumSchema.enum.StoreInput) {
		return {
			itemId,
			feedback: "accepted",
		};
	}
	if (previewKind === DropItemResultKindEnumSchema.enum.Reject) {
		return {
			itemId,
			feedback: "rejected",
		};
	}
	return null;
};

const targetForCandidate = (registration: TileNeighbourActorRegistration): TileDropTarget => ({
	kind: "slot",
	surface: registration.source.surface,
	slot: registration.source.slot,
	occupant: {
		id: registration.source.id,
		revision: registration.source.revision,
	},
});

/** Owns the Canvas-local geometry field and drag-only semantic candidate overlay. */
export const useTileNeighbourField = ({
	readPreview,
	readPreviewSequence,
	refreshActivePreview,
}: {
	readonly readPreview: (
		source: TileDragSource,
		target: TileDropTarget,
	) => useDropItemPreview.Result | null;
	readonly readPreviewSequence: () => number;
	readonly refreshActivePreview: () => {
		readonly sourceItemId: string;
		readonly targetItemId: string | null;
		readonly previewKind: useDropItemPreview.Result["kind"] | null;
	} | null;
}) => {
	const actors = useRef(new Map<string, TileNeighbourActorRegistration>());
	const movers = useRef(new Map<string, TileNeighbourMover>());
	const targetByMover = useRef(new Map<string, TileNeighbourTravelTarget>());
	const semanticSourceByMover = useRef(new Map<string, TileDragSource>());
	const candidateKindByMover = useRef(
		new Map<string, ReadonlyMap<string, TileNeighbourCandidateKind>>(),
	);
	const poseFollowersByActor = useRef(new Map<string, Set<TileActorPoseFollower>>());
	const pendingMissingPoseByActor = useRef(new Map<string, symbol>());
	const nextMoverGeneration = useRef(0);
	const previewSequence = useRef<number | null>(null);
	const scheduledFrame = useRef<{
		readonly kind: "animation-frame" | "timeout";
		readonly handle: number;
	} | null>(null);
	const scheduleFrameRef = useRef<() => void>(() => undefined);

	const reset = useCallback((registration: TileNeighbourActorRegistration) => {
		registration.x.set(0);
		registration.y.set(0);
		registration.scale.set(1);
	}, []);

	const cancelScheduledFrame = useCallback(() => {
		const scheduled = scheduledFrame.current;
		if (scheduled === null) return;
		scheduledFrame.current = null;
		if (scheduled.kind === "animation-frame") {
			cancelAnimationFrame(scheduled.handle);
			return;
		}
		clearTimeout(scheduled.handle);
	}, []);

	const readStableActorRect = useCallback((registration: TileNeighbourActorRegistration) => {
		const firstChild = registration.node.firstElementChild;
		const visualBody =
			firstChild instanceof HTMLElement && firstChild.dataset.ui === "TileMotionCueVisual"
				? firstChild
				: registration.node;
		const bounds = visualBody.getBoundingClientRect();
		if (bounds.width <= 0 || bounds.height <= 0) return null;
		return translatedRect(
			bounds,
			registration.appliedX.get(),
			registration.appliedY.get(),
			registration.appliedScale.get(),
		);
	}, []);

	const readRenderedActorPose = useCallback(
		(registration: TileNeighbourActorRegistration): TileActorPose | null => {
			if (
				!registration.enabled ||
				registration.node.dataset.live !== "true" ||
				registration.node.dataset.motionExiting === "true"
			) {
				return null;
			}
			const firstChild = registration.node.firstElementChild;
			const visualBody =
				firstChild instanceof HTMLElement && firstChild.dataset.ui === "TileMotionCueVisual"
					? firstChild
					: registration.node;
			const bounds = visualBody.getBoundingClientRect();
			if (bounds.width <= 0 || bounds.height <= 0) return null;
			return {
				bounds,
				source: registration.source,
			};
		},
		[],
	);

	const publishActorPose = useCallback(
		(itemId: string) => {
			const followers = poseFollowersByActor.current.get(itemId);
			if (followers === undefined) return;
			const registration = actors.current.get(itemId);
			if (registration === undefined && pendingMissingPoseByActor.current.has(itemId)) return;
			let pose: TileActorPose | null = null;
			try {
				pose = registration === undefined ? null : readRenderedActorPose(registration);
			} catch (error) {
				console.error(
					"Tile actor pose measurement failed; using its terminal fallback.",
					error,
				);
			}
			for (const follower of followers) {
				try {
					follower.listener(pose);
				} catch (error) {
					console.error("Tile actor pose follower failed; ignoring this frame.", error);
				}
			}
		},
		[
			readRenderedActorPose,
		],
	);

	const publishActorPoses = useCallback(() => {
		for (const itemId of poseFollowersByActor.current.keys()) publishActorPose(itemId);
	}, [
		publishActorPose,
	]);

	const recomputeSemanticCandidates = useCallback(
		(itemId: string) => {
			const source = semanticSourceByMover.current.get(itemId);
			if (source === undefined) {
				candidateKindByMover.current.delete(itemId);
				return;
			}
			const candidates = new Map<string, TileNeighbourCandidateKind>();
			for (const registration of actors.current.values()) {
				if (
					registration.itemId === itemId ||
					registration.source.surface.id !== source.surface.id ||
					registration.node.dataset.live !== "true" ||
					registration.node.dataset.motionExiting === "true"
				) {
					continue;
				}
				let preview: useDropItemPreview.Result | null = null;
				try {
					preview = readPreview(source, targetForCandidate(registration));
				} catch (error) {
					console.error(
						"Tile neighbour candidate preview failed; treating it as incompatible.",
						error,
					);
				}
				const candidateKind =
					preview?.kind === DropItemResultKindEnumSchema.enum.Merge
						? "merge"
						: preview?.kind === DropItemResultKindEnumSchema.enum.StoreInput
							? "accepted"
							: preview?.kind === DropItemResultKindEnumSchema.enum.Reject
								? "rejected"
								: "incompatible";
				candidates.set(registration.itemId, candidateKind);
			}
			candidateKindByMover.current.set(itemId, candidates);
		},
		[
			readPreview,
		],
	);

	const recomputeAllSemanticCandidates = useCallback(() => {
		for (const itemId of semanticSourceByMover.current.keys()) {
			recomputeSemanticCandidates(itemId);
		}
	}, [
		recomputeSemanticCandidates,
	]);

	const refreshSemanticCandidates = useCallback(() => {
		if (semanticSourceByMover.current.size === 0) return;
		const currentSequence = readPreviewSequence();
		if (previewSequence.current === currentSequence) return;
		previewSequence.current = currentSequence;
		const activePreview = refreshActivePreview();
		if (
			activePreview !== null &&
			semanticSourceByMover.current.has(activePreview.sourceItemId)
		) {
			const target = travelTargetForPreview(
				activePreview.targetItemId,
				activePreview.previewKind,
			);
			if (target === null) {
				targetByMover.current.delete(activePreview.sourceItemId);
			} else {
				targetByMover.current.set(activePreview.sourceItemId, target);
			}
		}
		recomputeAllSemanticCandidates();
	}, [
		readPreviewSequence,
		recomputeAllSemanticCandidates,
		refreshActivePreview,
	]);

	const refreshNeighbourFieldRef = useRef<() => void>(() => undefined);

	const scheduleOrphanedTargetCleanup = useCallback(
		(itemId: string, target: TileNeighbourTravelTarget) => {
			queueMicrotask(() => {
				if (
					targetByMover.current.get(itemId) !== target ||
					movers.current.has(itemId) ||
					semanticSourceByMover.current.has(itemId)
				) {
					return;
				}
				targetByMover.current.delete(itemId);
				refreshNeighbourFieldRef.current();
			});
		},
		[],
	);

	const refreshNeighbourField = useCallback(() => {
		try {
			refreshSemanticCandidates();
			publishActorPoses();
			const moverIds = new Set(movers.current.keys());
			const liveMovers: Array<{
				readonly itemId: string;
				readonly surfaceId: string;
				readonly bounds: DOMRect;
				readonly semantic: boolean;
				readonly candidateKinds: ReadonlyMap<string, TileNeighbourCandidateKind>;
				readonly target: TileNeighbourTravelTarget | null;
			}> = [];

			for (const itemId of moverIds) {
				const registration = actors.current.get(itemId);
				if (
					registration === undefined ||
					!registration.enabled ||
					registration.node.dataset.motionExiting === "true"
				) {
					continue;
				}
				const surfaceId = registration.node.dataset.surfaceId;
				const bounds = readStableActorRect(registration);
				if (surfaceId === undefined || bounds === null) continue;
				liveMovers.push({
					itemId,
					surfaceId,
					bounds,
					semantic: semanticSourceByMover.current.has(itemId),
					candidateKinds: candidateKindByMover.current.get(itemId) ?? new Map(),
					target: targetByMover.current.get(itemId) ?? null,
				});
			}
			if (liveMovers.length === 0) {
				for (const registration of actors.current.values()) reset(registration);
				return;
			}

			const directTargets = new Map<
				string,
				{
					readonly feedback: TileNeighbourTravelTarget["feedback"];
					readonly movers: ReadonlyArray<(typeof liveMovers)[number]>;
				}
			>();
			for (const mover of liveMovers) {
				if (mover.target === null) continue;
				const previous = directTargets.get(mover.target.itemId);
				const feedback =
					previous?.feedback === "accepted" || mover.target.feedback === "accepted"
						? "accepted"
						: previous?.feedback === "merge" || mover.target.feedback === "merge"
							? "merge"
							: "rejected";
				directTargets.set(mover.target.itemId, {
					feedback,
					movers: [
						...(previous?.movers ?? []),
						mover,
					],
				});
			}

			for (const registration of actors.current.values()) {
				if (
					!registration.enabled ||
					registration.node.dataset.live !== "true" ||
					registration.node.dataset.motionExiting === "true"
				) {
					reset(registration);
					continue;
				}

				const surfaceId = registration.node.dataset.surfaceId;
				const bounds = readStableActorRect(registration);
				if (surfaceId === undefined || bounds === null) {
					reset(registration);
					continue;
				}

				const centerX = bounds.left + bounds.width / 2;
				const centerY = bounds.top + bounds.height / 2;
				const neighbourSize = Math.max(bounds.width, bounds.height);
				const directTarget = directTargets.get(registration.itemId);
				if (directTarget !== undefined) {
					registration.x.set(0);
					registration.y.set(0);
					let targetScale: number | null = null;
					if (directTarget.feedback === "accepted") {
						for (const mover of directTarget.movers) {
							if (mover.semantic || mover.surfaceId !== surfaceId) continue;
							const sourceCenterX = mover.bounds.left + mover.bounds.width / 2;
							const sourceCenterY = mover.bounds.top + mover.bounds.height / 2;
							const distance = Math.hypot(
								centerX - sourceCenterX,
								centerY - sourceCenterY,
							);
							const sourceSize = Math.max(mover.bounds.width, mover.bounds.height);
							const radius = Math.max(48, Math.max(sourceSize, neighbourSize) * 1.25);
							if (distance >= radius) continue;
							const progress = 1 - distance / radius;
							targetScale = Math.max(
								targetScale ?? TileActorBaseScale,
								TileActorBaseScale +
									progress * (acceptingTargetScaleLimit - TileActorBaseScale),
							);
						}
					}
					registration.scale.set(
						targetScale === null
							? 1
							: scaleMultiplierForAbsoluteTarget(registration, bounds, targetScale),
					);
					continue;
				}

				let displacementX = 0;
				let displacementY = 0;
				let compatibilityScale = TileActorBaseScale;
				for (const mover of liveMovers) {
					if (mover.itemId === registration.itemId || mover.surfaceId !== surfaceId) {
						continue;
					}
					const sourceCenterX = mover.bounds.left + mover.bounds.width / 2;
					const sourceCenterY = mover.bounds.top + mover.bounds.height / 2;
					const deltaX = centerX - sourceCenterX;
					const deltaY = centerY - sourceCenterY;
					const distance = Math.hypot(deltaX, deltaY);
					const sourceSize = Math.max(mover.bounds.width, mover.bounds.height);
					const ordinaryRadius = Math.max(96, Math.max(sourceSize, neighbourSize) * 2.25);
					const candidateKind = mover.semantic
						? mover.candidateKinds.get(registration.itemId)
						: undefined;
					if (candidateKind === "accepted" || candidateKind === "merge") {
						const compatibilityRadius = Math.max(
							120,
							Math.max(sourceSize, neighbourSize) * 2.75,
						);
						if (distance < compatibilityRadius) {
							const progress = 1 - distance / compatibilityRadius;
							compatibilityScale = Math.max(
								compatibilityScale,
								TileActorBaseScale +
									progress * (acceptedCandidateScaleLimit - TileActorBaseScale),
							);
						}
						continue;
					}
					if (distance === 0 || distance >= ordinaryRadius) continue;
					const maximum = Math.min(16, neighbourSize * 0.16);
					const semanticMultiplier =
						candidateKind === "incompatible" || candidateKind === "rejected" ? 1.3 : 1;
					const strength = (1 - distance / ordinaryRadius) * maximum * semanticMultiplier;
					displacementX += (deltaX / distance) * strength;
					displacementY += (deltaY / distance) * strength;
				}

				const magnitude = Math.hypot(displacementX, displacementY);
				if (magnitude > combinedDisplacementLimit) {
					const multiplier = combinedDisplacementLimit / magnitude;
					displacementX *= multiplier;
					displacementY *= multiplier;
				}
				registration.x.set(displacementX);
				registration.y.set(displacementY);
				registration.scale.set(
					scaleMultiplierForAbsoluteTarget(registration, bounds, compatibilityScale),
				);
			}
		} catch (error) {
			console.error("Tile neighbour measurement failed; clearing displacement.", error);
			movers.current.clear();
			targetByMover.current.clear();
			semanticSourceByMover.current.clear();
			candidateKindByMover.current.clear();
			for (const registration of actors.current.values()) reset(registration);
		}
	}, [
		publishActorPoses,
		readStableActorRect,
		refreshSemanticCandidates,
		reset,
	]);
	refreshNeighbourFieldRef.current = refreshNeighbourField;

	const scheduleNeighbourFrame = useCallback(() => {
		if (
			scheduledFrame.current !== null ||
			(movers.current.size === 0 &&
				semanticSourceByMover.current.size === 0 &&
				poseFollowersByActor.current.size === 0)
		) {
			return;
		}
		const run = () => {
			scheduledFrame.current = null;
			refreshNeighbourField();
			scheduleFrameRef.current();
		};
		if (typeof requestAnimationFrame === "function") {
			scheduledFrame.current = {
				kind: "animation-frame",
				handle: requestAnimationFrame(run),
			};
			return;
		}
		scheduledFrame.current = {
			kind: "timeout",
			handle: setTimeout(run, 16) as unknown as number,
		};
	}, [
		refreshNeighbourField,
	]);
	scheduleFrameRef.current = scheduleNeighbourFrame;

	const clearNeighbourField = useCallback(() => {
		cancelScheduledFrame();
		poseFollowersByActor.current.clear();
		pendingMissingPoseByActor.current.clear();
		movers.current.clear();
		targetByMover.current.clear();
		semanticSourceByMover.current.clear();
		candidateKindByMover.current.clear();
		for (const registration of actors.current.values()) reset(registration);
	}, [
		cancelScheduledFrame,
		reset,
	]);

	const registerNeighbourActor = useCallback(
		(registration: TileNeighbourActorRegistration) => {
			const previous = actors.current.get(registration.itemId);
			if (previous !== undefined && previous !== registration) reset(previous);
			actors.current.set(registration.itemId, registration);
			pendingMissingPoseByActor.current.delete(registration.itemId);
			publishActorPose(registration.itemId);
			recomputeAllSemanticCandidates();
			if (movers.current.size > 0 || poseFollowersByActor.current.size > 0) {
				refreshNeighbourField();
				scheduleNeighbourFrame();
			}
			return () => {
				if (actors.current.get(registration.itemId) !== registration) return;
				reset(registration);
				const missingToken = Symbol("tile-actor-missing-pose");
				pendingMissingPoseByActor.current.set(registration.itemId, missingToken);
				actors.current.delete(registration.itemId);
				recomputeAllSemanticCandidates();
				refreshNeighbourField();
				queueMicrotask(() => {
					if (
						pendingMissingPoseByActor.current.get(registration.itemId) !== missingToken
					) {
						return;
					}
					pendingMissingPoseByActor.current.delete(registration.itemId);
					if (actors.current.has(registration.itemId)) return;
					refreshNeighbourField();
				});
			};
		},
		[
			publishActorPose,
			recomputeAllSemanticCandidates,
			refreshNeighbourField,
			reset,
			scheduleNeighbourFrame,
		],
	);

	const updateNeighbourActor = useCallback(
		({
			itemId,
			source,
			enabled,
		}: {
			readonly itemId: string;
			readonly source: TileDragSource;
			readonly enabled: boolean;
		}) => {
			const registration = actors.current.get(itemId);
			if (registration === undefined) return;
			registration.source = source;
			registration.enabled = enabled;
			if (!enabled) reset(registration);
			publishActorPose(itemId);
			recomputeAllSemanticCandidates();
			refreshNeighbourField();
			if (
				enabled &&
				(movers.current.size > 0 ||
					semanticSourceByMover.current.size > 0 ||
					poseFollowersByActor.current.size > 0)
			) {
				scheduleNeighbourFrame();
			}
		},
		[
			publishActorPose,
			recomputeAllSemanticCandidates,
			refreshNeighbourField,
			reset,
			scheduleNeighbourFrame,
		],
	);

	const readActorRect = useCallback((itemId: string) => {
		const registration = actors.current.get(itemId);
		if (registration === undefined) return null;
		try {
			const bounds = registration.node.getBoundingClientRect();
			return bounds.width <= 0 || bounds.height <= 0 ? null : bounds;
		} catch (error) {
			console.error("Tile actor measurement failed; skipping delivery origin.", error);
			return null;
		}
	}, []);

	const readActorSource = useCallback(
		(itemId: string) => actors.current.get(itemId)?.source ?? null,
		[],
	);

	const followActorPose = useCallback(
		(itemId: string, listener: (pose: TileActorPose | null) => void) => {
			const follower = {
				listener,
			};
			const followers =
				poseFollowersByActor.current.get(itemId) ?? new Set<TileActorPoseFollower>();
			followers.add(follower);
			poseFollowersByActor.current.set(itemId, followers);
			publishActorPose(itemId);
			scheduleNeighbourFrame();
			let active = true;
			return () => {
				if (!active) return;
				active = false;
				const current = poseFollowersByActor.current.get(itemId);
				if (current === undefined || !current.delete(follower)) return;
				if (current.size === 0) poseFollowersByActor.current.delete(itemId);
				if (
					movers.current.size === 0 &&
					semanticSourceByMover.current.size === 0 &&
					poseFollowersByActor.current.size === 0
				) {
					cancelScheduledFrame();
				}
			};
		},
		[
			cancelScheduledFrame,
			publishActorPose,
			scheduleNeighbourFrame,
		],
	);

	const beginNeighbourTravel = useCallback(
		(itemId: string) => {
			const mover = {
				generation: ++nextMoverGeneration.current,
			};
			movers.current.set(itemId, mover);
			refreshNeighbourField();
			scheduleNeighbourFrame();
			let active = true;
			return () => {
				if (!active) return;
				active = false;
				if (movers.current.get(itemId) !== mover) return;
				movers.current.delete(itemId);
				const target = targetByMover.current.get(itemId);
				if (target !== undefined) scheduleOrphanedTargetCleanup(itemId, target);
				refreshNeighbourField();
				if (
					movers.current.size === 0 &&
					semanticSourceByMover.current.size === 0 &&
					poseFollowersByActor.current.size === 0
				) {
					cancelScheduledFrame();
				}
			};
		},
		[
			cancelScheduledFrame,
			refreshNeighbourField,
			scheduleNeighbourFrame,
			scheduleOrphanedTargetCleanup,
		],
	);

	const setNeighbourTravelTarget = useCallback(
		(itemId: string, target: TileNeighbourTravelTarget | null) => {
			if (target === null) {
				targetByMover.current.delete(itemId);
				refreshNeighbourField();
				return () => undefined;
			}
			targetByMover.current.set(itemId, target);
			refreshNeighbourField();
			scheduleOrphanedTargetCleanup(itemId, target);
			return () => {
				if (targetByMover.current.get(itemId) !== target) return;
				targetByMover.current.delete(itemId);
				refreshNeighbourField();
			};
		},
		[
			refreshNeighbourField,
			scheduleOrphanedTargetCleanup,
		],
	);

	const setNeighbourSemanticSource = useCallback(
		(itemId: string, source: TileDragSource | null) => {
			if (source !== null && actors.current.get(itemId)?.enabled === false) {
				semanticSourceByMover.current.delete(itemId);
				candidateKindByMover.current.delete(itemId);
				refreshNeighbourField();
				if (movers.current.size === 0 && poseFollowersByActor.current.size === 0) {
					cancelScheduledFrame();
				}
				return;
			}
			if (source === null) {
				semanticSourceByMover.current.delete(itemId);
				candidateKindByMover.current.delete(itemId);
				const target = targetByMover.current.get(itemId);
				if (target !== undefined) scheduleOrphanedTargetCleanup(itemId, target);
			} else {
				semanticSourceByMover.current.set(itemId, source);
				previewSequence.current = readPreviewSequence();
				recomputeSemanticCandidates(itemId);
			}
			refreshNeighbourField();
			if (source !== null) {
				scheduleNeighbourFrame();
			} else if (
				movers.current.size === 0 &&
				semanticSourceByMover.current.size === 0 &&
				poseFollowersByActor.current.size === 0
			) {
				cancelScheduledFrame();
			}
		},
		[
			cancelScheduledFrame,
			readPreviewSequence,
			recomputeSemanticCandidates,
			refreshNeighbourField,
			scheduleNeighbourFrame,
			scheduleOrphanedTargetCleanup,
		],
	);

	useEffect(
		() => () => {
			clearNeighbourField();
			actors.current.clear();
		},
		[
			clearNeighbourField,
		],
	);

	return {
		readActorRect,
		readActorSource,
		followActorPose,
		registerNeighbourActor,
		updateNeighbourActor,
		beginNeighbourTravel,
		setNeighbourTravelTarget,
		setNeighbourSemanticSource,
		refreshNeighbourField,
		clearNeighbourField,
	};
};
