import { Effect, Option } from "effect";

import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";

export namespace isLineOwnerItemFx {
	type DepositItem = Extract<
		ItemSchema.Type,
		{
			readonly type: typeof TypeSchema.enum.Deposit;
		}
	>;

	export type Result =
		| Extract<
				ItemSchema.Type,
				{
					readonly type:
						| typeof TypeSchema.enum.Blueprint
						| typeof TypeSchema.enum.Craft
						| typeof TypeSchema.enum.Producer
						| typeof TypeSchema.enum.Stash;
				}
		  >
		| (DepositItem & {
				readonly lines: NonNullable<DepositItem["lines"]>;
		  });
}

/** Narrows one canonical item to the exact variants that expose product lines. */
export const isLineOwnerItemFx = Effect.fn("isLineOwnerItemFx")(function* (item: ItemSchema.Type) {
	return Option.liftPredicate(
		item,
		(candidate): candidate is isLineOwnerItemFx.Result =>
			candidate.type === TypeSchema.enum.Producer ||
			(candidate.type === TypeSchema.enum.Deposit && candidate.lines !== undefined) ||
			candidate.type === TypeSchema.enum.Blueprint ||
			candidate.type === TypeSchema.enum.Craft ||
			candidate.type === TypeSchema.enum.Stash,
	);
});
