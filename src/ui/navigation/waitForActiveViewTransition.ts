const maxDiscoveryFrames = 3;

const nextFrame = () =>
	new Promise<void>((resolve) => {
		window.requestAnimationFrame(() => resolve());
	});

/** Lets the currently entering route finish its native transition before CPU-heavy action work starts. */
export const waitForActiveViewTransition = async (): Promise<void> => {
	if (
		typeof window.requestAnimationFrame !== "function" ||
		typeof document.startViewTransition !== "function" ||
		!("activeViewTransition" in document)
	) {
		return;
	}

	for (let frame = 0; frame < maxDiscoveryFrames; frame += 1) {
		await nextFrame();
		const transition = document.activeViewTransition;
		if (transition === null) continue;
		await transition.finished.catch(() => undefined);
		return;
	}
};
