/** One project-relative editor source file transported through the preload boundary. */
export interface EditorProjectFile {
	readonly path: string;
	readonly bytes: Uint8Array;
}
