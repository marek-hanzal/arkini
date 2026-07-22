import { useMemo, useState } from "react";
import { match } from "ts-pattern";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useTileActors } from "~/bridge/tile/useTileActors";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileInteractionState, TileSettlingInteraction } from "~/ui/tile/TileInteractionState";
import type { TileActorPhaseSchema } from "~/ui/tile/schema/TileActorPhaseSchema";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import { tileSlotForLocation } from "~/ui/tile/tileSlotForLocation";
import { tileSurfaceForLocation } from "~/ui/tile/tileSurfaceForLocation";
import { useTileActorSystem } from "~/ui/tile/useTileActorSystem";

export namespace useTileActorPresentation {
	export type PositionCompletion =
		| {
				readonly kind: "none";
		  }
		| {
				readonly kind: "always";
				readonly generation: number;
		  }
		| {
				readonly kind: "location";
				readonly generation: number;
				readonly location: TileLocation;
		  };

	export interface Model {
		readonly canonicalSource: TileDragSource;
		readonly desiredSource: TileDragSource;
		readonly phase: TileActorPhaseSchema.Type;
		readonly feedback: TileInteractionFeedbackSchema.Type | null;
		readonly forbiddenDrop: boolean;
		readonly zIndex: number;
		readonly placementFrozen: boolean;
		readonly positionCompletion: PositionCompletion;
		readonly visualCompletionGeneration: number | null;
		readonly hovered: boolean;
		readonly setHovered: (hovered: boolean) => void;
	}
}

interface TileActorPresentationView {
	readonly desiredLocation: TileLocation;
	readonly phase: TileActorPhaseSchema.Type;
	readonly feedback: TileInteractionFeedbackSchema.Type | null;
	readonly forbiddenDrop: boolean;
	readonly placementFrozen: boolean;
	readonly positionCompletion: useTileActorPresentation.PositionCompletion;
	readonly visualCompletionGeneration: number | null;
}

const actorSource = (item: useTileActors.Item, location: TileLocation): TileDragSource => ({
	id: item.id,
	revision: item.revision,
	location,
	surface: tileSurfaceForLocation(location),
	slot: tileSlotForLocation(location),
});

const zIndexForPhase = (phase: TileActorPhaseSchema.Type) =>
	match(phase)
		.with("dragging", () => 40)
		.with("combining", () => 35)
		.with("settling", "impact", "exiting", () => 30)
		.with("targeted", () => 25)
		.with("hovered", () => 20)
		.with("stable", () => 10)
		.exhaustive();

const passiveView = (
	item: useTileActors.Item,
	live: boolean,
	hovered: boolean,
): TileActorPresentationView => ({
	desiredLocation: item.location,
	phase: live && hovered ? "hovered" : "stable",
	feedback: null,
	forbiddenDrop: false,
	placementFrozen: false,
	positionCompletion: {
		kind: "none",
	},
	visualCompletionGeneration: null,
});

