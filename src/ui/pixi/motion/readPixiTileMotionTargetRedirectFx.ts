import { Effect } from "effect";
import { match } from "ts-pattern";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { runTileDropAtom } from "~/bridge/tile/runTileDropAtom";
import type { PixiTileMotionTargetRedirect } from "~/ui/pixi/motion/PixiTileMotionTargetRoute";

/**
 * Projects one committed drop into a presentation-only ownership handoff.
 *
 * A surviving source keeps its runtime identity and therefore needs no redirect. Only a source
 * consumed by an engine-confirmed receiver transfers trailing motion to that receiver.
 */
export const readPixiTileMotionTargetRedirectFx = Effect.fnUntraced(function* (
	result: runTileDropAtom.Result,
): Generator<never, PixiTileMotionTargetRedirect | null, never> {
	return match(result)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInventory,
			},
			(store) =>
				store.source.current === null
					? {
							sourceActorId: store.source.itemId,
							targetActorId: store.inventory.itemId,
							targetLocation: store.inventory.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.StoreInput,
			},
			(store) =>
				store.source.current === null
					? {
							sourceActorId: store.source.itemId,
							targetActorId: store.owner.itemId,
							targetLocation: store.owner.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Stack,
			},
			(stack) =>
				stack.source.current === null
					? {
							sourceActorId: stack.source.itemId,
							targetActorId: stack.target.current.itemId,
							targetLocation: stack.target.current.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Merge,
			},
			(merge) =>
				merge.source.current === null && merge.target.current !== null
					? {
							sourceActorId: merge.source.itemId,
							targetActorId: merge.target.current.itemId,
							targetLocation: merge.target.current.location,
						}
					: null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Move,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Swap,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Ignored,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKindEnumSchema.enum.Reject,
			},
			() => null,
		)
		.exhaustive();
});
