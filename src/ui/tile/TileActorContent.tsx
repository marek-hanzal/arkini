import { motion } from "motion/react";
import { match, P } from "ts-pattern";

import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import type { TileMotionCueSchema } from "~/ui/tile/schema/TileMotionCueSchema";
import { TileMotionCueVisual } from "~/ui/tile/TileMotionCueVisual";
import { readTileActorVisualTarget } from "~/ui/tile/readTileActorVisualTarget";

export namespace TileActorContent {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly registerActorNode: (node: HTMLSpanElement | null) => void;
		readonly surfaceId: string;
		readonly live: boolean;
		readonly exiting: boolean;
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
		readonly cue: TileMotionCueSchema.Type | null;
		readonly cueOriginOffset: { readonly x: number; readonly y: number } | null;
		readonly cueTargetOffset: { readonly x: number; readonly y: number } | null;
		readonly onCueStart: (generation: number) => void;
		readonly onCueComplete: (generation: number) => void;
		readonly onInteractionAnimationComplete?: () => void;
	}
}

const TileActorFace = ({
	item,
	quantity,
}: {
	readonly item: useTileActors.Item;
	readonly quantity: number;
}) => (
	<span
		className="absolute inset-0 isolate overflow-hidden rounded-[inherit]"
		data-ui="TileActorFace"
		data-tile-quantity={quantity}
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
		{quantity > 1 ? (
			<span
				className="absolute right-[6%] top-[6%] rounded-full bg-overlay/85 px-[8%] py-[2%] font-bold text-overlay-foreground shadow"
				data-ui="TileActorQuantity"
			>
				{quantity}
			</span>
		) : null}
	</span>
);

/** Renders the exact live tile content inside independent interaction and cue shells. */
export const TileActorContent = ({
	item,
	registerActorNode,
	surfaceId,
	live,
	exiting,
	phase,
	feedback,
	forbiddenDrop,
	cue,
	cueOriginOffset,
	cueTargetOffset,
	onCueStart,
	onCueComplete,
	onInteractionAnimationComplete,
}: TileActorContent.Props) => {
	const cueMode: TileMotionCueVisual.Mode =
		cue === null
			? "defer"
			: match({ phase, kind: cue.kind })
					.with(
						{ phase: "exiting" },
						() => "discard" as const,
					)
					.with(
						{ kind: P.union("exit", "consume-exit") },
						() => "play" as const,
					)
					.with(
						{ phase: P.union("stable", "hovered", "targeted") },
						() => "play" as const,
					)
					.with(
						{ phase: P.union("dragging", "combining", "settling", "impact") },
						() => "defer" as const,
					)
					.exhaustive();

	return (
		<motion.span
			className="absolute inset-0 isolate overflow-visible rounded-[var(--ak-tile-actor-radius)] bg-transparent"
			data-ui="TileActorVisual"
			data-motion-phase={phase}
			initial={false}
			animate={readTileActorVisualTarget({
				phase,
				feedback,
				forbiddenDrop,
			})}
			transition={{
				type: "spring",
				stiffness: phase === "exiting" ? 225 : 190,
				damping: phase === "exiting" ? 25 : 22,
				mass: 0.62,
			}}
			onAnimationComplete={onInteractionAnimationComplete}
		>
			<TileMotionCueVisual
				registerActorNode={registerActorNode}
				surfaceId={surfaceId}
				live={live}
				exiting={exiting}
				cue={cue}
				deliveryPayload={
					cue?.kind === "absorb" && cue.deliveryQuantity !== undefined ? (
						<TileActorFace item={item} quantity={cue.deliveryQuantity} />
					) : null
				}
				transferPayload={
					cue?.kind === "consume" &&
					cue.previousQuantity !== undefined &&
					cue.previousQuantity !== item.quantity ? (
						<TileActorFace item={item} quantity={cue.previousQuantity} />
					) : null
				}
				mode={cueMode}
				originOffset={cueOriginOffset}
				targetOffset={cueTargetOffset}
				onStart={onCueStart}
				onComplete={onCueComplete}
			>
				<TileActorFace item={item} quantity={item.quantity} />
			</TileMotionCueVisual>
		</motion.span>
	);
};
