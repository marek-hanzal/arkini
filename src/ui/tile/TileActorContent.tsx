import { motion } from "motion/react";
import { match } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";

export namespace TileActorContent {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly onAnimationComplete?: () => void;
	}
}

const settledVisualTarget = {
	scale: 1,
	opacity: 1,
	filter: "brightness(1)",
	borderColor: "var(--ak-line-strong)",
	boxShadow: "0 0.55rem 1.2rem color-mix(in srgb, var(--ak-overlay) 34%, transparent)",
};

const visualTarget = ({ phase, feedback }: Pick<TileActorContent.Props, "phase" | "feedback">) =>
	match({
		phase,
		feedback,
	})
		.with(
			{
				phase: "exiting",
			},
			() => ({
				scale: 0.72,
				opacity: 0,
				filter: "brightness(1.14)",
				borderColor: "var(--ak-accent)",
				boxShadow: "0 0.5rem 1rem color-mix(in srgb, var(--ak-overlay) 18%, transparent)",
			}),
		)
		.with(
			{
				phase: "impact",
			},
			() => ({
				scale: 1.12,
				opacity: 1,
				filter: "brightness(1.12)",
				borderColor: "var(--ak-accent)",
				boxShadow: "0 1rem 2rem color-mix(in srgb, var(--ak-accent) 30%, transparent)",
			}),
		)
		.with(
			{
				phase: "dragging",
			},
			() => ({
				scale: 1.18,
				opacity: 1,
				filter: "brightness(1.08)",
				borderColor: "var(--ak-accent)",
				boxShadow:
					"0 1.35rem 2.5rem color-mix(in srgb, var(--ak-overlay) 58%, transparent)",
			}),
		)
		.with(
			{
				phase: "hovered",
			},
			() => ({
				scale: 1.15,
				opacity: 1,
				filter: "brightness(1.06)",
				borderColor: "var(--ak-line-strong)",
				boxShadow: "0 1rem 2rem color-mix(in srgb, var(--ak-overlay) 48%, transparent)",
			}),
		)
		.with(
			{
				phase: "targeted",
			},
			() => ({
				scale: 1.08,
				opacity: 1,
				filter: "brightness(1.08)",
				borderColor: "var(--ak-accent)",
				boxShadow: "0 0.9rem 1.8rem color-mix(in srgb, var(--ak-accent) 24%, transparent)",
			}),
		)
		.with(
			{
				phase: "settling",
				feedback: "rejected",
			},
			() => ({
				scale: 1.04,
				opacity: 1,
				filter: "brightness(1.03)",
				borderColor: "var(--ak-danger)",
				boxShadow: "0 0.75rem 1.5rem color-mix(in srgb, var(--ak-danger) 22%, transparent)",
			}),
		)
		.with(
			{
				phase: "settling",
				feedback: "accepted",
			},
			() => ({
				scale: 1.06,
				opacity: 1,
				filter: "brightness(1.06)",
				borderColor: "var(--ak-accent)",
				boxShadow: "0 0.8rem 1.6rem color-mix(in srgb, var(--ak-accent) 20%, transparent)",
			}),
		)
		.with(
			{
				phase: "settling",
			},
			() => settledVisualTarget,
		)
		.with(
			{
				phase: "stable",
			},
			() => settledVisualTarget,
		)
		.exhaustive();

/** Renders the exact live tile content inside one Motion-owned visual shell. */
export const TileActorContent = ({
	item,
	phase,
	feedback,
	onAnimationComplete,
}: TileActorContent.Props) => (
	<motion.span
		className="absolute inset-0 isolate overflow-hidden rounded-[22%] border bg-surface-raised/95"
		data-ui="TileActorVisual"
		data-motion-phase={phase}
		initial={false}
		animate={visualTarget({
			phase,
			feedback,
		})}
		transition={{
			type: "spring",
			stiffness: phase === "exiting" ? 620 : 520,
			damping: phase === "exiting" ? 44 : 34,
			mass: 0.55,
		}}
		onAnimationComplete={onAnimationComplete}
	>
		<img
			className="absolute inset-0 size-full object-cover"
			src={item.sourceUrl}
			alt=""
			draggable={false}
		/>
		{item.compositeUrl === undefined ? null : (
			<img
				className="absolute inset-0 size-full object-cover"
				src={item.compositeUrl}
				alt=""
				draggable={false}
			/>
		)}
		<span
			className="absolute inset-x-[6%] bottom-[6%] truncate rounded-md bg-overlay/75 px-[6%] py-[2%] font-medium text-overlay-foreground backdrop-blur-sm"
			data-ui="TileActorTitle"
		>
			{item.title}
		</span>
		{item.quantity > 1 ? (
			<span
				className="absolute right-[6%] top-[6%] rounded-full bg-overlay/85 px-[8%] py-[2%] font-bold text-overlay-foreground shadow"
				data-ui="TileActorQuantity"
			>
				{item.quantity}
			</span>
		) : null}
	</motion.span>
);
