/** Stable manifest-backed identity used by editor discovery and navigation. */
export interface EditorProjectDescriptor {
	readonly projectId: string;
	readonly title: string;
	readonly game?: string;
	readonly createdAtMs: number;
	readonly updatedAtMs: number;
}
