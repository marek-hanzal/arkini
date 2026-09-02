export const focusFirstInvalidFieldFn = (): void => {
	const focusFn = () => document.querySelector<HTMLElement>("[data-ui-invalid='true']")?.focus();
	if (typeof requestAnimationFrame === "function") {
		requestAnimationFrame(focusFn);
	} else {
		setTimeout(focusFn, 0);
	}
};
