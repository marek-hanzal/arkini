import { Effect } from "effect";

import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPixiMainScenePointerSamplerFx {
	export interface Sample {
		readonly pointerId: number;
		readonly x: number;
		readonly y: number;
	}

	export interface Props {
		readonly frames: DemandFrameLoop;
		readonly onApply: (sample: Sample) => void;
	}
}

/** Coalesces raw pointer samples through one scene-owned demand-frame slot. */
export const createPixiMainScenePointerSamplerFx = Effect.fn("createPixiMainScenePointerSamplerFx")(
	function* ({ frames, onApply }: createPixiMainScenePointerSamplerFx.Props) {
		let cancelScheduled: (() => void) | null = null;
		let pendingSample: createPixiMainScenePointerSamplerFx.Sample | null = null;

		const cancel = () => {
			pendingSample = null;
			cancelScheduled?.();
			cancelScheduled = null;
		};

		const requestFrameFx = Effect.gen(function* () {
			if (cancelScheduled !== null) return;
			cancelScheduled = yield* frames.scheduleFx(() => {
				cancelScheduled = null;
				const latest = pendingSample;
				pendingSample = null;
				if (latest !== null) onApply(latest);
			});
		});

		return {
			cancelFx: Effect.sync(cancel),
			flushFx: Effect.fn("PixiMainScenePointerSampler.flushFx")(
				(sample?: createPixiMainScenePointerSamplerFx.Sample) =>
					Effect.sync(() => {
						const latest = sample ?? pendingSample;
						cancel();
						if (latest !== null) onApply(latest);
					}),
			),
			scheduleFallbackFx: Effect.fn("PixiMainScenePointerSampler.scheduleFallbackFx")(
				(sample: createPixiMainScenePointerSamplerFx.Sample) =>
					Effect.gen(function* () {
						pendingSample ??= sample;
						yield* requestFrameFx;
					}),
			),
			scheduleFx: Effect.fn("PixiMainScenePointerSampler.scheduleFx")(
				(sample: createPixiMainScenePointerSamplerFx.Sample) =>
					Effect.gen(function* () {
						pendingSample = sample;
						yield* requestFrameFx;
					}),
			),
		};
	},
);
