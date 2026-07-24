import { Effect, Option } from "effect";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

export namespace isLineOwnerItemFx {
	export type Result = Extract<
		ItemSchema.Type,
		{
			readonly type:
				| typeof ItemEnumSchema.enum.Blueprint
				| typeof ItemEnumSchema.enum.Craft
				| typeof ItemEnumSchema.enum.Producer
				| typeof ItemEnumSchema.enum.Stash;
		}
	>;
}

/** Narrows one canonical item to the exact variants that expose product lines. */
export const isLineOwnerItemFx = Effect.fn("isLineOwnerItemFx")(function* (item: ItemSchema.Type) {
	return Option.liftPredicate(
		item,
		(candidate): candidate is isLineOwnerItemFx.Result =>
			candidate.type === ItemEnumSchema.enum.Producer ||
			candidate.type === ItemEnumSchema.enum.Blueprint ||
			candidate.type === ItemEnumSchema.enum.Craft ||
			candidate.type === ItemEnumSchema.enum.Stash,
	);
});
