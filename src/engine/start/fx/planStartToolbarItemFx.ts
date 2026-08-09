import { Effect } from "effect";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { planStartExactGridStackFx } from "~/engine/start/fx/planStartExactGridStackFx";
import type { ToolbarItemSchema } from "~/engine/start/schema/ToolbarItemSchema";

export namespace planStartToolbarItemFx {
	export interface Props {
		item: ToolbarItemSchema.Type;
	}
}

/** Plans one exact initial toolbar stack without fallback or location substitution. */
export const planStartToolbarItemFx = Effect.fn("planStartToolbarItemFx")(function* ({
	item: startItem,
}: planStartToolbarItemFx.Props) {
	return yield* planStartExactGridStackFx({
		itemId: startItem.itemId,
		location: {
			position: startItem.position,
			scope: LocationScopeEnumSchema.enum.Toolbar,
		},
		quantity: startItem.quantity ?? 1,
	});
});
