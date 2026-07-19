import { defaultLoadingMinimumDurationMs } from "~/ui/loading/ActionLoadingScreen";
import { waitForActiveViewTransition } from "~/ui/navigation/waitForActiveViewTransition";

/** Lets the action page enter cleanly, then keeps it pending long enough to remain deliberate. */
export const runActionRoute = async <Result>(action: () => Promise<Result>): Promise<Result> => {
	const minimumDuration = new Promise<void>((resolve) => {
		window.setTimeout(resolve, defaultLoadingMinimumDurationMs);
	});
	const actionResult = waitForActiveViewTransition().then(action);
	const [result] = await Promise.all([
		actionResult,
		minimumDuration,
	]);
	return result;
};
