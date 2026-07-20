import { animate, useMotionValue } from "motion/react";
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
	const { geometryVersion, readPlacement, complete } = useTileActorSystem();
	const anchorX = useMotionValue(0);
	const anchorY = useMotionValue(0);
	const dragX = useMotionValue(0);
	const dragY = useMotionValue(0);
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
	const [visible, setVisible] = useState(false);
	itemRef.current = item;

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
		pickupAnimationX.current = animate(pickupX, pickupTarget.current.x, pickupTransition);
		pickupAnimationY.current = animate(pickupY, pickupTarget.current.y, pickupTransition);
	}, [
		pickupX,
		pickupY,
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
		const placement = readPlacement(presentation.desiredSource);
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
		void Promise.all(animations).then(() => {
			if (localMotionGeneration.current !== generation) return;
			if (presentation.positionCompletion.kind !== "none" && canCompletePosition()) {
				complete(item.id, presentation.positionCompletion.generation);
			}
		});
		return () => {
			for (const animation of animations) animation.stop();
		};
	}, [
		anchorX,
		anchorY,
		canCompletePosition,
		complete,
		dragX,
		dragY,
		geometryVersion,
		height,
		item.id,
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

	useEffect(
		() => () => {
			localMotionGeneration.current += 1;
			stopPickupCorrection();
		},
		[
			stopPickupCorrection,
		],
	);

	return {
		anchorX,
		anchorY,
		dragX,
		dragY,
		pickupX,
		pickupY,
		width,
		height,
		visible,
		armPickupCorrection,
		startPickupCorrection,
		stopPickupCorrection,
		onVisualAnimationComplete,
	};
};
