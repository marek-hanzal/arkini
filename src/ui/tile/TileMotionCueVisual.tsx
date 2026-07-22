import { motion, useReducedMotion } from "motion/react";
import { type PropsWithChildren, useEffect } from "react";
import { match } from "ts-pattern";

import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";

export namespace TileMotionCueVisual {
	export interface Props extends PropsWithChildren {
		readonly cue: TileMotionCueSchema.Type | null;
		readonly enabled: boolean;
		readonly onComplete: (generation: number) => void;
	}
}

/** Owns the autonomous cue transform nested inside the actor interaction visual. */
export const TileMotionCueVisual = ({
	children,
	cue,
	enabled,
	onComplete,
}: TileMotionCueVisual.Props) => {
	const reducedMotion = useReducedMotion();

	useEffect(() => {
		if (cue === null || enabled) return;
		onComplete(cue.generation);
	}, [
		cue,
		enabled,
		onComplete,
	]);

	if (cue === null || !enabled) {
		return (
			<span className="absolute inset-0" data-ui="TileMotionCueVisual">
				{children}
			</span>
		);
	}

	const animation = match(cue.kind)
		.with("spawn", () => ({
			initial: {
				scale: reducedMotion ? 0.94 : 0.78,
				opacity: 0,
				y: reducedMotion ? 0 : 8,
			},
			animate: {
				scale: reducedMotion ? [0.94, 1] : [0.78, 1.07, 1],
				opacity: [0, 1, 1],
				y: reducedMotion ? 0 : [8, -2, 0],
			},
			duration: reducedMotion ? 0.14 : 0.34,
		}))
		.with("impact", () => {
			const peak = reducedMotion ? 1.025 : 1.1 + (cue.strength - 1) * 0.025;
			return {
				initial: false as const,
				animate: {
					scale: [1, peak, 1],
					opacity: 1,
					y: reducedMotion ? 0 : [0, -2 - cue.strength, 0],
				},
				duration: reducedMotion ? 0.12 : 0.26,
			};
		})
		.with("accept", () => ({
			initial: false as const,
			animate: {
				scale: reducedMotion ? [1, 0.98, 1] : [1, 0.93, 1.035, 1],
				opacity: 1,
				y: reducedMotion ? 0 : [0, 3, -1, 0],
			},
			duration: reducedMotion ? 0.12 : 0.3,
		}))
		.with("exit", () => ({
			initial: false as const,
			animate: {
				scale: reducedMotion ? [1, 0.94] : [1, 1.055, 0.72],
				opacity: reducedMotion ? [1, 0] : [1, 1, 0],
				y: reducedMotion ? 0 : [0, -8, -14],
			},
			duration: reducedMotion ? 0.14 : 0.28,
		}))
		.exhaustive();

	return (
		<motion.span
			key={cue.generation}
			className="absolute inset-0"
			data-ui="TileMotionCueVisual"
			data-motion-cue={cue.kind}
			data-motion-cue-generation={cue.generation}
			data-motion-cue-strength={cue.strength}
			initial={animation.initial}
			animate={animation.animate}
			transition={{
			duration: animation.duration,
			ease: [0.22, 1, 0.36, 1],
			}}
			onAnimationComplete={() => onComplete(cue.generation)}
		>
			{children}
		</motion.span>
	);
};
