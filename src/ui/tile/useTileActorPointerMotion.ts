import { animate, type PanInfo, useMotionValue } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useTileActorPhysicalResponse } from "~/ui/tile/useTileActorPhysicalResponse";

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

const maximumSettlementVelocity = 1_800;

const boundVelocity = (x: number, y: number) => {
	const magnitude = Math.hypot(x, y);
	if (magnitude <= maximumSettlementVelocity || magnitude === 0)
		return {
			x,
			y,
		};
	const scale = maximumSettlementVelocity / magnitude;
	return {
		x: x * scale,
		y: y * scale,
	};
};

export namespace useTileActorPointerMotion {
	export interface Vector {
		readonly x: number;
		readonly y: number;
	}

	export interface ReleaseSnapshot {
		readonly interactionGeneration: number;
		readonly pointerGeneration: number;
		readonly direct: Vector;
		readonly pickup: Vector;
		readonly physical: {
			readonly x: number;
			readonly y: number;
			readonly rotation: number;
			readonly velocity: Vector;
		};
		/**
		 * Offset that the travel owner absorbs before resetting direct pointer
		 * and pickup values. The physical shell remains mounted and settles itself.
		 */
		readonly handoffOffset: Vector;
		readonly visibleOffset: Vector;
		readonly settlementVelocity: Vector;
	}

	export interface Control {
		readonly armPickup: (offset: Vector) => void;
		/** Ends an unstarted press without interrupting an already-settling physical shell. */
		readonly disarmPickup: () => void;
		readonly startPickup: () => void;
		readonly updateResponse: (info: Pick<PanInfo, "delta" | "velocity">) => void;
		readonly cancel: () => void;
		/** Releases gesture ownership while preserving the exact terminal-cue pose. */
		readonly handoffToTerminalCue: () => void;
		readonly release: (interactionGeneration: number) => ReleaseSnapshot;
		readonly resetAfterHandoff: (pointerGeneration: number) => boolean;
	}
}

/**
 * Owns direct pointer translation and pickup correction, and presents the
 * physical-response owner through one focused drag-facing contract.
 */
export const useTileActorPointerMotion = () => {
	const directX = useMotionValue(0);
	const directY = useMotionValue(0);
	const pickupX = useMotionValue(0);
	const pickupY = useMotionValue(0);
	const pickupTarget = useRef<useTileActorPointerMotion.Vector>({
		x: 0,
		y: 0,
	});
	const pointerGeneration = useRef(0);
	const pickupAnimations = useRef<Array<ReturnType<typeof animate>>>([]);
	const physical = useTileActorPhysicalResponse();

	const stopPickup = useCallback(() => {
		for (const animation of pickupAnimations.current) animation.stop();
		pickupAnimations.current = [];
	}, []);

	const resetPointerTranslation = useCallback(() => {
		stopPickup();
		pickupTarget.current = {
			x: 0,
			y: 0,
		};
		directX.jump(0);
		directY.jump(0);
		pickupX.jump(0);
		pickupY.jump(0);
	}, [
		directX,
		directY,
		pickupX,
		pickupY,
		stopPickup,
	]);

	const armPickup = useCallback(
		(offset: useTileActorPointerMotion.Vector) => {
			pointerGeneration.current += 1;
			resetPointerTranslation();
			pickupTarget.current = offset;
		},
		[
			resetPointerTranslation,
		],
	);

	const disarmPickup = useCallback(() => {
		pointerGeneration.current += 1;
		resetPointerTranslation();
	}, [
		resetPointerTranslation,
	]);

	const startPickup = useCallback(() => {
		stopPickup();
		pickupAnimations.current = [
			animate(pickupX, pickupTarget.current.x, pickupTransition),
			animate(pickupY, pickupTarget.current.y, pickupTransition),
		];
	}, [
		pickupX,
		pickupY,
		stopPickup,
	]);

	const cancel = useCallback(() => {
		pointerGeneration.current += 1;
		resetPointerTranslation();
		physical.commands.cancel();
	}, [
		physical.commands,
		resetPointerTranslation,
	]);

	const handoffToTerminalCue = useCallback(() => {
		pointerGeneration.current += 1;
		stopPickup();
		physical.commands.freeze();
	}, [
		physical.commands,
		stopPickup,
	]);

	const release = useCallback(
		(interactionGeneration: number): useTileActorPointerMotion.ReleaseSnapshot => {
			const direct = {
				x: directX.get(),
				y: directY.get(),
			};
			const pickup = {
				x: pickupX.get(),
				y: pickupY.get(),
			};
			const response = physical.commands.readSnapshot();
			const handoffOffset = {
				x: direct.x + pickup.x,
				y: direct.y + pickup.y,
			};
			const settlementVelocity = boundVelocity(
				directX.getVelocity() + pickupX.getVelocity(),
				directY.getVelocity() + pickupY.getVelocity(),
			);
			const snapshot = {
				interactionGeneration,
				pointerGeneration: pointerGeneration.current,
				direct,
				pickup,
				physical: {
					x: response.x,
					y: response.y,
					rotation: response.rotation,
					velocity: response.velocity,
				},
				handoffOffset,
				visibleOffset: {
					x: handoffOffset.x + response.x,
					y: handoffOffset.y + response.y,
				},
				settlementVelocity,
			};
			physical.commands.release();
			return snapshot;
		},
		[
			directX,
			directY,
			physical.commands,
			pickupX,
			pickupY,
		],
	);

	const resetAfterHandoff = useCallback(
		(generation: number) => {
			if (pointerGeneration.current !== generation) return false;
			resetPointerTranslation();
			return true;
		},
		[
			resetPointerTranslation,
		],
	);

	useEffect(
		() => () => {
			pointerGeneration.current += 1;
			resetPointerTranslation();
		},
		[
			resetPointerTranslation,
		],
	);

	const commands = useMemo<useTileActorPointerMotion.Control>(
		() => ({
			armPickup,
			disarmPickup,
			startPickup,
			updateResponse: physical.commands.update,
			cancel,
			handoffToTerminalCue,
			release,
			resetAfterHandoff,
		}),
		[
			armPickup,
			cancel,
			disarmPickup,
			handoffToTerminalCue,
			physical.commands.update,
			release,
			resetAfterHandoff,
			startPickup,
		],
	);
	const values = useMemo(
		() => ({
			direct: {
				x: directX,
				y: directY,
			},
			pickup: {
				x: pickupX,
				y: pickupY,
			},
			physical: physical.values,
		}),
		[
			directX,
			directY,
			physical.values,
			pickupX,
			pickupY,
		],
	);

	return {
		values,
		commands,
	};
};
