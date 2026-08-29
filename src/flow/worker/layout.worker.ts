import { WorkerRuntime } from "~/flow/worker/WorkerRuntime";
import { layoutFx } from "~/flow/worker/layoutFx";
import type { LayoutWorkerRequest, LayoutWorkerResponse } from "~/flow/worker/LayoutWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<LayoutWorkerRequest>) => {
	try {
		const layout = WorkerRuntime.runSync(layoutFx(data.topology));
		self.postMessage({
			layout,
			status: "success",
		} satisfies LayoutWorkerResponse);
	} catch (cause) {
		self.postMessage({
			message: cause instanceof Error ? cause.message : String(cause),
			status: "error",
		} satisfies LayoutWorkerResponse);
	}
});
