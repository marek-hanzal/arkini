import { Effect } from "effect";
import { Application, Ticker } from "pixi.js";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import { createDemandFrameLoopFx } from "~/tile-rendering/fx/createDemandFrameLoopFx";

export namespace createApplicationOwnerFx {
	export interface Props {
		readonly host: HTMLElement;
		readonly reportCriticalFailureFn: (cause: unknown) => void;
	}
}

const maximumResolution = 2;
const hostGenerations = new WeakMap<HTMLElement, number>();

// Arkini owns rendering explicitly. Pixi's Event/Scheduler systems may register
// listeners here, but must never auto-start a process-wide idle RAF.
Ticker.system.autoStart = false;
Ticker.system.stop();

/**
 * Acquires one explicitly rendered Pixi application and its complete DOM/resize lifecycle.
 *
 * Arkini keeps both Pixi tickers stopped: Motion drives interpolation and every visual writer
 * invalidates the local demand frame owner. Closing this owner is therefore the terminal scene
 * boundary and must happen only after children release their display objects and listeners.
 */
export const createApplicationOwnerFx = Effect.fn("createApplicationOwnerFx")(
	({ host, reportCriticalFailureFn }: createApplicationOwnerFx.Props) => {
		const app = new Application();
		const hostGeneration = (hostGenerations.get(host) ?? 0) + 1;
		hostGenerations.set(host, hostGeneration);
		let destroyed = false;
		const destroyApplicationFn = () => {
			if (destroyed) return;
			destroyed = true;
			try {
				app.destroy(
					{
						removeView: true,
					},
					{
						children: true,
						context: true,
					},
				);
			} catch {
				// Rollback is best-effort when initialization itself failed.
			}
		};

		return Effect.gen(function* () {
			yield* Effect.tryPromise({
				try: () =>
					app.init({
						antialias: true,
						autoDensity: true,
						autoStart: false,
						backgroundAlpha: 0,
						height: Math.max(1, host.clientHeight),
						powerPreference: "high-performance",
						preference: "webgl",
						resolution: Math.min(maximumResolution, window.devicePixelRatio || 1),
						sharedTicker: false,
						width: Math.max(1, host.clientWidth),
					}),
				catch: (cause) => cause,
			});
			app.ticker.stop();
			Ticker.system.autoStart = false;
			Ticker.system.stop();
			if (hostGenerations.get(host) !== hostGeneration) {
				return yield* Effect.fail(
					new Error("A newer Pixi application already owns this host."),
				);
			}
			app.canvas.dataset.ui = "PixiCanvas";
			app.canvas.className = "block size-full touch-none";
			host.replaceChildren(app.canvas);

			const frames = yield* createDemandFrameLoopFx({
				reportCriticalFailureFn,
				renderFn: () => app.render(),
			});
			const resizeListeners = new Set<() => void>();
			const resizeFn = () => {
				const width = Math.max(1, host.clientWidth);
				const height = Math.max(1, host.clientHeight);
				if (app.screen.width === width && app.screen.height === height) return;
				app.renderer.resize(
					width,
					height,
					Math.min(maximumResolution, window.devicePixelRatio || 1),
				);
				for (const listenerFn of resizeListeners) listenerFn();
				RendererRuntime.runSync(frames.invalidateFx);
			};
			const resizeObserver =
				typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resizeFn);
			resizeObserver?.observe(host);
			window.addEventListener("resize", resizeFn);
			yield* frames.invalidateFx;

			let closed = false;
			return {
				app,
				stage: app.stage,
				frames,
				addResizeListenerFx: (listenerFn) =>
					Effect.sync(() => {
						resizeListeners.add(listenerFn);
						return () => resizeListeners.delete(listenerFn);
					}),
				closeFx: Effect.gen(function* () {
					if (closed) return;
					closed = true;
					resizeObserver?.disconnect();
					window.removeEventListener("resize", resizeFn);
					resizeListeners.clear();
					yield* frames.closeFx;
					destroyApplicationFn();
				}),
			} satisfies PixiApplicationOwner;
		}).pipe(
			Effect.onError(() =>
				Effect.sync(() => {
					destroyApplicationFn();
				}),
			),
		);
	},
);
