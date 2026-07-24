import { useMemo } from "react";
import { match } from "ts-pattern";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileInteractionState } from "~/ui/tile/TileInteractionState";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import { tileSlotForLocation } from "~/ui/tile/tileSlotForLocation";
import { tileSurfaceForLocation } from "~/ui/tile/tileSurfaceForLocation";
import { useTileActorInteraction } from "~/ui/tile/useTileActorInteraction";

export namespace useTileActorPresentation {
	export interface Model {
		readonly canonicalSource: TileDragSource;
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
		readonly zIndex: number;
	}
}

const actorSource = (item: useTileActors.Item): TileDragSource => ({
	id: item.id,
	revision: item.revision,
	location: item.location,
	surface: tileSurfaceForLocation(item.location),
	slot: tileSlotForLocation(item.location),
});

const feedbackForPreview = (
	previewKind:
		| Extract<
				TileInteractionState,
				{
					readonly phase: "dragging";
				}
		  >["previewKind"]
		| Extract<
				TileInteractionState,
				{
					readonly phase: "awaiting-outcome";
				}
		  >["previewKind"],
): TileInteractionFeedbackSchema.Type | null =>
	match(previewKind)
		.with(null, () => null)
		.with(DropItemResultKindEnumSchema.enum.Reject, () => "rejected" as const)
		.with(DropItemResultKindEnumSchema.enum.Ignored, () => "ignored" as const)
		.with(
			DropItemResultKindEnumSchema.enum.Move,
			DropItemResultKindEnumSchema.enum.Swap,
			DropItemResultKindEnumSchema.enum.StoreInput,
			DropItemResultKindEnumSchema.enum.Merge,
			DropItemResultKindEnumSchema.enum.Stack,
			() => "accepted" as const,
		)
		.exhaustive();

const activePresentation = (
	active: TileInteractionState | null,
	itemId: string,
): Omit<useTileActorPresentation.Model, "canonicalSource"> =>
	match(active)
		.with(null, () => ({
			phase: "stable" as const,
			feedback: null,
			forbiddenDrop: false,
			zIndex: 10,
		}))
		.with(
			{
				phase: "pressed",
			},
			() => ({
				phase: "stable" as const,
				feedback: null,
				forbiddenDrop: false,
				zIndex: 10,
			}),
		)
		.with(
			{
				phase: "dragging",
			},
			{
				phase: "awaiting-outcome",
			},
			(interaction) => {
				const feedback = feedbackForPreview(interaction.previewKind);
				if (interaction.source.id === itemId) {
					return {
						phase: "dragging" as const,
						feedback,
						forbiddenDrop: interaction.target?.kind !== "slot",
						zIndex: 40,
					};
				}
				return {
					phase: "targeted" as const,
					feedback,
					forbiddenDrop: false,
					zIndex: 25,
				};
			},
		)
		.exhaustive();

/** Derives immediate actor interaction state without animation-owned lifecycle stages. */
export const useTileActorPresentation = ({
	item,
}: {
	readonly item: useTileActors.Item;
}): useTileActorPresentation.Model => {
	const active = useTileActorInteraction(item.id);
	const canonicalSource = useMemo(
		() => actorSource(item),
		[
			item,
		],
	);
	const presentation = useMemo(
		() => activePresentation(active, item.id),
		[
			active,
			item.id,
		],
	);

	return {
		canonicalSource,
		...presentation,
	};
};
