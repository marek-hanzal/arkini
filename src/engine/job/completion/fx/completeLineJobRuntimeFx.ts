import { Effect } from "effect";

import type { JobCompletionContext } from "~/engine/job/completion/JobCompletionContext";
import { releaseJobReservationsFx } from "~/engine/job/completion/fx/releaseJobReservationsFx";
import { makeChargeDepletionRandomFx } from "~/engine/job/random/makeChargeDepletionRandomFx";
import { releaseOwnerInputsFx } from "~/engine/input/fx/releaseOwnerInputsFx";
import { outputFx } from "~/engine/output/fx/outputFx";
import type { OutputResultSchema } from "~/engine/output/schema/OutputResultSchema";
import type { OutputPlacementResultSchema } from "~/engine/placement/schema/OutputPlacementResultSchema";
import { applyOutputPlacementFx } from "~/engine/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/engine/runtime/fx/removeRuntimeItemIdentityFx";

const emptyOutput = {
	drop: [],
} satisfies OutputResultSchema.Type;

export namespace completeLineJobRuntimeFx {
	export interface Result {
		readonly depletedOwner: JobCompletionContext["owner"] | null;
		readonly placement: OutputPlacementResultSchema.Type;
		readonly runtime: JobCompletionContext["runtime"];
	}
}

/** Completes one line job and removes its owner only when the owner is depleted. */
export const completeLineJobRuntimeFx = Effect.fn("completeLineJobRuntimeFx")(function* (
	context: JobCompletionContext,
) {
	const depleted =
		context.owner.item.charges !== undefined && context.owner.remainingCharges === 0;
	let draft = context.runtime;
	const placementDrop: OutputPlacementResultSchema.Type["drop"] = [];

	if (depleted) {
		draft = yield* removeRuntimeItemIdentityFx({
			item: context.owner,
			runtime: draft,
		});
	}

	const lineOutput =
		context.line.output === undefined
			? emptyOutput
			: yield* outputFx({
					origin: context.owner.location,
					output: context.line.output,
				});
	if (lineOutput.drop.length > 0) {
		const [placement, withLineOutput] = yield* applyOutputPlacementFx({
			origin: context.owner.location,
			output: lineOutput,
			runtime: draft,
		});
		placementDrop.push(...placement.drop);
		draft = withLineOutput;
	}

	if (depleted && context.owner.item.charges?.output !== undefined) {
		const random = yield* makeChargeDepletionRandomFx({
			itemId: context.owner.id,
			job: context.job,
		});
		const depletionOutput = yield* outputFx({
			origin: context.owner.location,
			output: context.owner.item.charges.output,
		}).pipe(Effect.withRandom(random));
		if (depletionOutput.drop.length > 0) {
			const [placement, withDepletionOutput] = yield* applyOutputPlacementFx({
				origin: context.owner.location,
				output: depletionOutput,
				runtime: draft,
			});
			placementDrop.push(...placement.drop);
			draft = withDepletionOutput;
		}
	}

	if (depleted) {
		draft = yield* releaseOwnerInputsFx({
			owner: context.owner,
			runtime: draft,
		});
	}

	const releasedRuntime = yield* releaseJobReservationsFx({
		origin: context.owner.location,
		reservations: context.reservations,
		runtime: draft,
	});
	return {
		depletedOwner: depleted ? context.owner : null,
		placement: { drop: placementDrop },
		runtime: releasedRuntime,
	} satisfies completeLineJobRuntimeFx.Result;
});
