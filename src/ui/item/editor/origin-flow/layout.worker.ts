import { WorkerRuntime } from "~/ui/item/editor/origin-flow/WorkerRuntime";
import { layoutFx } from "~/ui/item/editor/origin-flow/layoutFx";
import type {
	LayoutWorkerRequest,
	LayoutWorkerResponse,
} from "~/ui/item/editor/origin-flow/LayoutWorkerProtocol";

self.addEventListener(
	"message",
	({ data }: MessageEvent<LayoutWorkerRequest>) => {
		try {
			const layout = WorkerRuntime.runSync(
				layoutFx(data.topology),
			);
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
	},
);
