import { Effect } from "effect";

import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

export namespace createDemandFrameLoopFx {
	export interface Props {
		readonly reportCriticalFailure: (cause: unknown) => void;
		readonly render: () => void;
		readonly requestFrame?: (callback: FrameRequestCallback) => number;
		readonly cancelFrame?: (handle: number) => void;
	}
}

/** Creates one coalescing render owner that fully stops while the scene is idle. */
export const createDemandFrameLoopFx = Effect.fn("createDemandFrameLoopFx")(
	({
		reportCriticalFailure,
		render,
		requestFrame = window.requestAnimationFrame.bind(window),
		cancelFrame = window.cancelAnimationFrame.bind(window),
	}: createDemandFrameLoopFx.Props) =>
		Effect.sync((): DemandFrameLoop => {
			let closed = false;
			let dirty = false;
			let nextWorkId = 0;
			let poisoned = false;
			let queuedFrame: number | null = null;
			const afterRenderWork = new Map<number, () => void>();
			const scheduledWork = new Map<number, () => void>();

			const schedule = () => {
				if (closed || poisoned || document.hidden || queuedFrame !== null) return;
				queuedFrame = requestFrame(runFrame);
			};

			const runFrame = () => {
				if (closed || poisoned) return;

				const workIds = Array.from(scheduledWork.keys());
				for (const workId of workIds) {
					if (closed || poisoned) return;
					const run = scheduledWork.get(workId);
					if (run === undefined) continue;
					scheduledWork.delete(workId);
					try {
						run();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						afterRenderWork.clear();
						scheduledWork.clear();
						queuedFrame = null;
						reportCriticalFailure(cause);
						return;
					}
				}
				if (closed || poisoned) return;
				queuedFrame = null;
				const renderRequested = dirty;
				dirty = false;
				if (renderRequested) {
					try {
						render();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						afterRenderWork.clear();
						scheduledWork.clear();
						reportCriticalFailure(cause);
						return;
					}
				}
				const afterRenderWorkIds = Array.from(afterRenderWork.keys());
				for (const workId of afterRenderWorkIds) {
					if (closed || poisoned) return;
					const run = afterRenderWork.get(workId);
					if (run === undefined) continue;
					afterRenderWork.delete(workId);
					try {
						run();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						afterRenderWork.clear();
						scheduledWork.clear();
						reportCriticalFailure(cause);
						return;
					}
				}
				if (dirty || scheduledWork.size > 0 || afterRenderWork.size > 0) schedule();
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
				reportCriticalFailure,
				invalidateFx: Effect.sync(() => {
					if (closed) return;
					dirty = true;
					schedule();
				}),
				scheduleFx: (work) =>
					Effect.sync(() => {
						if (closed || poisoned) return () => {};
						const workId = ++nextWorkId;
						scheduledWork.set(workId, work);
						schedule();
						return () => {
							scheduledWork.delete(workId);
						};
					}),
				scheduleAfterRenderFx: (work) =>
					Effect.sync(() => {
						if (closed || poisoned) return () => {};
						const workId = ++nextWorkId;
						afterRenderWork.set(workId, work);
						dirty = true;
						schedule();
						return () => {
							afterRenderWork.delete(workId);
						};
					}),
				closeFx: Effect.sync(() => {
					if (closed) return;
					closed = true;
					dirty = false;
					afterRenderWork.clear();
					scheduledWork.clear();
					document.removeEventListener("visibilitychange", onVisibilityChange);
					if (queuedFrame !== null) {
						cancelFrame(queuedFrame);
						queuedFrame = null;
					}
				}),
			};
		}),
);
