import { Effect } from "effect";

import { resolveActionChargeFx } from "~/engine/action/fx/resolveActionChargeFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputChargeFromEnumSchema } from "~/engine/input/schema/InputChargeFromEnumSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { assertLineOutputMaxCountFx } from "~/engine/job/fx/assertLineOutputMaxCountFx";
import type { LineStartResolutionSchema } from "~/engine/job/schema/read/LineStartResolutionSchema";
import { readBoardItemLineFx } from "~/engine/line/fx/readBoardItemLineFx";
import { LineRunUnavailableError } from "~/engine/line/error/LineRunUnavailableError";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace assertLineEnqueueConditionsFx {
	export interface Props {
		readonly candidateId: IdSchema.Type;
		readonly resolution: LineStartResolutionSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Validates hard queue conditions while allowing only missing concrete material to wait.
 *
 * This is shared by queue admission and queue projection so charges, rules, non-material inputs,
 * and output limits cannot be interpreted differently from the actual enqueue command.
 */
export const assertLineEnqueueConditionsFx = Effect.fn("assertLineEnqueueConditionsFx")(function* ({
	candidateId,
	resolution,
	runtime,
}: assertLineEnqueueConditionsFx.Props) {
	const { line } = yield* readBoardItemLineFx({
		ownerItemId: resolution.ownerItemId,
		lineId: resolution.lineId,
		runtime,
	});
	const reservedCharges = new Map<IdSchema.Type, number>();
	let missingConcreteInputsOnly = resolution.run.enable;
	for (const [inputIndex, runInput] of resolution.run.input.entries()) {
		const configuredInput = line.input[inputIndex];
		if (configuredInput === undefined) {
			missingConcreteInputsOnly = false;
			break;
		}
		const chargePlan = runInput.plan?.charges;
		if (chargePlan !== undefined) {
			reservedCharges.set(
				chargePlan.itemId,
				(reservedCharges.get(chargePlan.itemId) ?? 0) + chargePlan.cost,
			);
		}
		if (runInput.resolution.ready) continue;
		if (
			runInput.resolution.type !== InputEnumSchema.enum.Materials ||
			configuredInput.type !== InputEnumSchema.enum.Materials ||
			runInput.resolution.missingQuantity === 0
		) {
			missingConcreteInputsOnly = false;
			break;
		}
		if (configuredInput.charges?.from !== InputChargeFromEnumSchema.enum.Self) continue;
		const charges = yield* resolveActionChargeFx({
			charges: configuredInput.charges,
			ownerItemId: resolution.ownerItemId,
			reservedCharges,
			runtime,
		});
		if (!charges.ready || charges.plan === undefined) {
			missingConcreteInputsOnly = false;
			break;
		}
		reservedCharges.set(
			charges.plan.itemId,
			(reservedCharges.get(charges.plan.itemId) ?? 0) + charges.plan.cost,
		);
	}
	if (!missingConcreteInputsOnly) {
		return yield* Effect.fail(
			new LineRunUnavailableError({
				ownerItemId: resolution.ownerItemId,
				lineId: resolution.lineId,
			}),
		);
	}

	yield* assertLineOutputMaxCountFx({
		candidateId,
		ownerItemId: resolution.ownerItemId,
		lineId: resolution.lineId,
		plan: resolution.run.plan,
		runtime,
	});
});
