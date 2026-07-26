import { Effect } from "effect";
import { P, match } from "ts-pattern";

import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace readTileActorRunningGlowFx {
	export interface Props {
		readonly itemType: ItemEnumSchema.Type;
		readonly running: boolean;
	}
}

/** Restricts active-job glow feedback to the three product-facing line owners. */
export const readTileActorRunningGlowFx = Effect.fn("readTileActorRunningGlowFx")(
	({ itemType, running }: readTileActorRunningGlowFx.Props) =>
		Effect.succeed(
			match(itemType)
				.with(
					P.union(
						ItemEnumSchema.enum.Blueprint,
						ItemEnumSchema.enum.Craft,
						ItemEnumSchema.enum.Producer,
					),
					() => running,
				)
				.with(
					P.union(
						ItemEnumSchema.enum.Deposit,
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
