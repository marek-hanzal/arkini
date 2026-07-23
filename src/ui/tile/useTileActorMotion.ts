import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";
import { readTileDeliveryOriginOffset } from "~/ui/tile/readTileDeliveryOriginOffset";
import { readTileDeliveryTiming } from "~/ui/tile/readTileDeliveryTiming";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { useTileActorCueGeometry } from "~/ui/tile/useTileActorCueGeometry";
import { useTileActorMotionCompletion } from "~/ui/tile/useTileActorMotionCompletion";
import { useTileActorNeighbourMotion } from "~/ui/tile/useTileActorNeighbourMotion";
import { useTileActorPointerMotion } from "~/ui/tile/useTileActorPointerMotion";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const settleTransition = {
	type: "spring" as const,
	stiffness: 200,
	damping: 24,
	mass: 0.68,
};

interface ResolvedSpatialTarget {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly destination: TileDragSource;
	readonly positionCompletion: useTileActorPresentation.PositionCompletion;
	readonly reducedMotion: boolean;
}

interface ActiveSpatialMotion {
	readonly generation: number;
	readonly animations: ReadonlyArray<ReturnType<typeof animate>>;
	readonly spawnDeliveryGeneration: number | null;
	releaseTravel: (() => void) | null;
}

interface SpawnDeliveryState {
	readonly generation: number;
	readonly timing: readTileDeliveryTiming.Result | null;
	readonly ready: boolean;
}

const isSameDestination = (left: TileDragSource, right: TileDragSource) =>
	left.surface.id === right.surface.id &&
	left.slot.id === right.slot.id &&
	isSameTileLocation(left.location, right.location);

const isSamePositionCompletion = (
	left: useTileActorPresentation.PositionCompletion,
	right: useTileActorPresentation.PositionCompletion,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "none" || right.kind === "none") return true;
	if (left.generation !== right.generation) return false;
	if (left.kind === "always" || right.kind === "always") return true;
	return isSameTileLocation(left.location, right.location);
};

const isSameSpatialTarget = (left: ResolvedSpatialTarget, right: ResolvedSpatialTarget) =>
	left.x === right.x &&
	left.y === right.y &&
	left.width === right.width &&
	left.height === right.height &&
	left.reducedMotion === right.reducedMotion &&
	isSameDestination(left.destination, right.destination) &&
	isSamePositionCompletion(left.positionCompletion, right.positionCompletion);

const isSameSpatialIntent = (
	target: ResolvedSpatialTarget,
	destination: TileDragSource,
	positionCompletion: useTileActorPresentation.PositionCompletion,
	reducedMotion: boolean,
) =>
	target.reducedMotion === reducedMotion &&
	isSameDestination(target.destination, destination) &&
	isSamePositionCompletion(target.positionCompletion, positionCompletion);

