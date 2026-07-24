import { Effect } from "effect";

const maxDiscoveryFrames = 3;

/** Lets the currently entering route finish its native transition before CPU-heavy action work starts. */
export const waitForActiveViewTransitionFx = Effect.fn("waitForActiveViewTransitionFx")(() =>
	Effect.promise(async () => {
		if (
			typeof window.requestAnimationFrame !== "function" ||
			typeof document.startViewTransition !== "function" ||
			!("activeViewTransition" in document)
		) {
			return;
		}

		for (let frame = 0; frame < maxDiscoveryFrames; frame += 1) {
			await new Promise<void>((resolve) => {
				window.requestAnimationFrame(() => resolve());
			});
			const transition = document.activeViewTransition;
			if (transition === null) continue;
			await transition.finished.catch(() => undefined);
			return;
		}
	}),
);
