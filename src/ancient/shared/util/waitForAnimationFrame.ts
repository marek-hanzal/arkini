export const waitForAnimationFrame = () =>
	new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
