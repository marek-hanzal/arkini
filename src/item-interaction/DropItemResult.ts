import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import type { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";

export const DropItemResultKind = {
	Move: "move",
	Swap: "swap",
	Merge: "merge",
	StoreInventory: "store-inventory",
	StoreInput: "store-input",
	Stack: "stack",
	Ignored: "ignored",
	Reject: "reject",
} as const;

export const DropItemIgnoredReason = {
	SameLocation: "same-location",
} as const;

export type DropItemIgnoredReason =
	(typeof DropItemIgnoredReason)[keyof typeof DropItemIgnoredReason];

export const DropItemRejectedReason = {
	UnsupportedTarget: "unsupported-target",
	Occupied: "occupied",
	Blocked: "blocked",
	StaleSource: "stale-source",
	StaleTarget: "stale-target",
	InvalidSource: "invalid-source",
	InvalidTarget: "invalid-target",
} as const;

export type DropItemRejectedReason =
	(typeof DropItemRejectedReason)[keyof typeof DropItemRejectedReason];

interface DropActorState {
	readonly itemId: IdSchema.Type;
	readonly canonicalItemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly location: GridLocationSchema.Type;
	readonly quantity: PositiveIntegerSchema.Type;
}

interface DropTransferredActor {
	readonly itemId: IdSchema.Type;
	readonly canonicalItemId: IdSchema.Type;
	readonly previousRevision: RevisionSchema.Type;
	readonly previousLocation: GridLocationSchema.Type;
	readonly previousQuantity: PositiveIntegerSchema.Type;
	readonly current: DropActorState | null;
}

type DropMergedActor = Omit<DropTransferredActor, "canonicalItemId">;

interface DropMovedResult {
	readonly kind: typeof DropItemResultKind.Move;
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly previousLocation: GridLocationSchema.Type;
	readonly location: GridLocationSchema.Type;
}

interface DropSwappedActor {
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly previousLocation: GridLocationSchema.Type;
	readonly location: GridLocationSchema.Type;
}

interface DropSwappedResult {
	readonly kind: typeof DropItemResultKind.Swap;
	readonly source: DropSwappedActor;
	readonly target: DropSwappedActor;
}

interface DropMergedResult {
	readonly kind: typeof DropItemResultKind.Merge;
	readonly action: SourceActionSchema.Type;
	readonly effect: TargetEffectSchema.Type;
	readonly resultCanonicalItemId?: IdSchema.Type;
	readonly source: DropMergedActor;
	readonly target: DropMergedActor;
}

interface DropStoredInputResult {
	readonly kind: typeof DropItemResultKind.StoreInput;
	readonly storedQuantity: PositiveIntegerSchema.Type;
	readonly lineId: IdSchema.Type;
	readonly inputIndex: NonNegativeIntegerSchema.Type;
	readonly source: DropTransferredActor;
	readonly owner: {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly location: GridLocationSchema.Type;
	};
}

interface DropStoredInventoryResult {
	readonly kind: typeof DropItemResultKind.StoreInventory;
	readonly source: DropTransferredActor;
	readonly inventory: {
		readonly itemId: IdSchema.Type;
		readonly revision: RevisionSchema.Type;
		readonly location: GridLocationSchema.Type;
	};
}

interface DropStackedResult {
	readonly kind: typeof DropItemResultKind.Stack;
	readonly transferredQuantity: PositiveIntegerSchema.Type;
	readonly source: DropTransferredActor;
	readonly target: Omit<DropTransferredActor, "current"> & {
		readonly current: DropActorState;
	};
}

interface DropIgnoredResult {
	readonly kind: typeof DropItemResultKind.Ignored;
	readonly reason: DropItemIgnoredReason;
	readonly itemId: IdSchema.Type;
	readonly location: GridLocationSchema.Type;
}

interface DropRejectedResult {
	readonly kind: typeof DropItemResultKind.Reject;
	readonly reason: DropItemRejectedReason;
	readonly itemId: IdSchema.Type;
	readonly targetItemId?: IdSchema.Type;
}

/** Explicit interaction outcome for one attempted item drop. */
export type DropItemResult =
	| DropMovedResult
	| DropSwappedResult
	| DropMergedResult
	| DropStoredInventoryResult
	| DropStoredInputResult
	| DropStackedResult
	| DropIgnoredResult
	| DropRejectedResult;
