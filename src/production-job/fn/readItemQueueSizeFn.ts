import { match, P } from "ts-pattern";

import type { PositiveIntegerSchema } from "~/game-value/schema/PositiveIntegerSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";

/** Reads the active-job queue capacity owned by one canonical line item. */
export const readItemQueueSizeFn = ({ item }: { readonly item: ItemSchema.Type }) =>
	match(item)
		.with(
			{
				type: P.union(TypeSchema.enum.Deposit, TypeSchema.enum.Producer),
			},
			({ maxQueueSize }) => maxQueueSize,
		)
		.with(
			{
				type: P.union(
					TypeSchema.enum.Blueprint,
					TypeSchema.enum.Craft,
					TypeSchema.enum.Stash,
				),
			},
			() => 1,
		)
		.otherwise(() => undefined) satisfies PositiveIntegerSchema.Type | undefined;
