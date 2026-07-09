export const resetElementTransform = (element: HTMLElement | null) => {
	if (!element) return;
	element.style.transform = "translate3d(0px, 0px, 0px)";
};