/** Owns actor measurement, Motion values, retargeting, generations, and cleanup. */
export const useTileActorMotion = ({
	item,
	presentation,
	cue,
}: {
	readonly item: useTileActors.Item;
	readonly presentation: useTileActorPresentation.Model;
	readonly cue: TileMotionCueSchema.Type | null;
}) => {
	const {
		geometryVersion,
		readActorLayerRect,
		readActorRect,
		readPlacement,
		complete,
		setNeighbourTravelTarget,
	} = useTileActorSystem();
	const reducedMotion = useReducedMotion();
	const anchorX = useMotionValue(0);
	const anchorY = useMotionValue(0);
	const settleX = useMotionValue(0);
	const settleY = useMotionValue(0);
	const pointer = useTileActorPointerMotion();
	const width = useMotionValue(0);
	const height = useMotionValue(0);
	const [visible, setVisible] = useState(false);
	const [spawnDeliveryState, setSpawnDeliveryState] = useState<SpawnDeliveryState | null>(null);
	const [spatialMotionSettledVersion, setSpatialMotionSettledVersion] = useState(0);
	const spawnDeliveryStateRef = useRef<SpawnDeliveryState | null>(null);
	const neighbour = useTileActorNeighbourMotion({
		itemId: item.id,
		source: presentation.canonicalSource,
		visible,
		canonicalWidth: width,
		canonicalHeight: height,
	});
	const retainNeighbourTravel = neighbour.retainTravel;
	const cueGeometry = useTileActorCueGeometry({
		itemId: item.id,
		placementSource: presentation.desiredSource,
		cue,
	});
	const initialized = useRef(false);
	const localMotionGeneration = useRef(0);
	const resolvedSpatialTarget = useRef<ResolvedSpatialTarget | null>(null);
	const activeSpatialMotion = useRef<ActiveSpatialMotion | null>(null);
	const cueRef = useRef(cue);
	cueRef.current = cue;
	const releaseSnapshot = useRef<useTileActorPointerMotion.ReleaseSnapshot | null>(null);

	const releasePointer = useCallback(
		(interactionGeneration: number) => {
			const snapshot = pointer.commands.release(interactionGeneration);
			releaseSnapshot.current = snapshot;
			settleX.jump(settleX.get() + snapshot.handoffOffset.x);
			settleY.jump(settleY.get() + snapshot.handoffOffset.y);
			pointer.commands.resetAfterHandoff(snapshot.pointerGeneration);
			return snapshot;
		},
		[
			pointer.commands,
			settleX,
			settleY,
		],
	);

	const pointerCommands = useMemo<useTileActorPointerMotion.Control>(
		() => ({
			...pointer.commands,
			release: releasePointer,
		}),
		[
			pointer.commands,
			releasePointer,
		],
	);

	const readDeliveryOriginOffset = useCallback(
		(placement: NonNullable<ReturnType<typeof readPlacement>>) => {
			const currentCue = cueRef.current;
			if (
				reducedMotion ||
				currentCue?.originItemId === undefined ||
				currentCue.originItemId === item.id
			) {
				return null;
			}
			const layerRect = readActorLayerRect();
			const originRect = readActorRect(currentCue.originItemId);
			if (layerRect === null || originRect === null) return null;
			return readTileDeliveryOriginOffset({
				actorLayerRect: layerRect,
				originRect,
				targetPlacement: placement,
				originAnchor:
					currentCue.producerEmissionId === undefined ||
					currentCue.emissionFromCollapse === true
						? "center"
						: "directional-edge",
			});
		},
		[
			item.id,
			readActorLayerRect,
			readActorRect,
			reducedMotion,
		],
	);

	const { completePosition, onVisualAnimationComplete } = useTileActorMotionCompletion({
		item,
		positionCompletion: presentation.positionCompletion,
		visualCompletionGeneration: presentation.visualCompletionGeneration,
		complete,
	});

	const stopActiveSpatialMotion = useCallback(() => {
		const active = activeSpatialMotion.current;
		if (active === null) return;
		activeSpatialMotion.current = null;
		for (const animation of active.animations) animation.stop();
		active.releaseTravel?.();
		active.releaseTravel = null;
	}, []);

	const publishSpawnDeliveryState = useCallback((next: SpawnDeliveryState) => {
		spawnDeliveryStateRef.current = next;
		setSpawnDeliveryState(next);
	}, []);

	const armSpawnDelivery = useCallback(
		(spawnGeneration: number, motionGeneration: number) => {
			if (localMotionGeneration.current !== motionGeneration) return;
			const current = spawnDeliveryStateRef.current;
			if (current === null || current.generation !== spawnGeneration || current.ready) {
				return;
			}
			publishSpawnDeliveryState({
				...current,
				ready: true,
			});
		},
		[
			publishSpawnDeliveryState,
		],
	);

	const armPendingSpawnDelivery = useCallback(() => {
		const current = spawnDeliveryStateRef.current;
		if (current === null || current.ready) return;
		publishSpawnDeliveryState({
			...current,
			ready: true,
		});
	}, [
		publishSpawnDeliveryState,
	]);

	useLayoutEffect(() => {
		void geometryVersion;
		if (presentation.placementFrozen) return;
		const preserveOnlyCurrentIntent = () => {
			const previousTarget = resolvedSpatialTarget.current;
			if (
				previousTarget === null ||
				isSameSpatialIntent(
					previousTarget,
					presentation.desiredSource,
					presentation.positionCompletion,
					reducedMotion === true,
				)
			) {
				return;
			}
			resolvedSpatialTarget.current = null;
			localMotionGeneration.current += 1;
			stopActiveSpatialMotion();
		};
		let placement: ReturnType<typeof readPlacement>;
		try {
			placement = readPlacement(presentation.desiredSource);
		} catch (error) {
			console.error(
				"Tile placement measurement failed; keeping its last stable pose.",
				error,
			);
			preserveOnlyCurrentIntent();
			setVisible(initialized.current);
			completePosition();
			return;
		}
		const ownsSettlementMotion =
			presentation.positionCompletion.kind !== "none" ||
			!isSameDestination(presentation.desiredSource, presentation.canonicalSource);
		if (placement === null) {
			preserveOnlyCurrentIntent();
			if (!ownsSettlementMotion && presentation.phase !== "targeted") setVisible(false);
			completePosition();
			return;
		}

		const target: ResolvedSpatialTarget = {
			...placement,
			destination: presentation.desiredSource,
			positionCompletion: presentation.positionCompletion,
			reducedMotion: reducedMotion === true,
		};
		const previousTarget = resolvedSpatialTarget.current;
		if (previousTarget !== null && isSameSpatialTarget(previousTarget, target)) return;
		resolvedSpatialTarget.current = target;
		stopActiveSpatialMotion();
		const generation = ++localMotionGeneration.current;
		const currentCue = cueRef.current;
		const awaitsProducerRelease =
			currentCue?.kind === "spawn" &&
			currentCue.producerEmissionId !== undefined &&
			currentCue.producerEmissionReleased !== true;
		if (awaitsProducerRelease) {
			const deliveryOffset = readDeliveryOriginOffset(placement);
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			settleX.jump(deliveryOffset?.x ?? 0);
			settleY.jump(deliveryOffset?.y ?? 0);
			width.jump(placement.width);
			height.jump(placement.height);
			initialized.current = true;
			setVisible(true);
			completePosition();
			publishSpawnDeliveryState({
				generation: currentCue.generation,
				timing: null,
				ready: false,
			});
			return;
		}
		if (!initialized.current) {
			const spawnGeneration = currentCue?.kind === "spawn" ? currentCue.generation : null;
			const deliveryOffset =
				currentCue?.kind === "spawn" ? readDeliveryOriginOffset(placement) : null;
			const ownsSpawnDelivery =
				spawnGeneration !== null &&
				deliveryOffset !== null &&
				!reducedMotion &&
				Math.hypot(deliveryOffset.x, deliveryOffset.y) >= 0.5;
			const releaseTravel = ownsSpawnDelivery ? retainNeighbourTravel() : null;
			const deliveryTiming =
				!ownsSpawnDelivery || deliveryOffset === null
					? null
					: readTileDeliveryTiming({
							offset: deliveryOffset,
						});
			if (spawnGeneration !== null) {
				publishSpawnDeliveryState({
					generation: spawnGeneration,
					timing: deliveryTiming,
					ready: !ownsSpawnDelivery,
				});
			}
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			settleX.jump(ownsSpawnDelivery ? deliveryOffset.x : 0);
			settleY.jump(ownsSpawnDelivery ? deliveryOffset.y : 0);
			width.jump(placement.width);
			height.jump(placement.height);
			initialized.current = true;
			setVisible(true);
			completePosition();
			if (
				!ownsSpawnDelivery ||
				deliveryOffset === null ||
				deliveryTiming === null ||
				spawnGeneration === null
			) {
				settleX.jump(0);
				settleY.jump(0);
				releaseTravel?.();
				return;
			}
			const animations = [
				animate(settleX, 0, {
					type: "tween",
					duration: deliveryTiming?.travelDuration ?? 0.9,
					ease: deliveryTiming?.ease ?? [
						0.22,
						1,
						0.36,
						1,
					],
				}),
				animate(settleY, 0, {
					type: "tween",
					duration: deliveryTiming?.travelDuration ?? 0.9,
					ease: deliveryTiming?.ease ?? [
						0.22,
						1,
						0.36,
						1,
					],
				}),
			];
			const active: ActiveSpatialMotion = {
				generation,
				animations,
				spawnDeliveryGeneration: spawnGeneration,
				releaseTravel,
			};
			activeSpatialMotion.current = active;
			void Promise.all(animations)
				.then(() => {
					armSpawnDelivery(spawnGeneration, generation);
				})
				.catch((error: unknown) => {
					if (localMotionGeneration.current !== generation) return;
					console.error("Tile actor delivery motion failed; converging locally.", error);
					settleX.jump(0);
					settleY.jump(0);
					armSpawnDelivery(spawnGeneration, generation);
				})
				.finally(() => {
					active.releaseTravel?.();
					active.releaseTravel = null;
					if (activeSpatialMotion.current === active) {
						activeSpatialMotion.current = null;
						setSpatialMotionSettledVersion((current) => current + 1);
					}
				});
			return;
		}

		setVisible(true);
		if (reducedMotion) {
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			releaseSnapshot.current = null;
			settleX.jump(0);
			settleY.jump(0);
			width.jump(placement.width);
			height.jump(placement.height);
			completePosition();
			armPendingSpawnDelivery();
			return;
		}
		const animations: Array<ReturnType<typeof animate>> = [];
		let releaseTravel: (() => void) | null = null;
		const pendingSpawnDelivery = spawnDeliveryStateRef.current;
		if (ownsSettlementMotion) {
			const currentVisualX = anchorX.get() + settleX.get();
			const currentVisualY = anchorY.get() + settleY.get();
			if (Math.hypot(currentVisualX - placement.x, currentVisualY - placement.y) >= 0.5) {
				releaseTravel = retainNeighbourTravel();
			}
			const settlementGeneration =
				presentation.positionCompletion.kind === "none"
					? null
					: presentation.positionCompletion.generation;
			const snapshot =
				releaseSnapshot.current?.interactionGeneration === settlementGeneration
					? releaseSnapshot.current
					: null;
			if (snapshot !== null) releaseSnapshot.current = null;
			const velocityX = reducedMotion
				? 0
				: (snapshot?.settlementVelocity.x ?? settleX.getVelocity());
			const velocityY = reducedMotion
				? 0
				: (snapshot?.settlementVelocity.y ?? settleY.getVelocity());
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			settleX.jump(currentVisualX - placement.x);
			settleY.jump(currentVisualY - placement.y);
			animations.push(
				animate(settleX, 0, {
					...settleTransition,
					velocity: velocityX,
				}),
				animate(settleY, 0, {
					...settleTransition,
					velocity: velocityY,
				}),
			);
		} else {
			if (Math.hypot(anchorX.get() - placement.x, anchorY.get() - placement.y) >= 0.5) {
				releaseTravel = retainNeighbourTravel();
			}
			animations.push(
				animate(anchorX, placement.x, settleTransition),
				animate(anchorY, placement.y, settleTransition),
				animate(settleX, 0, settleTransition),
				animate(settleY, 0, settleTransition),
			);
		}
		animations.push(
			animate(width, placement.width, settleTransition),
			animate(height, placement.height, settleTransition),
		);
		const active: ActiveSpatialMotion = {
			generation,
			animations,
			spawnDeliveryGeneration:
				pendingSpawnDelivery?.ready === false && pendingSpawnDelivery.timing !== null
					? pendingSpawnDelivery.generation
					: null,
			releaseTravel,
		};
		activeSpatialMotion.current = active;
		void Promise.all(animations)
			.then(() => {
				if (localMotionGeneration.current !== generation) return;
				completePosition();
				if (active.spawnDeliveryGeneration !== null) {
					armSpawnDelivery(active.spawnDeliveryGeneration, generation);
				}
			})
			.catch((error: unknown) => {
				if (localMotionGeneration.current !== generation) return;
				console.error("Tile actor motion failed; converging to its live placement.", error);
				anchorX.jump(placement.x);
				anchorY.jump(placement.y);
				releaseSnapshot.current = null;
				settleX.jump(0);
				settleY.jump(0);
				width.jump(placement.width);
				height.jump(placement.height);
				setVisible(true);
				completePosition();
				if (active.spawnDeliveryGeneration !== null) {
					armSpawnDelivery(active.spawnDeliveryGeneration, generation);
				}
			})
			.finally(() => {
				active.releaseTravel?.();
				active.releaseTravel = null;
				if (activeSpatialMotion.current === active) {
					activeSpatialMotion.current = null;
					setSpatialMotionSettledVersion((current) => current + 1);
				}
			});
	}, [
		anchorX,
		anchorY,
		armPendingSpawnDelivery,
		armSpawnDelivery,
		completePosition,
		geometryVersion,
		height,
		presentation.canonicalSource,
		presentation.desiredSource,
		presentation.phase,
		presentation.placementFrozen,
		presentation.positionCompletion,
		readDeliveryOriginOffset,
		readPlacement,
		reducedMotion,
		retainNeighbourTravel,
		publishSpawnDeliveryState,
		settleX,
		settleY,
		stopActiveSpatialMotion,
		width,
	]);

	useLayoutEffect(() => {
		if (cue?.kind !== "spawn" || !initialized.current) return;
		if (cue.producerEmissionId !== undefined && cue.producerEmissionReleased !== true) {
			return;
		}
		const current = spawnDeliveryStateRef.current;
		if (current?.generation === cue.generation && (current.ready || current.timing !== null)) {
			return;
		}
		if (activeSpatialMotion.current !== null) {
			if (current?.generation !== cue.generation) {
				publishSpawnDeliveryState({
					generation: cue.generation,
					timing: null,
					ready: false,
				});
			}
			return;
		}
		let placement: ReturnType<typeof readPlacement>;
		try {
			placement = readPlacement(presentation.desiredSource);
		} catch {
			placement = null;
		}
		const deliveryOffset = placement === null ? null : readDeliveryOriginOffset(placement);
		if (
			deliveryOffset === null ||
			reducedMotion ||
			Math.hypot(deliveryOffset.x, deliveryOffset.y) < 0.5
		) {
			publishSpawnDeliveryState({
				generation: cue.generation,
				timing: null,
				ready: true,
			});
			return;
		}
		const timing = readTileDeliveryTiming({
			offset: deliveryOffset,
		});
		publishSpawnDeliveryState({
			generation: cue.generation,
			timing,
			ready: false,
		});
		const releaseTravel = retainNeighbourTravel();
		settleX.jump(deliveryOffset.x);
		settleY.jump(deliveryOffset.y);
		const generation = ++localMotionGeneration.current;
		const animations = [
			animate(settleX, 0, {
				type: "tween",
				duration: timing.travelDuration,
				ease: timing.ease,
			}),
			animate(settleY, 0, {
				type: "tween",
				duration: timing.travelDuration,
				ease: timing.ease,
			}),
		];
		const active: ActiveSpatialMotion = {
			generation,
			animations,
			spawnDeliveryGeneration: cue.generation,
			releaseTravel,
		};
		activeSpatialMotion.current = active;
		void Promise.all(animations)
			.then(() => {
				armSpawnDelivery(cue.generation, generation);
			})
			.catch((error: unknown) => {
				if (localMotionGeneration.current !== generation) return;
				console.error("Tile actor delivery motion failed; converging locally.", error);
				settleX.jump(0);
				settleY.jump(0);
				armSpawnDelivery(cue.generation, generation);
			})
			.finally(() => {
				active.releaseTravel?.();
				active.releaseTravel = null;
				if (activeSpatialMotion.current === active) {
					activeSpatialMotion.current = null;
					setSpatialMotionSettledVersion((version) => version + 1);
				}
			});
	}, [
		armSpawnDelivery,
		cue,
		presentation.desiredSource,
		publishSpawnDeliveryState,
		readDeliveryOriginOffset,
		readPlacement,
		reducedMotion,
		retainNeighbourTravel,
		settleX,
		settleY,
		spatialMotionSettledVersion,
	]);

	useLayoutEffect(() => {
		if (!visible || presentation.phase !== "dragging") return;
		return retainNeighbourTravel();
	}, [
		presentation.phase,
		retainNeighbourTravel,
		visible,
	]);

	useEffect(() => {
		if (
			!visible ||
			cueGeometry.targetOffset === null ||
			(cue?.kind !== "consume" && cue?.kind !== "consume-exit") ||
			(presentation.phase !== "stable" &&
				presentation.phase !== "hovered" &&
				presentation.phase !== "targeted")
		) {
			return;
		}
		const releaseTarget = setNeighbourTravelTarget(
			item.id,
			cue.targetItemId === undefined
				? null
				: {
						itemId: cue.targetItemId,
						feedback: "accepted",
					},
		);
		const releaseTravel = retainNeighbourTravel();
		return () => {
			releaseTravel();
			releaseTarget();
		};
	}, [
		cue,
		cueGeometry.targetOffset,
		item.id,
		presentation.phase,
		retainNeighbourTravel,
		setNeighbourTravelTarget,
		visible,
	]);

	useEffect(
		() => () => {
			localMotionGeneration.current += 1;
			releaseSnapshot.current = null;
			stopActiveSpatialMotion();
		},
		[
			stopActiveSpatialMotion,
		],
	);

	return {
		placement: {
			anchor: {
				x: anchorX,
				y: anchorY,
			},
			width,
			height,
			visible,
		},
		travel: {
			x: settleX,
			y: settleY,
			spawnDeliveryTiming:
				spawnDeliveryState !== null &&
				cue?.kind === "spawn" &&
				spawnDeliveryState.generation === cue.generation
					? spawnDeliveryState.timing
					: null,
			spawnDeliveryReady:
				cue?.kind !== "spawn" ||
				(spawnDeliveryState !== null &&
					spawnDeliveryState.generation === cue.generation &&
					spawnDeliveryState.ready),
		},
		pointer: {
			values: pointer.values,
			commands: pointerCommands,
		},
		neighbour: {
			registerActorNode: neighbour.registerActorNode,
			values: neighbour.values,
		},
		cueGeometry,
		completion: {
			onVisualComplete: onVisualAnimationComplete,
		},
	};
};
