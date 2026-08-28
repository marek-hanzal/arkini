import { Effect } from "effect";

import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

export namespace createPointerSamplerFx {
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
export const createPointerSamplerFx = Effect.fn("createPointerSamplerFx")(function* ({
	frames,
	onApply,
}: createPointerSamplerFx.Props) {
	let cancelScheduled: (() => void) | null = null;
	let pendingSample: createPointerSamplerFx.Sample | null = null;

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
		flushFx: Effect.fn("PointerSampler.flushFx")((sample?: createPointerSamplerFx.Sample) =>
			Effect.sync(() => {
				const latest = sample ?? pendingSample;
				cancel();
				if (latest !== null) onApply(latest);
			}),
		),
		scheduleFallbackFx: Effect.fn("PointerSampler.scheduleFallbackFx")(
			(sample: createPointerSamplerFx.Sample) =>
				Effect.gen(function* () {
					pendingSample ??= sample;
					yield* requestFrameFx;
				}),
		),
		scheduleFx: Effect.fn("PointerSampler.scheduleFx")(
			(sample: createPointerSamplerFx.Sample) =>
				Effect.gen(function* () {
					pendingSample = sample;
					yield* requestFrameFx;
				}),
		),
	};
});
