export const actionLoadingCompletionHoldMs = 150;

const nextAnimationFrame = () =>
	new Promise<void>((resolve) => {
		window.requestAnimationFrame(() => resolve());
	});

/** Waits until the completed action frame has painted, then keeps it visible deliberately. */
export const waitForActionLoadingCompletionFrame = async (): Promise<void> => {
	await nextAnimationFrame();
	await nextAnimationFrame();
	await new Promise<void>((resolve) => {
		window.setTimeout(resolve, actionLoadingCompletionHoldMs);
	});
};
