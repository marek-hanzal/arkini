import { Effect } from "effect";
import { match } from "ts-pattern";

import { TypeSchema } from "~/engine/output/schema/drop/rule/TypeSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { DropResolutionSchema } from "~/engine/output/schema/DropResolutionSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import { rollQuantityFx } from "~/engine/quantity/fx/rollQuantityFx";

import { dropRuleFx } from "./dropRuleFx";

export namespace dropFx {
	export interface Props {
		drop: DropSchema.Type;
		origin: GridLocationSchema.Type;
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
export const dropFx = Effect.fn("dropFx")(function* ({ drop, origin }: dropFx.Props) {
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
	} satisfies DropResolutionSchema.Type;
});
