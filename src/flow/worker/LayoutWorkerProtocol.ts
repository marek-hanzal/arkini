import type { Layout, LayoutInput } from "~/flow/worker/Layout";

export interface LayoutWorkerRequest {
	readonly topology: LayoutInput;
}

export type LayoutWorkerResponse =
	| {
			readonly layout: Layout;
			readonly status: "success";
	  }
	| {
			readonly message: string;
			readonly status: "error";
	  };
