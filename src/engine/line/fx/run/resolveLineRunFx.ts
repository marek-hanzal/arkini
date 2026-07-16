import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveInputRunFx } from "~/engine/input/fx/run/resolveInputRunFx";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import type { LineRunResolutionSchema } from "~/engine/line/schema/run/LineRunResolutionSchema";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItem } from "~/engine/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { planLineRunFx } from "./planLineRunFx";
import { resolveLineEnableFx } from "./resolveLineEnableFx";
import { resolveLineRuntimeFx } from "./resolveLineRuntimeFx";
import { resolveLineShowFx } from "./resolveLineShowFx";

export namespace resolveLineRunFx {
	export interface Props {
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Resolves one line run against one explicit immutable runtime snapshot.
 *
 * Nested rule queries are provided the same snapshot, so the serialized runtime
 * mutation planner can make queue, rule, and input decisions without a stale-plan race.
 */
export const resolveLineRunFx = Effect.fn("resolveLineRunFx")(function* ({
	lineId,
	ownerItemId,
	runtime,
}: resolveLineRunFx.Props) {
	const owner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	if (!isBoardRuntimeItem(owner)) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: ownerItemId,
				location: owner.location,
			}),
		);
	}

	const line = yield* readItemLineFx({
		item: owner.item,
		lineId,
	});
	if (line === undefined) {
		return yield* Effect.fail(
			new LineNotFoundError({
				itemId: ownerItemId,
				lineId,
			}),
		);
	}

	const rules = yield* lineRulesFx({
		origin: owner.location,
		rules: line.rules,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	const show = yield* resolveLineShowFx({
		line,
		rules,
	});
	const enable = yield* resolveLineEnableFx({
		line,
		rules,
	});
	const runtimeMs = yield* resolveLineRuntimeFx({
		line,
		rules,
	});
	const resolvedInputs: InputRunResolutionSchema.Type[] = [];
	const reservedCharges = new Map<IdSchema.Type, number>();
	for (const [inputIndex, configuredInput] of line.input.entries()) {
		const resolvedInput = yield* resolveInputRunFx({
			input: configuredInput,
			inputIndex,
			lineId,
			ownerItemId,
			reservedCharges,
			runtime,
		});
		resolvedInputs.push(resolvedInput);

		const chargePlan = resolvedInput.plan?.charges;
		if (chargePlan !== undefined) {
			reservedCharges.set(
				chargePlan.itemId,
				(reservedCharges.get(chargePlan.itemId) ?? 0) + chargePlan.cost,
			);
		}
	}
	const [firstInput, ...remainingInputs] = resolvedInputs;
	if (firstInput === undefined) {
		return yield* Effect.dieMessage("LineSchema unexpectedly resolved without an input.");
	}
	const input = [
		firstInput,
		...remainingInputs,
	] satisfies [
		InputRunResolutionSchema.Type,
		...InputRunResolutionSchema.Type[],
	];
	const plan = yield* planLineRunFx({
		enable,
		input,
		lineId,
		ownerItemId,
		runtimeMs,
	});
	const ready = plan !== undefined;

	return {
		ownerItemId,
		lineId,
		show,
		enable,
		runtimeMs,
		input,
		ready,
		plan,
	} satisfies LineRunResolutionSchema.Type;
});
