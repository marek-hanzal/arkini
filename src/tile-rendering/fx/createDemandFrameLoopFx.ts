import { Effect } from "effect";

import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

export namespace createDemandFrameLoopFx {
	export interface Props {
		readonly reportCriticalFailureFn: (cause: unknown) => void;
		readonly renderFn: () => void;
		readonly requestFrameFn?: (callbackFn: FrameRequestCallback) => number;
		readonly cancelFrameFn?: (handle: number) => void;
	}
}

/** Creates one coalescing render owner that fully stops while the scene is idle. */
export const createDemandFrameLoopFx = Effect.fn("createDemandFrameLoopFx")(
	({
		reportCriticalFailureFn,
		renderFn,
		requestFrameFn = window.requestAnimationFrame.bind(window),
		cancelFrameFn = window.cancelAnimationFrame.bind(window),
	}: createDemandFrameLoopFx.Props) =>
		Effect.sync((): DemandFrameLoop => {
			let closed = false;
			let dirty = false;
			let nextWorkId = 0;
			let poisoned = false;
			let queuedFrame: number | null = null;
			const afterRenderWork = new Map<number, () => void>();
			const scheduledWork = new Map<number, () => void>();

			const scheduleFn = () => {
				if (closed || poisoned || document.hidden || queuedFrame !== null) return;
				queuedFrame = requestFrameFn(runFrameFn);
			};

			const runFrameFn = () => {
				if (closed || poisoned) return;

				const workIds = Array.from(scheduledWork.keys());
				for (const workId of workIds) {
					if (closed || poisoned) return;
					const runFn = scheduledWork.get(workId);
					if (runFn === undefined) continue;
					scheduledWork.delete(workId);
					try {
						runFn();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						afterRenderWork.clear();
						scheduledWork.clear();
						queuedFrame = null;
						reportCriticalFailureFn(cause);
						return;
					}
				}
				if (closed || poisoned) return;
				queuedFrame = null;
				const renderRequested = dirty;
				dirty = false;
				if (renderRequested) {
					try {
						renderFn();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						afterRenderWork.clear();
						scheduledWork.clear();
						reportCriticalFailureFn(cause);
						return;
					}
				}
				const afterRenderWorkIds = Array.from(afterRenderWork.keys());
				for (const workId of afterRenderWorkIds) {
					if (closed || poisoned) return;
					const runFn = afterRenderWork.get(workId);
					if (runFn === undefined) continue;
					afterRenderWork.delete(workId);
					try {
						runFn();
					} catch (cause) {
						poisoned = true;
						dirty = false;
						afterRenderWork.clear();
						scheduledWork.clear();
						reportCriticalFailureFn(cause);
						return;
					}
				}
				if (dirty || scheduledWork.size > 0 || afterRenderWork.size > 0) scheduleFn();
			};

			const onVisibilityChangeFn = () => {
				if (document.hidden) {
					if (queuedFrame !== null) {
						cancelFrameFn(queuedFrame);
						queuedFrame = null;
					}
					return;
				}
				dirty = true;
				scheduleFn();
			};
			document.addEventListener("visibilitychange", onVisibilityChangeFn);

			return {
				reportCriticalFailureFn,
				invalidateFx: Effect.sync(() => {
					if (closed) return;
					dirty = true;
					scheduleFn();
				}),
				scheduleFx: (workFn) =>
					Effect.sync(() => {
						if (closed || poisoned) return () => {};
						const workId = ++nextWorkId;
						scheduledWork.set(workId, workFn);
						scheduleFn();
						return () => {
							scheduledWork.delete(workId);
						};
					}),
				scheduleAfterRenderFx: (workFn) =>
					Effect.sync(() => {
						if (closed || poisoned) return () => {};
						const workId = ++nextWorkId;
						afterRenderWork.set(workId, workFn);
						dirty = true;
						scheduleFn();
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
					document.removeEventListener("visibilitychange", onVisibilityChangeFn);
					if (queuedFrame !== null) {
						cancelFrameFn(queuedFrame);
						queuedFrame = null;
					}
				}),
			};
		}),
);
