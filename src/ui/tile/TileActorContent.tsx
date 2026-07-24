import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";

export namespace TileActorContent {
	export interface Props {
		readonly item: useTileActors.Item;
		readonly surfaceId: string;
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
	}
}

/** Renders one current tile face with immediate, non-animated interaction metadata. */
export const TileActorContent = ({
	item,
	surfaceId,
	phase,
	feedback,
	forbiddenDrop,
}: TileActorContent.Props) => (
	<span
		className="absolute inset-0 isolate overflow-hidden rounded-[var(--ak-tile-actor-radius)] bg-transparent"
		data-ui="TileActorVisual"
		data-surface-id={surfaceId}
		data-phase={phase}
		data-feedback={feedback ?? undefined}
		data-forbidden-drop={forbiddenDrop ? "true" : "false"}
		data-tile-quantity={item.quantity}
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
	</span>
);
