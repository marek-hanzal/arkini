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
	readonly onApplyFn: (sample: createPointerFrameSamplerFx.Sample) => void;
}

/** Coalesces pointer samples through one demand-frame slot with explicit flush and cancellation. */
export const createPointerFrameSamplerFx = Effect.fn("createPointerFrameSamplerFx")(function* ({
	frames,
	onApplyFn,
}: Props) {
	let cancelScheduledFn: (() => void) | null = null;
	let pendingSample: createPointerFrameSamplerFx.Sample | null = null;

	const cancelFn = () => {
		pendingSample = null;
		cancelScheduledFn?.();
		cancelScheduledFn = null;
	};

	const requestFrameFx = Effect.gen(function* () {
		if (cancelScheduledFn !== null) return;
		cancelScheduledFn = yield* frames.scheduleFx(() => {
			cancelScheduledFn = null;
			const latest = pendingSample;
			pendingSample = null;
			if (latest !== null) onApplyFn(latest);
		});
	});

	return {
		cancelFx: Effect.sync(cancelFn),
		flushFx: Effect.fn("PointerFrameSampler.flushFx")(
			(sample?: createPointerFrameSamplerFx.Sample) =>
				Effect.sync(() => {
					const latest = sample ?? pendingSample;
					cancelFn();
					if (latest !== null) onApplyFn(latest);
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
