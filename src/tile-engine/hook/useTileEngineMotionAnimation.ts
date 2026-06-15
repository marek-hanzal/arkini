import { animate, type AnimationPlaybackControlsWithThen } from "motion";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { TileEngineTransitionKind } from "~/tile-engine/type/TileEngineTransitionKind";
import type { TileEngineMotion, TileEngineRect } from "~/tile-engine/logic/tileEngineMachine";

export const tileEngineMotionDurationSeconds = 0.3;
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
	kind?: TileEngineTransitionKind;
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

const shouldExit = (kind: TileEngineTransitionKind | undefined) =>
	kind === "consume" || kind === "exit";

/**
 * Animates one stable tile actor from a viewport rect into its current rendered
 * slot. The destination is read from the final actor itself unless a transition
 * explicitly provides an external sink rect.
 */
export const useTileEngineMotionAnimation = ({
	ref,
	motion,
	onSettle,
}: useTileEngineMotionAnimation.Props) => {
	const onSettleRef = useRef(onSettle);

	useLayoutEffect(() => {
		onSettleRef.current = onSettle;
	}, [
		onSettle,
	]);

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
		const exit = shouldExit(motion.kind);
		const to = {
			x: toRect.left - base.left,
			y: toRect.top - base.top,
			scaleX: (toRect.width / baseWidth) * (exit ? 0.82 : 1),
			scaleY: (toRect.height / baseHeight) * (exit ? 0.82 : 1),
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
				opacity: exit
					? [
							1,
							0,
						]
					: 1,
			},
			tileEngineMotionTransition,
		);

		void controls.then(() => {
			settled = true;
			element.style.transform = "";
			element.style.opacity = "";
			onSettleRef.current?.();
		});

		return () => {
			if (!settled) controls.stop();
		};
	}, [
		motion,
		ref,
	]);
};
