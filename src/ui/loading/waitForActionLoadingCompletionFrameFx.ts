import { Effect } from "effect";

const actionLoadingCompletionHoldMs = 150;

/** Waits until the completed action frame has painted, then keeps it visible deliberately. */
export const waitForActionLoadingCompletionFrameFx = Effect.fn(
	"waitForActionLoadingCompletionFrameFx",
)(() =>
	Effect.promise(async () => {
		await new Promise<void>((resolve) => {
			window.requestAnimationFrame(() => resolve());
		});
		await new Promise<void>((resolve) => {
			window.requestAnimationFrame(() => resolve());
		});
		await new Promise<void>((resolve) => {
			window.setTimeout(resolve, actionLoadingCompletionHoldMs);
		});
	}),
);
