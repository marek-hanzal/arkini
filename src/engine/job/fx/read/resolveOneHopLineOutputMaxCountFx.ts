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
import { readReservedJobOutputQuantitiesFx } from "./readReservedJobOutputQuantitiesFx";
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
		const activeReservations = yield* readReservedJobOutputQuantitiesFx({
			runtime,
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
			/*
			 * Every idle Blueprint and every pending Blueprint output is one future
			 * execution of its purpose-bound line. Active Blueprint owners are
			 * represented by their job output reservation instead of being counted
			 * twice as both a live Blueprint and a future target.
			 */
			const activeJobCountByBlueprintOwnerId = new Map<IdSchema.Type, number>();
			for (const job of runtime.jobs) {
				const jobOwner = runtime.items.find((item) => item.id === job.ownerItemId);
				if (jobOwner?.item.id !== intermediateItemId) continue;
				activeJobCountByBlueprintOwnerId.set(
					job.ownerItemId,
					(activeJobCountByBlueprintOwnerId.get(job.ownerItemId) ?? 0) + 1,
				);
			}
			const liveIdleQuantity = runtime.items.reduce(
				(quantity, candidate) =>
					candidate.item.id === intermediateItemId
						? quantity +
							Math.max(
								0,
								candidate.quantity -
									(activeJobCountByBlueprintOwnerId.get(candidate.id) ?? 0),
							)
						: quantity,
				0,
			);
			const committedIntermediateQuantity =
				liveIdleQuantity +
				(activeReservations.get(intermediateItemId)?.quantity ?? 0) +
				(branchReserved.get(intermediateItemId) ?? 0);
			if (committedIntermediateQuantity <= 0) continue;

			let firstBlock: OutputMaxCountBlock | undefined;
			let everyApplicableLineBlocked = true;
			for (const candidate of applicable) {
				const netOutput = yield* readDefinitionLineNetMaximumOutputQuantitiesFx({
					line: candidate,
					owner: intermediate,
				});
				const committedNetOutput = new Map(
					[
						...netOutput,
					].map(([itemId, quantity]) => [
						itemId,
						quantity * committedIntermediateQuantity,
					]),
				);
				const block = yield* resolveDirectLineOutputMaxCountFx({
					additionalReserved: branchReserved,
					excludedItemIds: new Set([
						intermediateItemId,
					]),
					line: candidate,
					netOutput: committedNetOutput,
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
