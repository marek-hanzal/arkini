import { Option } from "effect";

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

export namespace narrowLineOwnerItemFn {
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
export const narrowLineOwnerItemFn = (
	item: ItemSchema.Type,
): Option.Option<narrowLineOwnerItemFn.Result> =>
	Option.liftPredicate(
		item,
		(candidate): candidate is narrowLineOwnerItemFn.Result =>
			candidate.type === TypeSchema.enum.Producer ||
			(candidate.type === TypeSchema.enum.Deposit && candidate.lines !== undefined) ||
			candidate.type === TypeSchema.enum.Blueprint ||
			candidate.type === TypeSchema.enum.Craft ||
			candidate.type === TypeSchema.enum.Stash,
	);
