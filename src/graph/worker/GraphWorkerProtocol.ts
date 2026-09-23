import type { Project } from "~/project-authoring/type/Project";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";
import type { GraphResult } from "~/graph/type/GraphResult";

export type GraphWorkerRequest =
	| {
			readonly kind: "query";
			readonly requestId: number;
			readonly project: Project;
			readonly query: GraphQuerySchema.Type;
	  }
	| {
			readonly kind: "cancel";
			readonly requestId: number;
	  };

export type GraphWorkerResponse =
	| {
			readonly requestId: number;
			readonly status: "success";
			readonly result: GraphResult;
	  }
	| {
			readonly requestId: number;
			readonly status: "error";
			readonly message: string;
	  };
