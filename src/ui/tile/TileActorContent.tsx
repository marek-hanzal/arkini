import { motion } from "motion/react";

import type { useTileActors } from "~/bridge/tile/useTileActors";

export namespace TileActorContent {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly phase: "stable" | "pressed" | "hovered" | "targeted" | "dragging" | "settling";
		readonly feedback: "accepted" | "rejected" | "ignored" | null;
	}
}

const visualTarget = ({ phase, feedback }: Pick<TileActorContent.Props, "phase" | "feedback">) => {
	if (phase === "dragging") {
		return {
			scale: 1.18,
			filter: "brightness(1.08)",
			borderColor: "var(--ak-accent)",
			boxShadow: "0 1.35rem 2.5rem color-mix(in srgb, var(--ak-overlay) 58%, transparent)",
		};
	}
	if (phase === "pressed") {
		return {
			scale: 1.1,
			filter: "brightness(1.05)",
			borderColor: "var(--ak-accent)",
			boxShadow: "0 0.8rem 1.6rem color-mix(in srgb, var(--ak-overlay) 42%, transparent)",
		};
	}
	if (phase === "hovered") {
		return {
			scale: 1.15,
			filter: "brightness(1.06)",
			borderColor: "var(--ak-line-strong)",
			boxShadow: "0 1rem 2rem color-mix(in srgb, var(--ak-overlay) 48%, transparent)",
		};
	}
	if (phase === "targeted") {
		return {
			scale: 1.08,
			filter: "brightness(1.08)",
			borderColor: "var(--ak-accent)",
			boxShadow: "0 0.9rem 1.8rem color-mix(in srgb, var(--ak-accent) 24%, transparent)",
		};
	}
	if (phase === "settling" && feedback === "rejected") {
		return {
			scale: 1.04,
			filter: "brightness(1.03)",
			borderColor: "var(--ak-danger)",
			boxShadow: "0 0.75rem 1.5rem color-mix(in srgb, var(--ak-danger) 22%, transparent)",
		};
	}
	if (phase === "settling" && feedback === "accepted") {
		return {
			scale: 1.06,
			filter: "brightness(1.06)",
			borderColor: "var(--ak-accent)",
			boxShadow: "0 0.8rem 1.6rem color-mix(in srgb, var(--ak-accent) 20%, transparent)",
		};
	}
	return {
		scale: 1,
		filter: "brightness(1)",
		borderColor: "var(--ak-line-strong)",
		boxShadow: "0 0.55rem 1.2rem color-mix(in srgb, var(--ak-overlay) 34%, transparent)",
	};
};

/** Renders the exact live tile content inside one Motion-owned visual shell. */
export const TileActorContent = ({ item, phase, feedback }: TileActorContent.Props) => (
	<motion.span
		className="absolute inset-0 isolate overflow-hidden rounded-[22%] border bg-surface-raised/95"
		data-ui="TileActorVisual"
		initial={false}
		animate={visualTarget({
			phase,
			feedback,
		})}
		transition={{
			type: "spring",
			stiffness: 520,
			damping: 34,
			mass: 0.55,
		}}
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
