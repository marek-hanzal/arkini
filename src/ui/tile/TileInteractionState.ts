import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { useDropItem } from "~/bridge/tile/useDropItem";
import type { useDropItemPreview } from "~/bridge/tile/useDropItemPreview";
import type { TileLocation } from "~/bridge/tile/TileLocation";
import type { TileDragSource } from "~/ui/tile/TileDragSource";
import type { TileDropTarget } from "~/ui/tile/TileDropTarget";
import type { TileInteractionFeedbackSchema } from "~/ui/tile/schema/TileInteractionFeedbackSchema";
import type { TileInteractionPhaseSchema } from "~/ui/tile/schema/TileInteractionPhaseSchema";

type DropOutcome<Kind extends useDropItem.Result["kind"]> = Extract<
	useDropItem.Result,
	{
		readonly kind: Kind;
	}
>;

interface TileInteractionBase {
	readonly source: TileDragSource;
	readonly generation: number;
}

export interface TilePressedInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "pressed">;
}

export interface TileDraggingInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "dragging">;
	readonly target: TileDropTarget | null;
	readonly previewKind: useDropItemPreview.Result["kind"] | null;
}

export interface TileAwaitingOutcomeInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "awaiting-outcome">;
	readonly target: TileDropTarget;
	readonly previewKind: useDropItemPreview.Result["kind"] | null;
}

interface TileSettlementBase {
	readonly pendingActorIds: ReadonlyArray<string>;
	readonly feedback: TileInteractionFeedbackSchema.Type;
}

export interface TileFailedSettlement extends TileSettlementBase {
	readonly kind: "failed";
	readonly feedback: "rejected";
	readonly outcome: null;
	readonly target: TileDropTarget;
}

export interface TileRejectedSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.Reject;
	readonly feedback: "rejected";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.Reject>;
	readonly target: TileDropTarget;
}

export interface TileIgnoredSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.Ignored;
	readonly feedback: "ignored";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.Ignored>;
}

export interface TileMovedSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.Move;
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.Move>;
	readonly location: TileLocation;
}

export interface TileSwappedSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.Swap;
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.Swap>;
	readonly sourceLocation: TileLocation;
}

export interface TileStoreInputSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.StoreInput;
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.StoreInput>;
	readonly stage: "approach" | "resolve";
}

export interface TileMergeSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.Merge;
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.Merge>;
	readonly stage: "approach" | "resolve";
}

export interface TileStackSettlement extends TileSettlementBase {
	readonly kind: typeof DropItemResultKindEnumSchema.enum.Stack;
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<typeof DropItemResultKindEnumSchema.enum.Stack>;
	readonly stage: "approach" | "resolve";
}

export type TileSettlementState =
	| TileFailedSettlement
	| TileRejectedSettlement
	| TileIgnoredSettlement
	| TileMovedSettlement
	| TileSwappedSettlement
	| TileStoreInputSettlement
	| TileMergeSettlement
	| TileStackSettlement;

export interface TileSettlingInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "settling">;
	readonly settlement: TileSettlementState;
}

/** Arkini-owned presentation state for the one active tile gesture or settlement. */
export type TileInteractionState =
	| TilePressedInteraction
	| TileDraggingInteraction
	| TileAwaitingOutcomeInteraction
	| TileSettlingInteraction;
