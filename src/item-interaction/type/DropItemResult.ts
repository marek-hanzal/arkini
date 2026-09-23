import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { BoardLocationSchema } from "~/item-location/schema/BoardLocationSchema";
import type { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import type { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";

export const DropItemResultKind = {
	Move: "move",
	Swap: "swap",
	Merge: "merge",
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
	readonly itemUid: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly location: BoardLocationSchema.Type;
}

interface DropMergedActor {
	readonly itemId: IdSchema.Type;
	readonly previousRevision: RevisionSchema.Type;
	readonly previousLocation: BoardLocationSchema.Type;
	readonly current: DropActorState | null;
}

interface DropMovedResult {
	readonly kind: typeof DropItemResultKind.Move;
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly previousLocation: BoardLocationSchema.Type;
	readonly location: BoardLocationSchema.Type;
}

interface DropSwappedActor {
	readonly itemId: IdSchema.Type;
	readonly revision: RevisionSchema.Type;
	readonly previousLocation: BoardLocationSchema.Type;
	readonly location: BoardLocationSchema.Type;
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
	readonly resultItemUid?: IdSchema.Type;
	readonly source: DropMergedActor;
	readonly target: DropMergedActor;
}

interface DropIgnoredResult {
	readonly kind: typeof DropItemResultKind.Ignored;
	readonly reason: DropItemIgnoredReason;
	readonly itemId: IdSchema.Type;
	readonly location: BoardLocationSchema.Type;
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
	| DropIgnoredResult
	| DropRejectedResult;
