import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/production-output/schema/drop/rule/TypeSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { PlacementSchema } from "~/item-placement/schema/PlacementSchema";
import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/game-config/schema/PositiveIntegerSchema";
import { dropRuleFx } from "./dropRuleFx";
import { rollQuantityFx } from "./rollQuantityFx";

interface Props {
	readonly drop: DropSchema.Type;
	readonly origin: GridLocationSchema.Type;
}

export namespace dropFx {
	export interface Result {
		readonly itemId: IdSchema.Type;
		readonly quantity: PositiveIntegerSchema.Type;
		readonly placement: PlacementSchema.Type;
	}
}

/**
 * Resolves one selected drop into one concrete result or undefined.
 *
 * Availability rules run before quantity resolution. The drop owns the
 * consumer-specific interpretation of neutral rule results. A rejected drop is
 * discarded without consuming quantity randomness, rerolling, or selecting a
 * replacement candidate.
 */
export const dropFx = Effect.fn("dropFx")(function* ({ drop, origin }: Props) {
	let enabled = true;
	for (const rule of drop.rules) {
		const ruleEnabled = yield* dropRuleFx({
			origin,
			rule,
		}).pipe(
			Effect.map((result) =>
				match(result)
					.with(
						{
							type: TypeSchema.enum.Enable,
						},
						({ active }) => active,
					)
					.with(
						{
							type: TypeSchema.enum.Disable,
						},
						({ active }) => !active,
					)
					.exhaustive(),
			),
		);
		if (!ruleEnabled) {
			enabled = false;
			break;
		}
	}
	if (!enabled) {
		return undefined;
	}

	const quantity = yield* rollQuantityFx({
		quantity: drop.quantity,
	});

	return {
		itemId: drop.itemId,
		placement: drop.placement,
		quantity,
	} satisfies dropFx.Result;
});
