import { z } from "zod";

export const EditorMcpPortSchema = z.number().int().min(1024).max(65_535);
export type EditorMcpPortSchema = typeof EditorMcpPortSchema;

export namespace EditorMcpPortSchema {
	export type Type = z.infer<EditorMcpPortSchema>;
}

export type EditorMcpPortAvailability =
	| {
			readonly type: "available";
	  }
	| {
			readonly type: "active";
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };

export type EditorMcpStatus =
	| {
			readonly type: "inactive";
	  }
	| {
			readonly type: "ready";
			readonly port: EditorMcpPortSchema.Type;
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };
