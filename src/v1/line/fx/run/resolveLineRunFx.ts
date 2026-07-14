import { Effect } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import { resolveInputRunFx } from "~/v1/input/fx/run/resolveInputRunFx";
import type { InputRunResolutionSchema } from "~/v1/input/schema/run/InputRunResolutionSchema";
import { ItemNotOnBoardError } from "~/v1/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/v1/line/error/LineNotFoundError";
import { lineRulesFx } from "~/v1/line/fx/lineRulesFx";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import type { LineRunResolutionSchema } from "~/v1/line/schema/run/LineRunResolutionSchema";
import { RuntimeFx } from "~/v1/runtime/context/RuntimeFx";
import { isBoardRuntimeItem } from "~/v1/runtime/read/isBoardRuntimeItem";
import { readRuntimeItemByIdFx } from "~/v1/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
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
		origin: owner.location.position,
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
	const resolvedInputs = yield* Effect.forEach(line.input, (input, inputIndex) => {
		return resolveInputRunFx({
			input,
			inputIndex,
			lineId,
			ownerItemId,
			runtime,
		});
	});
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
