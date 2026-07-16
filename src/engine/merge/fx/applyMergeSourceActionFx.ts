import { Effect } from "effect";

import { ItemStatefulError } from "~/engine/item/error/ItemStatefulError";
import { isItemPureFx } from "~/engine/item/fx/purity/isItemPureFx";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import type { ActionEnumSchema } from "~/engine/merge/schema/ActionEnumSchema";
import type { DropResultSchema } from "~/engine/output/schema/DropResultSchema";
import { discardRuntimeItemOwnedStateFx } from "~/engine/runtime/fx/discardRuntimeItemOwnedStateFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyMergeSourceActionFx {
	export interface Props {
		action: ActionEnumSchema.Type;
		runtime: RuntimeSchema.Type;
		source: GridRuntimeItemSchema.Type;
	}

	export interface Result {
		returnDrop?: DropResultSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/** Detaches or consumes exactly one source quantity before the target effect. */
export const applyMergeSourceActionFx = Effect.fn("applyMergeSourceActionFx")(function* ({
	action,
	runtime,
	source,
}: applyMergeSourceActionFx.Props) {
	yield* assertOwnerIdleFx({
		ownerItemId: source.id,
		runtime,
	});

	if (action === "use") {
		const pure = yield* isItemPureFx({
			item: source,
			runtime,
		});
		if (!pure) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: source.id,
				}),
			);
		}
	}

	let draft: RuntimeSchema.Type;
	if (source.quantity > 1) {
		const remainingSource = yield* reviseRuntimeItemFx({
			item: {
				...source,
				quantity: source.quantity - 1,
			} satisfies GridRuntimeItemSchema.Type,
		});
		draft = {
			...runtime,
			items: runtime.items.map((item) => (item.id === source.id ? remainingSource : item)),
		};
	} else {
		const withoutOwnedState =
			action === "consume"
				? yield* discardRuntimeItemOwnedStateFx({
						ownerItemId: source.id,
						runtime,
					})
				: runtime;
		draft = yield* removeRuntimeItemIdentityFx({
			item: source,
			runtime: withoutOwnedState,
		});
	}

	return {
		returnDrop:
			action === "use"
				? {
						itemId: source.item.id,
						placement: "drop",
						quantity: 1,
					}
				: undefined,
		runtime: draft,
	} satisfies applyMergeSourceActionFx.Result;
});
