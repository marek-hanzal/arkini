import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import type { TimeSchema } from "~/game-config/schema/TimeSchema";
import { resolveInputRunFx } from "~/production-input/fx/run/resolveInputRunFx";
import type { InputRun } from "~/production-input/type/InputRun";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import type { LineRun } from "~/production-line/type/LineRun";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { TypeSchema as LineRuleTypeSchema } from "~/production-line/schema/rule/TypeSchema";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { isBoardRuntimeItemFn } from "~/game-runtime/read/fn/isBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

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
