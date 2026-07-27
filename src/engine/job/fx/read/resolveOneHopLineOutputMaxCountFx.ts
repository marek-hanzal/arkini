import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { readOutputConditionalMaximumQuantitiesFx } from "~/engine/output/fx/readOutputConditionalMaximumQuantitiesFx";
import { readOutputMaximumQuantitiesFx } from "~/engine/output/fx/readOutputMaximumQuantitiesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import type { OutputMaxCountBlock } from "./resolveOutputMaxCountFx";
import { readDefinitionLineNetMaximumOutputQuantitiesFx } from "./readDefinitionLineNetMaximumOutputQuantitiesFx";
import { resolveDirectLineOutputMaxCountFx } from "./resolveDirectLineOutputMaxCountFx";

export interface OneHopLineOutputMaxCountBlock extends OutputMaxCountBlock {
	readonly intermediateItemId: IdSchema.Type;
}

export namespace resolveOneHopLineOutputMaxCountFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly netOutput?: ReadonlyMap<IdSchema.Type, number>;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Checks exactly one blueprint intermediate hop.
 *
 * Blueprint is the authored purpose-bound intermediate contract. Ordinary
 * materials and other multi-purpose line owners are deliberately not traversed.
 */
export const resolveOneHopLineOutputMaxCountFx = Effect.fn("resolveOneHopLineOutputMaxCountFx")(
	function* ({ line, netOutput, runtime }: resolveOneHopLineOutputMaxCountFx.Props) {
		if (line.output === undefined) return undefined;
		const produced = yield* readOutputMaximumQuantitiesFx({
			output: line.output,
		});
		const netAdjustments = new Map<IdSchema.Type, number>();
		if (netOutput !== undefined) {
			for (const itemId of new Set([
				...produced.keys(),
				...netOutput.keys(),
			])) {
				const adjustment = (netOutput.get(itemId) ?? 0) - (produced.get(itemId) ?? 0);
				if (adjustment !== 0) netAdjustments.set(itemId, adjustment);
			}
		}

		for (const intermediateItemId of [
			...produced.keys(),
		].sort()) {
			const intermediate = yield* resolveItemFx({
				itemId: intermediateItemId,
			});
			if (intermediate.type !== ItemEnumSchema.enum.Blueprint) continue;
			const owner = Option.getOrUndefined(yield* isLineOwnerItemFx(intermediate));
			if (owner === undefined) continue;
			const applicable = (yield* readLineOwnerLinesFx(owner)).filter(
				(candidate) => candidate.show && candidate.enable,
			);
			if (applicable.length === 0) continue;
			const branchReserved = yield* readOutputConditionalMaximumQuantitiesFx({
				output: line.output,
				requiredItemId: intermediateItemId,
			});
			if (branchReserved === undefined) continue;
			for (const [itemId, adjustment] of netAdjustments) {
				const quantity = (branchReserved.get(itemId) ?? 0) + adjustment;
				if (quantity <= 0) branchReserved.delete(itemId);
				else branchReserved.set(itemId, quantity);
			}

			let firstBlock: OutputMaxCountBlock | undefined;
			let everyApplicableLineBlocked = true;
			for (const candidate of applicable) {
				const netOutput = yield* readDefinitionLineNetMaximumOutputQuantitiesFx({
					line: candidate,
					owner: intermediate,
				});
				const block = yield* resolveDirectLineOutputMaxCountFx({
					additionalReserved: branchReserved,
					line: candidate,
					netOutput,
					runtime,
				});
				if (block === undefined) {
					everyApplicableLineBlocked = false;
					break;
				}
				firstBlock ??= block;
			}
			if (everyApplicableLineBlocked && firstBlock !== undefined) {
				return {
					...firstBlock,
					intermediateItemId,
				} satisfies OneHopLineOutputMaxCountBlock;
			}
		}
		return undefined;
	},
);
