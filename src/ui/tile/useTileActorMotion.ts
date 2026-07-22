import {
	animate,
	type PanInfo,
	useMotionValue,
	useReducedMotion,
	useSpring,
	useTransform,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { match } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";
import { readTileDeliveryOriginOffset } from "~/ui/tile/readTileDeliveryOriginOffset";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const settleTransition = {
	type: "spring" as const,
	stiffness: 200,
	damping: 24,
	mass: 0.68,
};

const interactionCompletionFallbackMs = 2_000;
const maximumDragLagX = 28;
const maximumDragLagY = 24;

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.max(minimum, Math.min(maximum, value));

const deliveryTransition = {
	type: "tween" as const,
	duration: 0.6,
	ease: [0.22, 1, 0.36, 1] as const,
};

const pickupTransition = {
	type: "tween" as const,
	duration: 0.2,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

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
		registerNeighbourActor,
		beginNeighbourTravel,
		setNeighbourTravelTarget,
	} = useTileActorSystem();
	const reducedMotion = useReducedMotion();
	const anchorX = useMotionValue(0);
	const anchorY = useMotionValue(0);
	const dragX = useMotionValue(0);
	const dragY = useMotionValue(0);
	const dragFollowX = useSpring(dragX, { stiffness: 245, damping: 26, mass: 0.64 });
	const dragFollowY = useSpring(dragY, { stiffness: 245, damping: 26, mass: 0.64 });
	const boundedDragX = useTransform([dragX, dragFollowX], ([target, follow]) =>
		target + clamp(follow - target, -maximumDragLagX, maximumDragLagX),
	);
	const boundedDragY = useTransform([dragY, dragFollowY], ([target, follow]) =>
		target + clamp(follow - target, -maximumDragLagY, maximumDragLagY),
	);
	const visualDragX = reducedMotion ? dragX : boundedDragX;
	const visualDragY = reducedMotion ? dragY : boundedDragY;
	const settleX = useMotionValue(0);
	const settleY = useMotionValue(0);
	const travelX = useTransform([visualDragX, settleX], ([drag, settle]) => drag + settle);
	const travelY = useTransform([visualDragY, settleY], ([drag, settle]) => drag + settle);
	const dragWeightTargetX = useMotionValue(0);
	const dragWeightTargetY = useMotionValue(0);
	const dragRotationTarget = useMotionValue(0);
	const dragWeightX = useSpring(dragWeightTargetX, { stiffness: 280, damping: 26, mass: 0.52 });
	const dragWeightY = useSpring(dragWeightTargetY, { stiffness: 280, damping: 26, mass: 0.52 });
	const dragRotation = useSpring(dragRotationTarget, { stiffness: 250, damping: 25, mass: 0.48 });
	const neighbourTargetX = useMotionValue(0);
	const neighbourTargetY = useMotionValue(0);
	const neighbourX = useSpring(neighbourTargetX, { stiffness: 170, damping: 22, mass: 0.58 });
	const neighbourY = useSpring(neighbourTargetY, { stiffness: 170, damping: 22, mass: 0.58 });
	const neighbourScaleTarget = useMotionValue(1);
	const neighbourScale = useSpring(neighbourScaleTarget, {
		stiffness: 190,
		damping: 23,
		mass: 0.56,
	});
	const pickupX = useMotionValue(0);
	const pickupY = useMotionValue(0);
	const width = useMotionValue(0);
	const height = useMotionValue(0);
	const initialized = useRef(false);
	const localMotionGeneration = useRef(0);
	const pickupTarget = useRef({
		x: 0,
		y: 0,
	});
	const pickupAnimationX = useRef<ReturnType<typeof animate> | null>(null);
	const pickupAnimationY = useRef<ReturnType<typeof animate> | null>(null);
	const itemRef = useRef(item);
	const unregisterNeighbourActor = useRef<(() => void) | null>(null);
	const neighbourTravelOwners = useRef(0);
	const stopNeighbourTravel = useRef<(() => void) | null>(null);
	const [visible, setVisible] = useState(false);
	const [cueOriginOffset, setCueOriginOffset] = useState<{
		readonly generation: number;
		readonly x: number;
		readonly y: number;
	} | null>(null);
	const [cueTargetOffset, setCueTargetOffset] = useState<{
		readonly generation: number;
		readonly x: number;
		readonly y: number;
	} | null>(null);

	const registerActorNode = useCallback(
		(node: HTMLElement | null) => {
			unregisterNeighbourActor.current?.();
			unregisterNeighbourActor.current = null;
			if (node === null || !visible) return;
			unregisterNeighbourActor.current = registerNeighbourActor({
				itemId: item.id,
				node,
				source: presentation.canonicalSource,
				x: neighbourTargetX,
				y: neighbourTargetY,
				appliedX: neighbourX,
				appliedY: neighbourY,
				scale: neighbourScaleTarget,
				appliedScale: neighbourScale,
				canonicalWidth: width,
				canonicalHeight: height,
				enabled: !reducedMotion,
			});
		},
		[
			height,
			item.id,
			neighbourX,
			neighbourScale,
			neighbourScaleTarget,
			neighbourTargetX,
			neighbourY,
			neighbourTargetY,
			presentation.canonicalSource,
			reducedMotion,
			registerNeighbourActor,
			visible,
			width,
		],
	);

	const retainNeighbourTravel = useCallback(() => {
		if (reducedMotion) return () => undefined;
		neighbourTravelOwners.current += 1;
		if (neighbourTravelOwners.current === 1) {
			stopNeighbourTravel.current = beginNeighbourTravel(item.id);
		}
		let active = true;
		return () => {
			if (!active) return;
			active = false;
			neighbourTravelOwners.current = Math.max(0, neighbourTravelOwners.current - 1);
			if (neighbourTravelOwners.current !== 0) return;
			stopNeighbourTravel.current?.();
			stopNeighbourTravel.current = null;
		};
	}, [beginNeighbourTravel, item.id, reducedMotion]);

	const clearDragWeight = useCallback(() => {
		dragWeightTargetX.set(0);
		dragWeightTargetY.set(0);
		dragRotationTarget.set(0);
	}, [dragRotationTarget, dragWeightTargetX, dragWeightTargetY]);

	const updateDragWeight = useCallback(
		(info: Pick<PanInfo, "delta" | "velocity">) => {
			if (reducedMotion) {
				clearDragWeight();
				return;
			}
			const horizontal =
				Math.abs(info.velocity.x) > 20 ? -info.velocity.x * 0.006 : -info.delta.x * 0.4;
			const vertical =
				Math.abs(info.velocity.y) > 20 ? -info.velocity.y * 0.005 : -info.delta.y * 0.32;
			dragWeightTargetX.set(Math.max(-10, Math.min(10, horizontal)));
			dragWeightTargetY.set(Math.max(-8, Math.min(8, vertical)));
			dragRotationTarget.set(Math.max(-3, Math.min(3, -horizontal * 0.26)));
		},
		[
			clearDragWeight,
			dragRotationTarget,
			dragWeightTargetX,
			dragWeightTargetY,
			reducedMotion,
		],
	);

	useLayoutEffect(() => {
		itemRef.current = item;
	}, [
		item,
	]);

	const stopPickupCorrection = useCallback(() => {
		pickupAnimationX.current?.stop();
		pickupAnimationY.current?.stop();
		pickupAnimationX.current = null;
		pickupAnimationY.current = null;
	}, []);

	const armPickupCorrection = useCallback(
		(offset: { readonly x: number; readonly y: number }) => {
			pickupTarget.current = offset;
			stopPickupCorrection();
			pickupX.jump(0);
			pickupY.jump(0);
		},
		[
			pickupX,
			pickupY,
			stopPickupCorrection,
		],
	);

	const startPickupCorrection = useCallback(() => {
		stopPickupCorrection();
		if (reducedMotion) {
			pickupX.jump(pickupTarget.current.x);
			pickupY.jump(pickupTarget.current.y);
			return;
		}
		pickupAnimationX.current = animate(pickupX, pickupTarget.current.x, pickupTransition);
		pickupAnimationY.current = animate(pickupY, pickupTarget.current.y, pickupTransition);
	}, [
		pickupX,
		pickupY,
		reducedMotion,
		stopPickupCorrection,
	]);

	const readCueTargetOffset = useCallback(() => {
		if (
			reducedMotion ||
			cue?.targetItemId === undefined ||
			cue.targetItemId === item.id
		) {
			return null;
		}
		const sourceRect = readActorRect(item.id);
		const targetRect = readActorRect(cue.targetItemId);
		if (sourceRect === null || targetRect === null) return null;
		return {
			x: targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2),
			y: targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2),
		};
	}, [cue, item.id, readActorRect, reducedMotion]);

	const readDeliveryOriginOffset = useCallback(
		(placement: NonNullable<ReturnType<typeof readPlacement>>) => {
			if (
				reducedMotion ||
				cue?.originItemId === undefined ||
				cue.originItemId === item.id
			) {
				return null;
			}
			const layerRect = readActorLayerRect();
			const originRect = readActorRect(cue.originItemId);
			if (layerRect === null || originRect === null) return null;
			return readTileDeliveryOriginOffset({
				actorLayerRect: layerRect,
				originRect,
				targetPlacement: placement,
			});
		},
		[cue, item.id, readActorLayerRect, readActorRect, reducedMotion],
	);

	const canCompletePosition = useCallback(
		() =>
			match(presentation.positionCompletion)
				.with(
					{
						kind: "none",
					},
					() => false,
				)
				.with(
					{
						kind: "always",
					},
					() => true,
				)
				.with(
					{
						kind: "location",
					},
					({ location }) => isSameTileLocation(itemRef.current.location, location),
				)
				.exhaustive(),
		[
			presentation.positionCompletion,
		],
	);

	useLayoutEffect(() => {
		void geometryVersion;
		if (presentation.placementFrozen) return;
		let placement: ReturnType<typeof readPlacement>;
		try {
			placement = readPlacement(presentation.desiredSource);
		} catch (error) {
			console.error("Tile placement measurement failed; keeping its last stable pose.", error);
			stopPickupCorrection();
			clearDragWeight();
			dragX.jump(0);
			dragY.jump(0);
			dragFollowX.jump(0);
			dragFollowY.jump(0);
			settleX.jump(0);
			settleY.jump(0);
			pickupX.jump(0);
			pickupY.jump(0);
			neighbourTargetX.set(0);
			neighbourTargetY.set(0);
			neighbourScaleTarget.set(1);
			setVisible(initialized.current);
			if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
				complete(item.id, presentation.positionCompletion.generation);
			}
			return;
		}
		const ownsSettlementMotion =
			presentation.positionCompletion.kind !== "none" ||
			presentation.visualCompletionGeneration !== null;
		if (placement === null) {
			if (!ownsSettlementMotion && presentation.phase !== "targeted") setVisible(false);
			if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
				complete(item.id, presentation.positionCompletion.generation);
			}
			return;
		}

		const generation = ++localMotionGeneration.current;
		if (!initialized.current) {
			const deliveryOffset = cue?.kind === "spawn" ? readDeliveryOriginOffset(placement) : null;
			const releaseTravel =
				deliveryOffset === null || Math.hypot(deliveryOffset.x, deliveryOffset.y) < 0.5
					? null
					: retainNeighbourTravel();
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			dragX.jump(0);
			dragY.jump(0);
			dragFollowX.jump(0);
			dragFollowY.jump(0);
			settleX.jump(deliveryOffset?.x ?? 0);
			settleY.jump(deliveryOffset?.y ?? 0);
			pickupX.jump(0);
			pickupY.jump(0);
			width.jump(placement.width);
			height.jump(placement.height);
			initialized.current = true;
			setVisible(true);
			if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
				complete(item.id, presentation.positionCompletion.generation);
			}
			if (deliveryOffset === null) return;
			const animations = [
				animate(settleX, 0, deliveryTransition),
				animate(settleY, 0, deliveryTransition),
			];
			void Promise.all(animations).finally(() => releaseTravel?.());
			return () => {
				for (const animation of animations) animation.stop();
				releaseTravel?.();
			};
		}

		setVisible(true);
		stopPickupCorrection();
		const animations: Array<ReturnType<typeof animate>> = [];
		let releaseTravel: (() => void) | null = null;
		if (ownsSettlementMotion) {
			const currentVisualX = anchorX.get() + travelX.get() + pickupX.get();
			const currentVisualY = anchorY.get() + travelY.get() + pickupY.get();
			if (Math.hypot(currentVisualX - placement.x, currentVisualY - placement.y) >= 0.5) {
				releaseTravel = retainNeighbourTravel();
			}
			const velocityX = reducedMotion ? 0 : dragFollowX.getVelocity();
			const velocityY = reducedMotion ? 0 : dragFollowY.getVelocity();
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			settleX.jump(currentVisualX - placement.x);
			settleY.jump(currentVisualY - placement.y);
			dragX.jump(0);
			dragY.jump(0);
			dragFollowX.jump(0);
			dragFollowY.jump(0);
			pickupX.jump(0);
			pickupY.jump(0);
			animations.push(
				animate(settleX, 0, { ...settleTransition, velocity: velocityX }),
				animate(settleY, 0, { ...settleTransition, velocity: velocityY }),
			);
		} else {
			if (Math.hypot(anchorX.get() - placement.x, anchorY.get() - placement.y) >= 0.5) {
				releaseTravel = retainNeighbourTravel();
			}
			animations.push(
				animate(anchorX, placement.x, settleTransition),
				animate(anchorY, placement.y, settleTransition),
				animate(dragX, 0, settleTransition),
				animate(dragY, 0, settleTransition),
				animate(settleX, 0, settleTransition),
				animate(settleY, 0, settleTransition),
				animate(pickupX, 0, settleTransition),
				animate(pickupY, 0, settleTransition),
			);
		}
		animations.push(
			animate(width, placement.width, settleTransition),
			animate(height, placement.height, settleTransition),
		);
		void Promise.all(animations)
			.then(() => {
				if (localMotionGeneration.current !== generation) return;
				if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
					complete(item.id, presentation.positionCompletion.generation);
				}
			})
			.catch((error: unknown) => {
				if (localMotionGeneration.current !== generation) return;
				console.error("Tile actor motion failed; converging to its live placement.", error);
				anchorX.jump(placement.x);
				anchorY.jump(placement.y);
				dragX.jump(0);
				dragY.jump(0);
				dragFollowX.jump(0);
				dragFollowY.jump(0);
				settleX.jump(0);
				settleY.jump(0);
				pickupX.jump(0);
				pickupY.jump(0);
				width.jump(placement.width);
				height.jump(placement.height);
				setVisible(true);
				if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
					complete(item.id, presentation.positionCompletion.generation);
				}
			})
			.finally(() => releaseTravel?.());
		return () => {
			if (localMotionGeneration.current === generation) {
				localMotionGeneration.current += 1;
			}
			for (const animation of animations) animation.stop();
			releaseTravel?.();
		};
	}, [
		anchorX,
		anchorY,
		canCompletePosition,
		clearDragWeight,
		cue,
		complete,
		dragFollowX,
		dragFollowY,
		dragX,
		dragY,
		geometryVersion,
		height,
		item.id,
		neighbourScaleTarget,
		neighbourTargetX,
		neighbourTargetY,
		pickupX,
		pickupY,
		presentation.desiredSource,
		presentation.phase,
		presentation.placementFrozen,
		presentation.positionCompletion,
		presentation.visualCompletionGeneration,
		readDeliveryOriginOffset,
		readPlacement,
		reducedMotion,
		retainNeighbourTravel,
		settleX,
		settleY,
		stopPickupCorrection,
		travelX,
		travelY,
		width,
	]);

	useLayoutEffect(() => {
		void geometryVersion;
		if (cue?.kind !== "consume" && cue?.kind !== "consume-exit") {
			setCueTargetOffset(null);
			return;
		}
		const offset = readCueTargetOffset();
		setCueTargetOffset(
			offset === null
				? null
				: {
					generation: cue.generation,
					x: offset.x,
					y: offset.y,
				},
		);
	}, [cue, geometryVersion, readCueTargetOffset]);

	useLayoutEffect(() => {
		void geometryVersion;
		if (cue?.kind !== "absorb") {
			setCueOriginOffset(null);
			return;
		}
		let placement: ReturnType<typeof readPlacement>;
		try {
			placement = readPlacement(presentation.desiredSource);
		} catch (error) {
			console.error("Tile delivery measurement failed; using local impact only.", error);
			setCueOriginOffset(null);
			return;
		}
		if (placement === null) {
			setCueOriginOffset(null);
			return;
		}
		const offset = readDeliveryOriginOffset(placement);
		setCueOriginOffset(
			offset === null
				? null
				: {
					generation: cue.generation,
					x: offset.x,
					y: offset.y,
				},
		);
	}, [
		cue,
		geometryVersion,
		presentation.desiredSource,
		readDeliveryOriginOffset,
		readPlacement,
	]);

	useLayoutEffect(() => {
		if (!visible || presentation.phase !== "dragging") return;
		return retainNeighbourTravel();
	}, [presentation.phase, retainNeighbourTravel, visible]);

	useEffect(() => {
		if (
			!visible ||
			cueTargetOffset === null ||
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
		cueTargetOffset,
		item.id,
		presentation.phase,
		retainNeighbourTravel,
		setNeighbourTravelTarget,
		visible,
	]);

	const onVisualAnimationComplete = useCallback(() => {
		if (presentation.visualCompletionGeneration === null) return;
		complete(item.id, presentation.visualCompletionGeneration);
	}, [
		complete,
		item.id,
		presentation.visualCompletionGeneration,
	]);

	useEffect(() => {
		const generation = presentation.visualCompletionGeneration;
		if (generation === null) return;
		const fallback = setTimeout(
			() => complete(item.id, generation),
			interactionCompletionFallbackMs,
		);
		return () => clearTimeout(fallback);
	}, [
		complete,
		item.id,
		presentation.visualCompletionGeneration,
	]);

	useEffect(() => {
		const completion = presentation.positionCompletion;
		if (completion.kind === "none") return;
		const fallback = setTimeout(
			() => complete(item.id, completion.generation),
			interactionCompletionFallbackMs,
		);
		return () => clearTimeout(fallback);
	}, [
		complete,
		item.id,
		presentation.positionCompletion,
	]);

	useEffect(() => {
		if (reducedMotion) {
			clearDragWeight();
			neighbourTargetX.set(0);
			neighbourTargetY.set(0);
			neighbourScaleTarget.set(1);
		}
	}, [
		clearDragWeight,
		neighbourTargetX,
		neighbourTargetY,
		neighbourScaleTarget,
		reducedMotion,
	]);

	useEffect(
		() => () => {
			localMotionGeneration.current += 1;
			stopPickupCorrection();
			clearDragWeight();
			neighbourTravelOwners.current = 0;
			stopNeighbourTravel.current?.();
			stopNeighbourTravel.current = null;
			unregisterNeighbourActor.current?.();
			unregisterNeighbourActor.current = null;
		},
		[
			clearDragWeight,
			stopPickupCorrection,
		],
	);

	return {
		anchorX,
		anchorY,
		registerActorNode,
		dragX,
		dragY,
		travelX,
		travelY,
		dragWeightX,
		dragWeightY,
		dragRotation,
		neighbourX,
		neighbourY,
		neighbourScale,
		pickupX,
		pickupY,
		width,
		height,
		visible,
		cueOriginOffset:
			cueOriginOffset === null
				? null
				: { x: cueOriginOffset.x, y: cueOriginOffset.y },
		cueTargetOffset:
			cueTargetOffset === null || cueTargetOffset.generation !== cue?.generation
				? null
				: { x: cueTargetOffset.x, y: cueTargetOffset.y },
		armPickupCorrection,
		startPickupCorrection,
		stopPickupCorrection,
		updateDragWeight,
		clearDragWeight,
		onVisualAnimationComplete,
	};
};
