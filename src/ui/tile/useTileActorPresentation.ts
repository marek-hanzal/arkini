import { Effect } from "effect";
import { useMemo } from "react";
import { match } from "ts-pattern";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import { tileSlotForLocationFx } from "~/ui/tile/tileSlotForLocationFx";
import { tileSurfaceForLocationFx } from "~/ui/tile/tileSurfaceForLocationFx";
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

/** Derives immediate actor interaction state without animation-owned lifecycle stages. */
export const useTileActorPresentation = ({
	item,
}: {
	readonly item: useTileActors.Item;
}): useTileActorPresentation.Model => {
	const active = useTileActorInteraction(item.id);
	const canonicalSource = useMemo(
		(): TileDragSource => ({
			id: item.id,
			revision: item.revision,
			location: item.location,
			surface: Effect.runSync(tileSurfaceForLocationFx(item.location)),
			slot: Effect.runSync(tileSlotForLocationFx(item.location)),
		}),
		[
			item,
		],
	);
	const presentation = useMemo(
		(): Omit<useTileActorPresentation.Model, "canonicalSource"> =>
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
						const feedback: TileInteractionFeedbackSchema.Type | null = match(
							interaction.previewKind,
						)
							.with(null, () => null)
							.with(
								DropItemResultKindEnumSchema.enum.Reject,
								() => "rejected" as const,
							)
							.with(
								DropItemResultKindEnumSchema.enum.Ignored,
								() => "ignored" as const,
							)
							.with(
								DropItemResultKindEnumSchema.enum.Move,
								DropItemResultKindEnumSchema.enum.Swap,
								DropItemResultKindEnumSchema.enum.StoreInput,
								DropItemResultKindEnumSchema.enum.Merge,
								DropItemResultKindEnumSchema.enum.Stack,
								() => "accepted" as const,
							)
							.exhaustive();
						if (interaction.source.id === item.id) {
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
				.exhaustive(),
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
