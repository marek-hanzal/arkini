export const translateElement = (element: HTMLElement | null, x: number, y: number) => {
	if (!element) return;
	element.style.transform = `translate3d(${x}px, ${y}px, 0px)`;
};
