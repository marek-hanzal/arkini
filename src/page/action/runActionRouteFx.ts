import { Effect } from "effect";

import { defaultLoadingMinimumDurationMs } from "~/ui/loading/ActionLoadingScreen";
import { waitForActiveViewTransitionFx } from "~/ui/navigation/waitForActiveViewTransitionFx";

/** Lets the action page enter cleanly, then keeps it pending long enough to remain deliberate. */
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
