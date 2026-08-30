import type { EditorVersionHeadFileSchema } from "~/project-version/schema/EditorVersionHeadFileSchema";
import type { PublishedVersion } from "./PublishedVersion";

/** Published version metadata captured only when a project opens or explicitly refreshes. */
export interface VersionHistory {
	readonly head?: EditorVersionHeadFileSchema.Type;
	readonly versions: ReadonlyMap<string, PublishedVersion>;
}
