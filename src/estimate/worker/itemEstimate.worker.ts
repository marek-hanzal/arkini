import { estimateItemCatalogFn } from "~/estimate/fn/estimateItemCatalogFn";
import type {
	ItemEstimateWorkerRequest,
	ItemEstimateWorkerResponse,
} from "~/estimate/worker/itemEstimateWorkerProtocol";

self.addEventListener("message", ({ data }: MessageEvent<ItemEstimateWorkerRequest>) => {
	try {
		self.postMessage({
			result: {
				estimates: estimateItemCatalogFn(data.config),
			},
			status: "success",
		} satisfies ItemEstimateWorkerResponse);
	} catch (cause) {
		self.postMessage({
			message: cause instanceof Error ? cause.message : String(cause),
			status: "error",
		} satisfies ItemEstimateWorkerResponse);
	}
});
