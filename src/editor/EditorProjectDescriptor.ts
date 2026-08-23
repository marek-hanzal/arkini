import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Stable repository-backed identity used by editor discovery and navigation. */
export interface EditorProjectDescriptor {
	readonly projectId: string;
	readonly title: string;
	readonly version: ArkpackVersionSchema.Type;
	readonly createdAtMs: number;
	readonly updatedAtMs: number;
}
