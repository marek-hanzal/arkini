import { Effect } from "effect";

import type { JobCompletionContext } from "~/v1/job/completion/JobCompletionContext";
import { releaseJobReservationsFx } from "~/v1/job/completion/fx/releaseJobReservationsFx";
import { releaseOwnerInputsFx } from "~/v1/input/fx/releaseOwnerInputsFx";
import { outputFx } from "~/v1/output/fx/outputFx";
import type { OutputResultSchema } from "~/v1/output/schema/OutputResultSchema";
import { applyOutputPlacementFx } from "~/v1/placement/fx/applyOutputPlacementFx";
import { removeRuntimeItemIdentityFx } from "~/v1/runtime/fx/removeRuntimeItemIdentityFx";

/** Completes one line job from authored output placement and owner lifecycle data. */
export const completeLineJobRuntimeFx = Effect.fn("completeLineJobRuntimeFx")(function* (
	context: JobCompletionContext,
) {
	const resolvedOutput =
		context.line.output === undefined
			? ({
					drop: [],
				} satisfies OutputResultSchema.Type)
			: yield* outputFx({
					origin: context.owner.location.position,
					output: context.line.output,
				});
	const replacesOwner = resolvedOutput.drop.some((drop) => drop.placement === "replace");
	if (context.owner.item.afterCompletion === "keep" && replacesOwner) {
		return yield* Effect.dieMessage(
			`Job ${context.job.id} resolved replacement output for keep owner ${context.owner.id}.`,
		);
	}

	let draft = context.runtime;
	if (context.owner.item.afterCompletion === "remove" && !replacesOwner) {
		draft = yield* removeRuntimeItemIdentityFx({
			item: context.owner,
			runtime: draft,
		});
	}

	if (resolvedOutput.drop.length > 0) {
		const [, withOutput] = yield* applyOutputPlacementFx({
			origin: context.owner.location.position,
			originItemId: context.owner.id,
			output: resolvedOutput,
			runtime: draft,
		});
		draft = withOutput;
	}

	if (context.owner.item.afterCompletion === "remove") {
		draft = yield* removeRuntimeItemIdentityFx({
			item: context.owner,
			runtime: draft,
		});
		draft = yield* releaseOwnerInputsFx({
			owner: context.owner,
			runtime: draft,
		});
	}

	return yield* releaseJobReservationsFx({
		origin: context.owner.location.position,
		originItemId: context.owner.id,
		reservations: context.reservations,
		runtime: draft,
	});
});
