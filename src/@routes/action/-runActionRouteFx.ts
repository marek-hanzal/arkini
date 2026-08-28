import { Effect } from "effect";

import { defaultLoadingMinimumDurationMs } from "~/ui/loading/defaultLoadingMinimumDurationMs";
import { waitForActiveViewTransitionFx } from "~/ui/navigation/waitForActiveViewTransitionFx";

/** Lets an action route enter cleanly, then remain pending long enough to read deliberately. */
export const runActionRouteFx = Effect.fn("runActionRouteFx")(
	<Result, Error, Requirements>(action: Effect.Effect<Result, Error, Requirements>) =>
		Effect.all(
			[
				waitForActiveViewTransitionFx().pipe(Effect.andThen(action)),
				Effect.promise(
					() =>
						new Promise<void>((resolve) => {
							window.setTimeout(resolve, defaultLoadingMinimumDurationMs);
						}),
				),
			],
			{
				concurrency: "unbounded",
			},
		).pipe(Effect.map(([result]) => result)),
);
