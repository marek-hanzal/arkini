import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { InventoryOpenerUnavailableError } from "~/engine/runtime/error/InventoryOpenerUnavailableError";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readRuntimeInventoryOpenerFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type Result = GridRuntimeItemSchema.Type & {
		readonly location:
			| Extract<
					GridRuntimeItemSchema.Type["location"],
					{
						readonly scope: "board";
					}
			  >
			| Extract<
					GridRuntimeItemSchema.Type["location"],
					{
						readonly scope: "toolbar";
					}
			  >;
	};
}

/** Reads the singleton physical Inventory opener that owns release placement origins. */
export const readRuntimeInventoryOpenerFx = Effect.fn("readRuntimeInventoryOpenerFx")(function* ({
	itemId,
	runtime,
}: readRuntimeInventoryOpenerFx.Props) {
	const runtimeOpener = runtime.items.find(
		(candidate) => candidate.item.type === ItemEnumSchema.enum.Inventory,
	);
	const opener =
		runtimeOpener === undefined
			? undefined
			: Option.getOrUndefined(yield* isGridRuntimeItemFx(runtimeOpener));
	if (
		opener === undefined ||
		(opener.location.scope !== LocationScopeEnumSchema.enum.Board &&
			opener.location.scope !== LocationScopeEnumSchema.enum.Toolbar)
	) {
		return yield* Effect.fail(
			new InventoryOpenerUnavailableError({
				itemId,
			}),
		);
	}
	return {
		...opener,
		location: opener.location,
	} satisfies readRuntimeInventoryOpenerFx.Result;
});
