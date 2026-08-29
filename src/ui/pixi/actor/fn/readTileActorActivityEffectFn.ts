import { P, match } from "ts-pattern";

import { TypeSchema } from "~/engine/item/schema/TypeSchema";

export namespace readTileActorActivityEffectFn {
	export interface Props {
		readonly itemType: TypeSchema.Type;
		readonly running: boolean;
	}
}

/** Restricts active-job particle feedback to product-facing line owners. */
export const readTileActorActivityEffectFn = ({
	itemType,
	running,
}: readTileActorActivityEffectFn.Props) =>
	match(itemType)
		.with(
			P.union(
				TypeSchema.enum.Blueprint,
				TypeSchema.enum.Craft,
				TypeSchema.enum.Deposit,
				TypeSchema.enum.Producer,
			),
			() => running,
		)
		.with(
			P.union(
				TypeSchema.enum.Inventory,
				TypeSchema.enum.Simple,
				TypeSchema.enum.Space,
				TypeSchema.enum.Stash,
				TypeSchema.enum.Temporary,
			),
			() => false,
		)
		.exhaustive();