const settlingView = (
	settling: TileSettlingInteraction,
	item: useTileActors.Item,
	passive: TileActorPresentationView,
): TileActorPresentationView =>
	match(settling.settlement)
		.with(
			{
				kind: "failed",
			},
			{
				kind: DropItemResultKindEnumSchema.enum.Reject,
			},
			{
				kind: DropItemResultKindEnumSchema.enum.Ignored,
			},
			(settlement) => {
				if (settling.source.id === item.id) {
					return {
						...passive,
						phase: "settling" as const,
						feedback: settlement.feedback,
						positionCompletion: {
							kind: "location" as const,
							generation: settling.generation,
							location: item.location,
						},
					};
				}
				if (
					"target" in settlement &&
					settlement.target.kind === "slot" &&
					settlement.target.occupant?.id === item.id
				) {
					return {
						...passive,
						phase: "settling" as const,
						feedback: settlement.feedback,
					};
				}
				return passive;
			},
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Move,
			},
			(settlement) =>
				settling.source.id === item.id
					? {
							...passive,
							desiredLocation: settlement.location,
							phase: "settling" as const,
							feedback: settlement.feedback,
							positionCompletion: {
								kind: "location" as const,
								generation: settling.generation,
								location: settlement.location,
							},
						}
					: passive,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Swap,
			},
			(settlement) => {
				let location: TileLocation | null = null;
				if (settlement.outcome.source.itemId === item.id) {
					location = settlement.sourceLocation;
				} else if (settlement.outcome.target.itemId === item.id) {
					location = settlement.outcome.target.location;
				}
				if (location === null) return passive;
				return {
					...passive,
					desiredLocation: location,
					phase: "settling" as const,
					feedback: settlement.feedback,
					positionCompletion: {
						kind: "location" as const,
						generation: settling.generation,
						location,
					},
				};
			},
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
				stage: "approach",
			},
			(settlement) => {
				const targetLocation = settlement.outcome.owner.location;
				if (settlement.outcome.source.itemId === item.id) {
					return {
						...passive,
						desiredLocation: targetLocation,
						phase: "combining" as const,
						feedback: settlement.feedback,
						positionCompletion: {
							kind: "always" as const,
							generation: settling.generation,
						},
					};
				}
				return settlement.outcome.owner.itemId === item.id
					? {
							...passive,
							phase: "combining" as const,
							feedback: settlement.feedback,
						}
					: passive;
			},
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
				stage: "resolve",
			},
			(settlement) => {
				if (!settlement.pendingActorIds.includes(item.id)) return passive;
				if (settlement.outcome.source.itemId === item.id) {
					const current = settlement.outcome.source.current;
					if (current === null) {
						return {
							...passive,
							desiredLocation: settlement.outcome.owner.location,
							phase: "exiting" as const,
							feedback: settlement.feedback,
							visualCompletionGeneration: settling.generation,
						};
					}
					return {
						...passive,
						desiredLocation: current.location,
						phase: "settling" as const,
						feedback: settlement.feedback,
						positionCompletion: {
							kind: "location" as const,
							generation: settling.generation,
							location: current.location,
						},
					};
				}
				return settlement.outcome.owner.itemId === item.id
					? {
							...passive,
							phase: "impact" as const,
							feedback: settlement.feedback,
							visualCompletionGeneration: settling.generation,
						}
					: passive;
			},
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Merge,
				stage: "approach",
			},
			(settlement) => {
				const targetLocation =
					settlement.outcome.target.current?.location ??
					settlement.outcome.target.previousLocation;
				if (settlement.outcome.source.itemId === item.id) {
					return {
						...passive,
						desiredLocation: targetLocation,
						phase: "combining" as const,
						feedback: settlement.feedback,
						positionCompletion: {
							kind: "always" as const,
							generation: settling.generation,
						},
					};
				}
				return settlement.outcome.target.itemId === item.id
					? {
							...passive,
							phase: "combining" as const,
							feedback: settlement.feedback,
						}
					: passive;
			},
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Merge,
				stage: "resolve",
			},
			(settlement) => {
				if (!settlement.pendingActorIds.includes(item.id)) return passive;
				const targetLocation =
					settlement.outcome.target.current?.location ??
					settlement.outcome.target.previousLocation;
				if (settlement.outcome.source.itemId === item.id) {
					const current = settlement.outcome.source.current;
					if (current === null) {
						return {
							...passive,
							desiredLocation: targetLocation,
							phase: "exiting" as const,
							feedback: settlement.feedback,
							visualCompletionGeneration: settling.generation,
						};
					}
					return {
						...passive,
						desiredLocation: current.location,
						phase: "settling" as const,
						feedback: settlement.feedback,
						positionCompletion: {
							kind: "location" as const,
							generation: settling.generation,
							location: current.location,
						},
					};
				}
				if (settlement.outcome.target.itemId !== item.id) return passive;
				const current = settlement.outcome.target.current;
				return {
					...passive,
					desiredLocation: current?.location ?? targetLocation,
					phase: current === null ? ("exiting" as const) : ("impact" as const),
					feedback: settlement.feedback,
					visualCompletionGeneration: settling.generation,
				};
			},
		)
		.exhaustive();

