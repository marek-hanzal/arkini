import {
	animate,
	type PanInfo,
	useMotionValue,
	useReducedMotion,
	useSpring,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { match } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import { isSameTileLocation } from "~/bridge/tile/isSameTileLocation";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";
import type { useTileActorPresentation } from "~/ui/tile/useTileActorPresentation";

const settleTransition = {
	type: "spring" as const,
	stiffness: 560,
	damping: 38,
	mass: 0.62,
};

const interactionVisualFallbackMs = 1_200;

const pickupTransition = {
	type: "tween" as const,
	duration: 0.11,
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
}: {
	readonly item: useTileActors.Item;
	readonly presentation: useTileActorPresentation.Model;
}) => {
	const { geometryVersion, readPlacement, complete, registerNeighbourActor } = useTileActorSystem();
	const reducedMotion = useReducedMotion();
	const anchorX = useMotionValue(0);
	const anchorY = useMotionValue(0);
	const dragX = useMotionValue(0);
	const dragY = useMotionValue(0);
	const dragWeightTargetX = useMotionValue(0);
	const dragWeightTargetY = useMotionValue(0);
	const dragRotationTarget = useMotionValue(0);
	const dragWeightX = useSpring(dragWeightTargetX, { stiffness: 720, damping: 48, mass: 0.42 });
	const dragWeightY = useSpring(dragWeightTargetY, { stiffness: 720, damping: 48, mass: 0.42 });
	const dragRotation = useSpring(dragRotationTarget, { stiffness: 640, damping: 42, mass: 0.38 });
	const neighbourTargetX = useMotionValue(0);
	const neighbourTargetY = useMotionValue(0);
	const neighbourX = useSpring(neighbourTargetX, { stiffness: 480, damping: 38, mass: 0.5 });
	const neighbourY = useSpring(neighbourTargetY, { stiffness: 480, damping: 38, mass: 0.5 });
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
	const [visible, setVisible] = useState(false);

	const registerActorNode = useCallback(
		(node: HTMLElement | null) => {
			unregisterNeighbourActor.current?.();
			unregisterNeighbourActor.current = null;
			if (node === null || !visible) return;
			unregisterNeighbourActor.current = registerNeighbourActor({
				itemId: item.id,
				node,
				x: neighbourTargetX,
				y: neighbourTargetY,
				enabled: !reducedMotion,
			});
		},
		[
			item.id,
			neighbourTargetX,
			neighbourTargetY,
			reducedMotion,
			registerNeighbourActor,
			visible,
		],
	);

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
				Math.abs(info.velocity.x) > 20 ? -info.velocity.x * 0.005 : -info.delta.x * 0.35;
			const vertical =
				Math.abs(info.velocity.y) > 20 ? -info.velocity.y * 0.004 : -info.delta.y * 0.28;
			dragWeightTargetX.set(Math.max(-8, Math.min(8, horizontal)));
			dragWeightTargetY.set(Math.max(-6, Math.min(6, vertical)));
			dragRotationTarget.set(Math.max(-2.5, Math.min(2.5, -horizontal * 0.24)));
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
			pickupX.jump(0);
			pickupY.jump(0);
			neighbourTargetX.set(0);
			neighbourTargetY.set(0);
			setVisible(initialized.current);
			return;
		}
		const ownsSettlementMotion =
			presentation.positionCompletion.kind !== "none" ||
			presentation.visualCompletionGeneration !== null;
		if (placement === null) {
			if (!ownsSettlementMotion && presentation.phase !== "targeted") setVisible(false);
			return;
		}

		const generation = ++localMotionGeneration.current;
		if (!initialized.current) {
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			dragX.jump(0);
			dragY.jump(0);
			pickupX.jump(0);
			pickupY.jump(0);
			width.jump(placement.width);
			height.jump(placement.height);
			initialized.current = true;
			setVisible(true);
			if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
				complete(item.id, presentation.positionCompletion.generation);
			}
			return;
		}

		setVisible(true);
		stopPickupCorrection();
		const animations: Array<ReturnType<typeof animate>> = [];
		if (ownsSettlementMotion) {
			const currentVisualX = anchorX.get() + dragX.get() + pickupX.get();
			const currentVisualY = anchorY.get() + dragY.get() + pickupY.get();
			anchorX.jump(placement.x);
			anchorY.jump(placement.y);
			dragX.jump(currentVisualX - placement.x);
			dragY.jump(currentVisualY - placement.y);
			pickupX.jump(0);
			pickupY.jump(0);
			animations.push(
				animate(dragX, 0, settleTransition),
				animate(dragY, 0, settleTransition),
			);
		} else {
			animations.push(
				animate(anchorX, placement.x, settleTransition),
				animate(anchorY, placement.y, settleTransition),
				animate(dragX, 0, settleTransition),
				animate(dragY, 0, settleTransition),
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
				pickupX.jump(0);
				pickupY.jump(0);
				width.jump(placement.width);
				height.jump(placement.height);
				setVisible(true);
				if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
					complete(item.id, presentation.positionCompletion.generation);
				}
			});
		return () => {
			if (localMotionGeneration.current === generation) {
				localMotionGeneration.current += 1;
			}
			for (const animation of animations) animation.stop();
		};
	}, [
		anchorX,
		anchorY,
		canCompletePosition,
		clearDragWeight,
		complete,
		dragX,
		dragY,
		geometryVersion,
		height,
		item.id,
		neighbourTargetX,
		neighbourTargetY,
		pickupX,
		pickupY,
		presentation.desiredSource,
		presentation.phase,
		presentation.placementFrozen,
		presentation.positionCompletion,
		presentation.visualCompletionGeneration,
		readPlacement,
		stopPickupCorrection,
		width,
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
			interactionVisualFallbackMs,
		);
		return () => clearTimeout(fallback);
	}, [
		complete,
		item.id,
		presentation.visualCompletionGeneration,
	]);

	useEffect(() => {
		if (reducedMotion) {
			clearDragWeight();
			neighbourTargetX.set(0);
			neighbourTargetY.set(0);
		}
	}, [
		clearDragWeight,
		neighbourTargetX,
		neighbourTargetY,
		reducedMotion,
	]);

	useEffect(
		() => () => {
			localMotionGeneration.current += 1;
			stopPickupCorrection();
			clearDragWeight();
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
		dragWeightX,
		dragWeightY,
		dragRotation,
		neighbourX,
		neighbourY,
		pickupX,
		pickupY,
		width,
		height,
		visible,
		armPickupCorrection,
		startPickupCorrection,
		stopPickupCorrection,
		updateDragWeight,
		clearDragWeight,
		onVisualAnimationComplete,
	};
};
