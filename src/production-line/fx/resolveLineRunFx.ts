import { Effect, Option } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { TimeSchema } from "~/game-value/schema/TimeSchema";
import { resolveInputRunFx } from "~/production-input/fx/resolveInputRunFx";
import type { InputRun } from "~/production-input/type/InputRun";
import { ItemNotOnBoardError } from "~/item-location/error/ItemNotOnBoardError";
import { LineNotFoundError } from "~/production-line/error/LineNotFoundError";
import { lineRulesFx } from "~/production-line/fx/lineRulesFx";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { resolveLineEnableFn } from "~/production-line/fn/resolveLineEnableFn";
import { resolveLineShowFn } from "~/production-line/fn/resolveLineShowFn";
import type { LineRun } from "~/production-line/type/LineRun";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { RuleTypeSchema as LineRuleTypeSchema } from "~/production-line/schema/RuleTypeSchema";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";
import { isLineAdmissionOpenFn } from "~/production-line/fn/isLineAdmissionOpenFn";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace resolveLineRunFx {
	export interface Props {
		lineUid: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

const planLineRunFn = ({
	enable,
	input,
	lineUid,
	ownerItemId,
	runtimeMs,
}: {
	readonly enable: boolean;
	readonly input: readonly InputRun.Resolution[];
	readonly lineUid: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtimeMs: TimeSchema.Type;
}) => {
	if (!enable || input.some(({ resolution }) => !resolution.ready)) return undefined;

	const inputPlans: InputRun.Plan[] = [];
	for (const { plan } of input) {
		if (plan === undefined) return undefined;
		inputPlans.push(plan);
	}
	return {
		ownerItemId,
		lineUid,
		runtimeMs,
		input: inputPlans,
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
	lineUid,
	ownerItemId,
	runtime,
}: resolveLineRunFx.Props) {
	const runtimeOwner = yield* readRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const owner = Option.getOrUndefined(narrowBoardRuntimeItemFn(runtimeOwner));
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
		lineUid,
	});
	if (line === undefined) {
		return yield* Effect.fail(
			new LineNotFoundError({
				itemId: ownerItemId,
				lineUid,
			}),
		);
	}
	if (
		line.clock === LineClockModeEnumSchema.enum["clock-lifetime"] &&
		!isLineAdmissionOpenFn({
			owner,
			lineUid,
		})
	)
		return yield* Effect.fail(
			new LineRunUnavailableError({
				ownerItemId,
				lineUid,
			}),
		);
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
	const reservedUnits = new Map<IdSchema.Type, number>();
	for (const [inputIndex, configuredInput] of line.input.entries()) {
		const resolvedInput = yield* resolveInputRunFx({
			input: configuredInput,
			inputIndex,
			lineUid,
			ownerItemId,
			reservedUnits,
			runtime,
		});
		resolvedInputs.push(resolvedInput);

		const unitPlan = resolvedInput.plan?.units;
		if (unitPlan !== undefined) {
			reservedUnits.set(
				unitPlan.itemId,
				(reservedUnits.get(unitPlan.itemId) ?? 0) + unitPlan.cost,
			);
		}
	}
	const input = resolvedInputs;
	const plan = planLineRunFn({
		enable,
		input,
		lineUid,
		ownerItemId,
		runtimeMs,
	});
	const ready = plan !== undefined;

	return {
		ownerItemId,
		lineUid,
		show,
		enable,
		rules,
		runtimeMs,
		input,
		ready,
		plan,
	} satisfies LineRun.Resolution;
});
