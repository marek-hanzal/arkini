import { Effect } from "effect";

import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createDemandFrameLoopFx {
	export interface Props {
		readonly onError?: (cause: unknown) => void;
		readonly render: () => void;
		readonly requestFrame?: (callback: FrameRequestCallback) => number;
		readonly cancelFrame?: (handle: number) => void;
	}
}

/** Creates one coalescing render owner that fully stops while the scene is idle. */
export const createDemandFrameLoopFx = Effect.fn("createDemandFrameLoopFx")(
	({
		onError = (cause) => console.error("Pixi demand frame loop failed.", cause),
		render,
		requestFrame = window.requestAnimationFrame.bind(window),
		cancelFrame = window.cancelAnimationFrame.bind(window),
	}: createDemandFrameLoopFx.Props) =>
		Effect.sync((): DemandFrameLoop => {
			let closed = false;
			let dirty = false;
			let poisoned = false;
			let queuedFrame: number | null = null;

			const schedule = () => {
				if (closed || poisoned || document.hidden || queuedFrame !== null) return;
				queuedFrame = requestFrame(runFrame);
			};

			const runFrame = () => {
				queuedFrame = null;
				if (closed || poisoned) return;

				const renderRequested = dirty;
				dirty = false;
				if (renderRequested) {
					try {
						render();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						onError(cause);
						return;
					}
				}
				if (dirty) schedule();
			};

			const onVisibilityChange = () => {
				if (document.hidden) {
					if (queuedFrame !== null) {
						cancelFrame(queuedFrame);
						queuedFrame = null;
					}
					return;
				}
				dirty = true;
				schedule();
			};
			document.addEventListener("visibilitychange", onVisibilityChange);

			return {
				invalidateFx: Effect.sync(() => {
					if (closed) return;
					dirty = true;
					schedule();
				}),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					dirty = false;
					document.removeEventListener("visibilitychange", onVisibilityChange);
					if (queuedFrame !== null) {
						cancelFrame(queuedFrame);
						queuedFrame = null;
					}
				}),
			};
		}),
);
