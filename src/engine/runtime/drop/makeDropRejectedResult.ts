import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { DropItemRejectedReasonEnumSchema } from "~/engine/runtime/schema/command/DropItemRejectedReasonEnumSchema";
import type { DropItemResultSchema } from "~/engine/runtime/schema/command/DropItemResultSchema";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";

type RejectedDropResult = Extract<
	DropItemResultSchema.Type,
	{
		readonly kind: typeof DropItemResultKindEnumSchema.enum.Reject;
	}
>;

/** Normalizes an expected optimistic drop race into the public rejected result. */
export const makeDropRejectedResult = ({
	reason,
	sourceItemId,
	targetItemId,
}: {
	readonly reason: DropItemRejectedReasonEnumSchema.Type;
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId?: IdSchema.Type;
}): RejectedDropResult => ({
	kind: DropItemResultKindEnumSchema.enum.Reject,
	reason,
	itemId: sourceItemId,
	...(targetItemId === undefined
		? {}
		: {
				targetItemId,
			}),
});

/** Classifies one missing/revised actor against the captured drop pair. */
export const makeStaleDropRejectedResult = ({
	entityId,
	sourceItemId,
	targetItemId,
}: {
	readonly entityId: IdSchema.Type | undefined;
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
}) =>
	makeDropRejectedResult({
		reason:
			entityId === targetItemId
				? DropItemRejectedReasonEnumSchema.enum.StaleTarget
				: DropItemRejectedReasonEnumSchema.enum.StaleSource,
		sourceItemId,
		targetItemId,
	});

/** Classifies one actor that stopped being grid-addressable during commit. */
export const makeInvalidGridDropRejectedResult = ({
	itemId,
	sourceItemId,
	targetItemId,
}: {
	readonly itemId: IdSchema.Type | undefined;
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
}) =>
	makeDropRejectedResult({
		reason:
			itemId === targetItemId
				? DropItemRejectedReasonEnumSchema.enum.InvalidTarget
				: DropItemRejectedReasonEnumSchema.enum.InvalidSource,
		sourceItemId,
		targetItemId,
	});

/** Normalizes a valid-looking drop that became unavailable during its commit. */
export const makeBlockedDropRejectedResult = ({
	sourceItemId,
	targetItemId,
}: {
	readonly sourceItemId: IdSchema.Type;
	readonly targetItemId: IdSchema.Type;
}) =>
	makeDropRejectedResult({
		reason: DropItemRejectedReasonEnumSchema.enum.Blocked,
		sourceItemId,
		targetItemId,
	});
