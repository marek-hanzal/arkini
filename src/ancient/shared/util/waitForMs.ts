export const waitForMs = (milliseconds: number) =>
	new Promise<void>((resolve) => {
		window.setTimeout(resolve, milliseconds);
	});
