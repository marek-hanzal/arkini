import { Effect } from "effect";

import { resolveActionChargeFx } from "~/production-action/fx/resolveActionChargeFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { assertOutputCapacityFx } from "~/production-job/fx/assertOutputCapacityFx";
import type { resolveLineStartFx } from "~/production-job/fx/resolveLineStartFx";
import { readBoardItemLineFx } from "~/production-line/fx/readBoardItemLineFx";
import { LineRunUnavailableError } from "~/production-line/error/LineRunUnavailableError";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace assertLineEnqueueConditionsFx {
	export interface Props {
		readonly candidateId: IdSchema.Type;
		readonly resolution: resolveLineStartFx.Result;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Validates hard queue conditions while allowing only missing concrete material to wait.
 *
 * Queue admission, queued Autofill and queue projection share these checks so charges, rules,
 * non-material inputs and output limits cannot diverge while material is missing.
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
		if (
			!runInput.resolution.ready &&
			(runInput.resolution.type !== TypeSchema.enum.Materials ||
				configuredInput.type !== TypeSchema.enum.Materials ||
				runInput.resolution.missingQuantity === 0)
		) {
			missingConcreteInputsOnly = false;
			break;
		}
		// Run plans omit missing materials. Recheck every cost against one budget,
		// including ready plans that did not account for those earlier missing inputs.
		const charges = yield* resolveActionChargeFx({
			charges: configuredInput.charges,
			ownerItemId: resolution.ownerItemId,
			reservedCharges,
			targetItemId: runInput.plan?.charges?.itemId,
			runtime,
		});
		if (!charges.ready) {
			missingConcreteInputsOnly = false;
			break;
		}
		if (charges.plan !== undefined) {
			reservedCharges.set(
				charges.plan.itemId,
				(reservedCharges.get(charges.plan.itemId) ?? 0) + charges.plan.cost,
			);
		}
	}
	if (!missingConcreteInputsOnly) {
		return yield* Effect.fail(
			new LineRunUnavailableError({
				ownerItemId: resolution.ownerItemId,
				lineId: resolution.lineId,
			}),
		);
	}

	yield* assertOutputCapacityFx({
		candidateId,
		ownerItemId: resolution.ownerItemId,
		lineId: resolution.lineId,
		plan: resolution.run.plan,
		runtime,
	});
});
