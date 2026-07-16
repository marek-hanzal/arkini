export const releasePointerCapture = (element: HTMLElement | null, pointerId: number) => {
	if (element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
};
