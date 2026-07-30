import type { EditorProjectFile } from "./EditorProjectFile";

/** One complete editor project snapshot rooted below the canonical editor directory. */
export interface EditorProjectRecord {
	readonly projectId: string;
	readonly files: ReadonlyArray<EditorProjectFile>;
}
