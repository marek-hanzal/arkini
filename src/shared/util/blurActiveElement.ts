export const blurActiveElement = () => {
	const element = document.activeElement;
	if (element instanceof HTMLElement) element.blur();
};
