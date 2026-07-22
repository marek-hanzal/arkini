import { motion, useReducedMotion } from "motion/react";
import { type PropsWithChildren, type ReactNode, useEffect } from "react";
import { match } from "ts-pattern";

import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";

export namespace TileMotionCueVisual {
	export interface Props extends PropsWithChildren {
		readonly cue: TileMotionCueSchema.Type | null;
		readonly enabled: boolean;
		readonly originOffset: {
			readonly x: number;
			readonly y: number;
		} | null;
		readonly deliveryPayload: ReactNode | null;
		readonly onComplete: (generation: number) => void;
	}
}

/** Owns the autonomous cue transform nested inside the actor interaction visual. */
export const TileMotionCueVisual = ({
	children,
	cue,
	enabled,
	originOffset,
	deliveryPayload,
	onComplete,
}: TileMotionCueVisual.Props) => {
	const reducedMotion = useReducedMotion();

	useEffect(() => {
		if (cue === null || enabled) return;
		onComplete(cue.generation);
	}, [cue, enabled, onComplete]);

	if (cue === null || !enabled) {
		return (
			<span className="absolute inset-0" data-ui="TileMotionCueVisual">
				{children}
			</span>
		);
	}

	if (cue.kind === "absorb") {
		const rebound = reducedMotion ? 1.03 : 1.08 + (cue.strength - 1) * 0.02;
		const duration = reducedMotion ? 0.18 : 0.6;
		return (
			<span
				key={cue.generation}
				className="absolute inset-0"
				data-ui="TileMotionCueVisual"
				data-motion-cue={cue.kind}
				data-motion-cue-generation={cue.generation}
				data-motion-cue-strength={cue.strength}
			>
				<motion.span
					className="absolute inset-0"
					initial={false}
					animate={{
						scale: reducedMotion ? [1, 0.96, 1] : [1, 0.75, rebound, 1],
						opacity: 1,
					}}
					transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
					onAnimationComplete={() => onComplete(cue.generation)}
				>
					{children}
				</motion.span>
				{originOffset === null || reducedMotion || deliveryPayload === null ? null : (
					<motion.span
						className="pointer-events-none absolute inset-0"
						data-ui="TileMotionDeliveryPayload"
						aria-hidden="true"
						initial={{
							x: originOffset.x,
							y: originOffset.y,
							scale: 0.72,
							opacity: 0.82,
						}}
						animate={{
							x: 0,
							y: 0,
							scale: [0.72, 0.9, 0.45],
							opacity: [0.82, 1, 0],
						}}
						transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
					>
						{deliveryPayload}
					</motion.span>
				)}
			</span>
		);
	}

	const animation = match(cue.kind)
		.with("spawn", () => ({
			initial: {
				scale: reducedMotion ? 0.94 : 0.74,
				opacity: reducedMotion ? 0.6 : 0.35,
				y: reducedMotion ? 0 : 10,
			},
			animate: {
				scale: reducedMotion ? [0.94, 1] : [0.74, 1.09, 1],
				opacity: reducedMotion ? [0.6, 1] : [0.35, 1, 1],
				y: reducedMotion ? 0 : [10, -3, 0],
			},
			duration: reducedMotion ? 0.18 : 0.6,
		}))
		.with("settle", () => ({
			initial: {
				scale: reducedMotion ? 0.98 : 0.92,
				opacity: 0.66,
				y: reducedMotion ? 0 : 6,
			},
			animate: {
				scale: 1,
				opacity: 1,
				y: 0,
			},
			duration: reducedMotion ? 0.16 : 0.4,
		}))
		.with("impact", () => {
			const peak = reducedMotion ? 1.03 : 1.12 + (cue.strength - 1) * 0.03;
			return {
				initial: false as const,
				animate: {
					scale: [1, peak, 1],
					opacity: 1,
					y: reducedMotion ? 0 : [0, -3 - cue.strength, 0],
				},
				duration: reducedMotion ? 0.16 : 0.45,
			};
		})
		.with("accept", () => ({
			initial: false as const,
			animate: {
				scale: reducedMotion ? [1, 0.96, 1] : [1, 0.75, 1.04, 1],
				opacity: 1,
				y: reducedMotion ? 0 : [0, 3, -2, 0],
			},
			duration: reducedMotion ? 0.18 : 0.58,
		}))
		.with("consume", () => ({
			initial: false as const,
			animate: {
				scale: reducedMotion ? [1, 0.96, 1] : [1, 0.75, 1],
				opacity: reducedMotion ? 1 : [1, 0.82, 1],
				y: reducedMotion ? 0 : [0, 4, 0],
			},
			duration: reducedMotion ? 0.18 : 0.58,
		}))
		.with("consume-exit", () => ({
			initial: false as const,
			animate: {
				scale: reducedMotion ? [1, 0.9] : [1, 0.75, 0.66],
				opacity: reducedMotion ? [1, 0] : [1, 1, 0],
				y: reducedMotion ? 0 : [0, 4, -12],
			},
			duration: reducedMotion ? 0.2 : 0.58,
		}))
		.with("exit", () => ({
			initial: false as const,
			animate: {
				scale: reducedMotion ? [1, 0.94] : [1, 1.08, 0.68],
				opacity: reducedMotion ? [1, 0] : [1, 1, 0],
				y: reducedMotion ? 0 : [0, -10, -18],
			},
			duration: reducedMotion ? 0.18 : 0.5,
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
