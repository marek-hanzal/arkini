import { Effect, Option } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import { resolveInputRunFx } from "~/engine/input/fx/run/resolveInputRunFx";
import type { InputRun } from "~/engine/input/InputRun";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/engine/line/error/LineNotFoundError";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { readItemLineFn } from "~/engine/line/fn/readItemLineFn";
import { resolveLineEnableFn } from "~/engine/line/fn/resolveLineEnableFn";
import { resolveLineShowFn } from "~/engine/line/fn/resolveLineShowFn";
import type { LineRun } from "~/engine/line/LineRun";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { TypeSchema as LineRuleTypeSchema } from "~/engine/line/schema/rule/TypeSchema";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { isBoardRuntimeItemFn } from "~/engine/runtime/read/fn/isBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace resolveLineRunFx {
	export interface Props {
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

const planLineRunFn = ({
	enable,
	input,
	lineId,
	ownerItemId,
	runtimeMs,
}: {
	readonly enable: boolean;
	readonly input: readonly [
		InputRun.Resolution,
		...InputRun.Resolution[],
	];
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtimeMs: TimeSchema.Type;
}) => {
	if (!enable || input.some(({ resolution }) => !resolution.ready)) return undefined;

	const inputPlans: InputRun.Plan[] = [];
	for (const { plan } of input) {
		if (plan === undefined) return undefined;
		inputPlans.push(plan);
	}
	const [firstInputPlan, ...remainingInputPlans] = inputPlans;
	if (firstInputPlan === undefined) return undefined;

	return {
		ownerItemId,
		lineId,
		runtimeMs,
		input: [
			firstInputPlan,
			...remainingInputPlans,
		],
	} satisfies LineRun.Plan;
};

const resolveLineRuntimeFn = ({
	line,
	rules,
}: {
	readonly line: Pick<LineSchema.Type, "runtimeMs">;
	readonly rules: lineRulesFx.Result;
}) => {
	const multiplier = rules.reduce(
		(value, rule) =>
			rule.type === LineRuleTypeSchema.enum.RuntimeMultiplier && rule.active
				? value * rule.multiplier
				: value,
		1,
	);
	const adjustmentMs = rules.reduce(
		(value, rule) =>
			rule.type === LineRuleTypeSchema.enum.RuntimeAdjust && rule.active
				? value + rule.adjustMs
				: value,
		0,
	);

	return Math.max(
		0,
		Math.ceil(line.runtimeMs * multiplier + adjustmentMs),
	) satisfies TimeSchema.Type;
};

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
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(isBoardRuntimeItemFn(runtimeOwner));
	if (owner === undefined) {
		return yield* Effect.fail(
			new ItemNotOnBoardError({
				itemId: ownerItemId,
				location: runtimeOwner.location,
			}),
		);
	}

	const line = readItemLineFn({
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
	const show = resolveLineShowFn({
		line,
		rules,
	});
	const enable = resolveLineEnableFn({
		line,
		rules,
	});
	const runtimeMs = resolveLineRuntimeFn({
		line,
		rules,
	});
	const resolvedInputs: InputRun.Resolution[] = [];
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
		return yield* Effect.die(new Error("LineSchema unexpectedly resolved without an input."));
	}
	const input = [
		firstInput,
		...remainingInputs,
	] satisfies readonly [
		InputRun.Resolution,
		...InputRun.Resolution[],
	];
	const plan = planLineRunFn({
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
		rules,
		runtimeMs,
		input,
		ready,
		plan,
	} satisfies LineRun.Resolution;
});
