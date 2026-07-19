import { defaultLoadingMinimumDurationMs } from "~/ui/loading/ActionLoadingScreen";

/** Keeps one route action pending long enough for its standalone Hero page to be deliberate. */
export const runActionRoute = async <Result>(action: () => Promise<Result>): Promise<Result> => {
	const minimumDuration = new Promise<void>((resolve) => {
		window.setTimeout(resolve, defaultLoadingMinimumDurationMs);
	});
	const [result] = await Promise.all([
		action(),
		minimumDuration,
	]);
	return result;
};
