import { animate, type PanInfo, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { readTileDragElasticResponse } from "~/ui/tile/readTileDragElasticResponse";

const responseTransition = {
	type: "spring" as const,
	stiffness: 280,
	damping: 26,
	mass: 0.52,
};

const rotationTransition = {
	type: "spring" as const,
	stiffness: 250,
	damping: 25,
	mass: 0.48,
};

const targetReturnTransition = {
	type: "tween" as const,
	duration: 0.14,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const responseReturnDelayMs = 32;

export namespace useTileActorPhysicalResponse {
	export interface Snapshot {
		readonly x: number;
		readonly y: number;
		readonly rotation: number;
		readonly velocity: {
			readonly x: number;
			readonly y: number;
		};
	}
}

/**
 * Owns the bounded drag-response shell. It never writes canonical placement,
 * direct pointer translation, or transient travel.
 */
export const useTileActorPhysicalResponse = () => {
	const reducedMotion = useReducedMotion();
	const targetX = useMotionValue(0);
	const targetY = useMotionValue(0);
	const targetRotation = useMotionValue(0);
	const x = useSpring(targetX, responseTransition);
	const y = useSpring(targetY, responseTransition);
	const rotation = useSpring(targetRotation, rotationTransition);
	const returnAnimations = useRef<Array<ReturnType<typeof animate>>>([]);
	const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const stopReturnAnimations = useCallback(() => {
		if (returnTimer.current !== null) {
			clearTimeout(returnTimer.current);
			returnTimer.current = null;
		}
		for (const animation of returnAnimations.current) animation.stop();
		returnAnimations.current = [];
	}, []);

	const cancel = useCallback(() => {
		stopReturnAnimations();
		targetX.jump(0);
		targetY.jump(0);
		targetRotation.jump(0);
		x.jump(0);
		y.jump(0);
		rotation.jump(0);
	}, [
		rotation,
		stopReturnAnimations,
		targetRotation,
		targetX,
		targetY,
		x,
		y,
	]);

	const release = useCallback(() => {
		stopReturnAnimations();
		targetX.set(0);
		targetY.set(0);
		targetRotation.set(0);
	}, [
		stopReturnAnimations,
		targetRotation,
		targetX,
		targetY,
	]);

	const update = useCallback(
		(info: Pick<PanInfo, "delta" | "velocity">) => {
			if (reducedMotion) {
				cancel();
				return;
			}
			const response = readTileDragElasticResponse(info);
			stopReturnAnimations();
			targetX.jump(response.x);
			targetY.jump(response.y);
			targetRotation.jump(response.rotation);
			returnTimer.current = setTimeout(() => {
				returnTimer.current = null;
				returnAnimations.current = [
					animate(targetX, 0, targetReturnTransition),
					animate(targetY, 0, targetReturnTransition),
					animate(targetRotation, 0, targetReturnTransition),
				];
			}, responseReturnDelayMs);
		},
		[
			cancel,
			reducedMotion,
			stopReturnAnimations,
			targetRotation,
			targetX,
			targetY,
		],
	);

	const readSnapshot = useCallback((): useTileActorPhysicalResponse.Snapshot => {
		if (reducedMotion) {
			return {
				x: 0,
				y: 0,
				rotation: 0,
				velocity: {
					x: 0,
					y: 0,
				},
			};
		}
		return {
			x: x.get(),
			y: y.get(),
			rotation: rotation.get(),
			velocity: {
				x: x.getVelocity(),
				y: y.getVelocity(),
			},
		};
	}, [
		reducedMotion,
		rotation,
		x,
		y,
	]);

	useEffect(() => {
		if (reducedMotion) cancel();
	}, [
		cancel,
		reducedMotion,
	]);

	useEffect(
		() => cancel,
		[
			cancel,
		],
	);

	const values = useMemo(
		() => ({
			x,
			y,
			rotation,
		}),
		[
			rotation,
			x,
			y,
		],
	);
	const commands = useMemo(
		() => ({
			update,
			release,
			cancel,
			readSnapshot,
		}),
		[
			cancel,
			readSnapshot,
			release,
			update,
		],
	);

	return {
		values,
		commands,
	};
};
