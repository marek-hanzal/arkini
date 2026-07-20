import type { useDropItem } from "~/bridge/tile/useDropItem";
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
}

export interface TileAwaitingOutcomeInteraction extends TileInteractionBase {
	readonly phase: Extract<TileInteractionPhaseSchema.Type, "awaiting-outcome">;
	readonly target: TileDropTarget;
}

interface TileSettlementBase {
	readonly pendingActorIds: ReadonlyArray<string>;
	readonly feedback: TileInteractionFeedbackSchema.Type;
}

export interface TileFailedSettlement extends TileSettlementBase {
	readonly kind: "failed";
	readonly feedback: "rejected";
	readonly outcome: null;
}

export interface TileRejectedSettlement extends TileSettlementBase {
	readonly kind: "reject";
	readonly feedback: "rejected";
	readonly outcome: DropOutcome<"reject">;
}

export interface TileIgnoredSettlement extends TileSettlementBase {
	readonly kind: "ignored";
	readonly feedback: "ignored";
	readonly outcome: DropOutcome<"ignored">;
}

export interface TileMovedSettlement extends TileSettlementBase {
	readonly kind: "move";
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<"move">;
	readonly location: TileLocation;
}

export interface TileSwappedSettlement extends TileSettlementBase {
	readonly kind: "swap";
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<"swap">;
	readonly sourceLocation: TileLocation;
}

export interface TileMergeSettlement extends TileSettlementBase {
	readonly kind: "merge";
	readonly feedback: "accepted";
	readonly outcome: DropOutcome<"merge">;
	readonly stage: "approach" | "resolve";
}

export type TileSettlementState =
	| TileFailedSettlement
	| TileRejectedSettlement
	| TileIgnoredSettlement
	| TileMovedSettlement
	| TileSwappedSettlement
	| TileMergeSettlement;

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
