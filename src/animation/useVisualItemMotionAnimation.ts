import { animate, type AnimationPlaybackControlsWithThen } from "motion";
import { useLayoutEffect, type RefObject } from "react";
import type { VisualItemMotion } from "~/play/logic/visualItemMotionMachine";

export const visualItemMotionDurationSeconds = 0.26;
export const visualItemMotionDurationMs = visualItemMotionDurationSeconds * 1000;

export const visualItemMotionEase = [
	0.22,
	1,
	0.36,
	1,
] as const;

export const visualItemMotionTransition = {
	duration: visualItemMotionDurationSeconds,
	ease: visualItemMotionEase,
} as const;

export namespace useVisualItemMotionAnimation {
	export interface Props {
		ref: RefObject<HTMLElement | null>;
		motion: VisualItemMotion | undefined;
		onSettle?(): void;
	}
}

/**
 * Animates a stable item actor between viewport rects without relying on Motion
 * layout projection. The actor may already be mounted, newly mounted, or about
 * to exit; the current DOM rect is used as the transform base every time.
 */
export const useVisualItemMotionAnimation = ({
	ref,
	motion,
	onSettle,
}: useVisualItemMotionAnimation.Props) => {
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element || !motion) return;

		const base = element.getBoundingClientRect();
		const baseWidth = base.width || motion.to.width || 1;
		const baseHeight = base.height || motion.to.height || 1;
		const from = {
			x: motion.from.left - base.left,
			y: motion.from.top - base.top,
			scaleX: motion.from.width / baseWidth,
			scaleY: motion.from.height / baseHeight,
		};
		const to = {
			x: motion.to.left - base.left,
			y: motion.to.top - base.top,
			scaleX: motion.to.width / baseWidth,
			scaleY: motion.to.height / baseHeight,
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
			visualItemMotionTransition,
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
