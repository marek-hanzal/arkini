import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";
import { makeChargeDepletionRandomFx } from "~/v1/job/random/makeChargeDepletionRandomFx";
import { releaseOwnerInputsFx } from "~/v1/input/fx/releaseOwnerInputsFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/v1/runtime/fx/removeRuntimeItemIdentityFx";

const emptyOutput = {
	drop: [],
} satisfies OutputResultSchema.Type;

/** Completes one line job and removes its owner only when the owner is depleted. */
export const completeLineJobRuntimeFx = Effect.fn("completeLineJobRuntimeFx")(function* (
	context: JobCompletionContext,
) {
	const depleted =
		context.owner.item.charges !== undefined && context.owner.remainingCharges === 0;
	let draft = context.runtime;

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
		const [, withLineOutput] = yield* applyOutputPlacementFx({
			origin: context.owner.location,
			output: lineOutput,
			runtime: draft,
		});
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
			const [, withDepletionOutput] = yield* applyOutputPlacementFx({
				origin: context.owner.location,
				output: depletionOutput,
				runtime: draft,
			});
			draft = withDepletionOutput;
		}
	}

	if (depleted) {
		draft = yield* releaseOwnerInputsFx({
			owner: context.owner,
			runtime: draft,
		});
	}

	return yield* releaseJobReservationsFx({
		origin: context.owner.location,
		reservations: context.reservations,
		runtime: draft,
	});
});
