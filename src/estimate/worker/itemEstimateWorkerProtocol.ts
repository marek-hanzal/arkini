import type { Project } from "~/project-authoring/type/Project";
import type { ItemEstimate } from "~/estimate/type/ItemEstimate";

export interface ItemEstimateWorkerRequest {
	readonly config: Project["config"];
}

export interface ItemEstimateWorkerResult {
	readonly estimates: ReadonlyArray<ItemEstimate>;
}

export type ItemEstimateWorkerResponse =
	| {
			readonly result: ItemEstimateWorkerResult;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };
