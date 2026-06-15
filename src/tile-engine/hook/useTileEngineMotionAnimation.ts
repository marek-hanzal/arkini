import { animate, type AnimationPlaybackControlsWithThen } from "motion";
import { useLayoutEffect, type RefObject } from "react";
import type { TileEngineMotion, TileEngineRect } from "~/tile-engine/logic/tileEngineMachine";

export const tileEngineMotionDurationSeconds = 0.26;
export const tileEngineMotionDurationMs = tileEngineMotionDurationSeconds * 1000;

export const tileEngineMotionEase = [
	0.22,
	1,
	0.36,
	1,
] as const;

export const tileEngineMotionTransition = {
	duration: tileEngineMotionDurationSeconds,
	ease: tileEngineMotionEase,
} as const;

export namespace useTileEngineMotionAnimation {
	export interface Props {
		ref: RefObject<HTMLElement | null>;
		motion?: TileEngineMotion | TileEngineExternalMotion;
		onSettle?(): void;
	}
}

export interface TileEngineExternalMotion {
	from: TileEngineRect;
	to?: TileEngineRect;
	priority?: "normal" | "raised";
	nonce?: number;
}

const readDestination = (element: HTMLElement, motion: TileEngineExternalMotion) => {
	if (motion.to) return motion.to;

	const rect = element.getBoundingClientRect();
	return {
		left: rect.left,
		top: rect.top,
		width: rect.width,
		height: rect.height,
	};
};

/**
 * Animates one stable tile actor from a viewport rect into its current rendered
 * slot. The destination is read from the final actor itself, so parent data can
 * commit first and the visual layer can simply catch up.
 */
export const useTileEngineMotionAnimation = ({
	ref,
	motion,
	onSettle,
}: useTileEngineMotionAnimation.Props) => {
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || !motion) return;

		const toRect = readDestination(element, motion);
		const base = element.getBoundingClientRect();
		const baseWidth = base.width || toRect.width || 1;
		const baseHeight = base.height || toRect.height || 1;
		const from = {
			x: motion.from.left - base.left,
			y: motion.from.top - base.top,
			scaleX: motion.from.width / baseWidth,
			scaleY: motion.from.height / baseHeight,
		};
		const to = {
			x: toRect.left - base.left,
			y: toRect.top - base.top,
			scaleX: toRect.width / baseWidth,
			scaleY: toRect.height / baseHeight,
		};

		let settled = false;
		const controls: AnimationPlaybackControlsWithThen = animate(
			element,
			{
				x: [
					from.x,
					to.x,
				],
				y: [
					from.y,
					to.y,
				],
				scaleX: [
					from.scaleX,
					to.scaleX,
				],
				scaleY: [
					from.scaleY,
					to.scaleY,
				],
				opacity: 1,
			},
			tileEngineMotionTransition,
		);

		void controls.then(() => {
			settled = true;
			onSettle?.();
		});

		return () => {
			if (!settled) controls.stop();
		};
	}, [
		motion,
		onSettle,
		ref,
	]);
};
