import { Effect } from "effect";

import type { DemandFrameLoop } from "~/tile-rendering/service/DemandFrameLoop";

export namespace createPointerFrameSamplerFx {
	export interface Sample {
		readonly pointerId: number;
		readonly x: number;
		readonly y: number;
	}
}

interface Props {
	readonly frames: DemandFrameLoop;
	readonly onApply: (sample: createPointerFrameSamplerFx.Sample) => void;
}

/** Coalesces pointer samples through one demand-frame slot with explicit flush and cancellation. */
export const createPointerFrameSamplerFx = Effect.fn("createPointerFrameSamplerFx")(function* ({
	frames,
	onApply,
}: Props) {
	let cancelScheduled: (() => void) | null = null;
	let pendingSample: createPointerFrameSamplerFx.Sample | null = null;

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
		flushFx: Effect.fn("PointerFrameSampler.flushFx")(
			(sample?: createPointerFrameSamplerFx.Sample) =>
				Effect.sync(() => {
					const latest = sample ?? pendingSample;
					cancel();
					if (latest !== null) onApply(latest);
				}),
		),
		scheduleFallbackFx: Effect.fn("PointerFrameSampler.scheduleFallbackFx")(
			(sample: createPointerFrameSamplerFx.Sample) =>
				Effect.gen(function* () {
					pendingSample ??= sample;
					yield* requestFrameFx;
				}),
		),
		scheduleFx: Effect.fn("PointerFrameSampler.scheduleFx")(
			(sample: createPointerFrameSamplerFx.Sample) =>
				Effect.gen(function* () {
					pendingSample = sample;
					yield* requestFrameFx;
				}),
		),
	};
});
