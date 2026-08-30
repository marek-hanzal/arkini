import { match } from "ts-pattern";

import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { runTileDropAtom } from "~/ui/pixi/command/runTileDropAtom";
import type { MotionRedirect } from "~/tile-motion/type/MotionTarget";

/**
 * Projects one committed drop into a presentation-only ownership handoff.
 *
 * A surviving source keeps its runtime identity and therefore needs no redirect. Only a source
 * consumed by an engine-confirmed receiver transfers trailing motion to that receiver.
 */
export const readTargetRedirectFn = (result: runTileDropAtom.Result): MotionRedirect | null => {
	return match(result)
		.with(
			{
				kind: DropItemResultKind.StoreInventory,
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
				kind: DropItemResultKind.StoreInput,
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
				kind: DropItemResultKind.Stack,
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
				kind: DropItemResultKind.Merge,
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
				kind: DropItemResultKind.Move,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKind.Swap,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKind.Ignored,
			},
			() => null,
		)
		.with(
			{
				kind: DropItemResultKind.Reject,
			},
			() => null,
		)
		.exhaustive();
};