const interactionView = (
	active: TileInteractionState | null,
	item: useTileActors.Item,
	passive: TileActorPresentationView,
): TileActorPresentationView =>
	match(active)
		.with(null, () => passive)
		.with(
			{
				phase: "pressed",
			},
			(pressed) =>
				pressed.source.id === item.id
					? {
							...passive,
							placementFrozen: true,
						}
					: passive,
		)
		.with(
			{
				phase: "dragging" as const,
			},
			(dragging) => {
				const acceptsInteraction =
					dragging.previewKind === DropItemResultKindEnumSchema.enum.Merge ||
					dragging.previewKind === DropItemResultKindEnumSchema.enum.StoreInput;
				const occupied =
					dragging.target?.kind === "slot" && dragging.target.occupant !== null;
				if (dragging.source.id === item.id) {
					return {
						...passive,
						phase: "dragging" as const,
						feedback: acceptsInteraction
							? ("accepted" as const)
							: occupied
								? ("ignored" as const)
								: dragging.previewKind === DropItemResultKindEnumSchema.enum.Reject
									? ("rejected" as const)
									: null,
						forbiddenDrop: dragging.target?.kind !== "slot",
						placementFrozen: true,
					};
				}
				if (
					acceptsInteraction &&
					dragging.target?.kind === "slot" &&
					dragging.target.occupant?.id === item.id
				) {
					return {
						...passive,
						phase: "combining" as const,
						feedback: "accepted" as const,
					};
				}
				return passive;
			},
		)
		.with(
			{
				phase: "awaiting-outcome",
			},
			(awaiting) => {
				const acceptsInteraction =
					awaiting.previewKind === DropItemResultKindEnumSchema.enum.Merge ||
					awaiting.previewKind === DropItemResultKindEnumSchema.enum.StoreInput;
				const occupied = awaiting.target.kind === "slot" && awaiting.target.occupant !== null;
				if (awaiting.source.id === item.id) {
					return {
						...passive,
						phase: "dragging" as const,
						feedback: acceptsInteraction
							? ("accepted" as const)
							: occupied
								? ("ignored" as const)
								: awaiting.previewKind === DropItemResultKindEnumSchema.enum.Reject
									? ("rejected" as const)
									: null,
						forbiddenDrop: awaiting.target.kind !== "slot",
						placementFrozen: true,
					};
				}
				if (
					acceptsInteraction &&
					awaiting.target.kind === "slot" &&
					awaiting.target.occupant?.id === item.id
				) {
					return {
						...passive,
						phase: "combining" as const,
						feedback: "accepted" as const,
						placementFrozen: true,
					};
				}
				return passive;
			},
		)
		.with(
			{
				phase: "settling" as const,
			},
			(settling) => settlingView(settling, item, passive),
		)
		.exhaustive();

/** Derives one exhaustive actor-owned presentation view from the shared interaction vocabulary. */
export const useTileActorPresentation = ({
	item,
	live,
}: {
	readonly item: useTileActors.Item;
	readonly live: boolean;
}): useTileActorPresentation.Model => {
	const { active } = useTileActorSystem();
	const [hovered, setHovered] = useState(false);
	const canonicalSource = useMemo(
		() => actorSource(item, item.location),
		[
			item,
		],
	);
	const view = useMemo(
		() => interactionView(active, item, passiveView(item, live, hovered)),
		[
			active,
			hovered,
			item,
			live,
		],
	);
	const desiredSource = useMemo(
		() => actorSource(item, view.desiredLocation),
		[
			item,
			view.desiredLocation,
		],
	);

	return {
		canonicalSource,
		desiredSource,
		phase: view.phase,
		feedback: view.feedback,
		forbiddenDrop: view.forbiddenDrop,
		zIndex: zIndexForPhase(view.phase),
		placementFrozen: view.placementFrozen,
		positionCompletion: view.positionCompletion,
		visualCompletionGeneration: view.visualCompletionGeneration,
		hovered,
		setHovered,
	};
};
