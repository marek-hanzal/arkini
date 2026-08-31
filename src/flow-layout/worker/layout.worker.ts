import { Layer, ManagedRuntime } from "effect";
import { layoutFx } from "~/flow-layout/fx/layoutFx";
import type {
	LayoutWorkerRequest,
	LayoutWorkerResponse,
} from "~/flow-layout/type/LayoutWorkerProtocol";

const WorkerRuntime = ManagedRuntime.make(Layer.empty);

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
