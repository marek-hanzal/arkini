import { Effect } from "effect";
import { P, match } from "ts-pattern";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readTileActorActivityEffectFx {
	export interface Props {
		readonly itemType: ItemEnumSchema.Type;
		readonly running: boolean;
	}
}

/** Restricts active-job particle feedback to product-facing line owners. */
export const readTileActorActivityEffectFx = Effect.fn("readTileActorActivityEffectFx")(
	({ itemType, running }: readTileActorActivityEffectFx.Props) =>
		Effect.succeed(
			match(itemType)
				.with(
					P.union(
						ItemEnumSchema.enum.Blueprint,
						ItemEnumSchema.enum.Craft,
						ItemEnumSchema.enum.Deposit,
						ItemEnumSchema.enum.Producer,
					),
					() => running,
				)
				.with(
					P.union(
						ItemEnumSchema.enum.Inventory,
						ItemEnumSchema.enum.Simple,
						ItemEnumSchema.enum.Stash,
						ItemEnumSchema.enum.Temporary,
					),
					() => false,
				)
				.exhaustive(),
		),
);
