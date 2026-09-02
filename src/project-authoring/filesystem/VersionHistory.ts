import type { VersionHeadFileSchema } from "~/project-version/schema/VersionHeadFileSchema";
import type { PublishedVersion } from "./PublishedVersion";

/** Published version metadata captured only when a project opens or explicitly refreshes. */
export interface VersionHistory {
	readonly head?: VersionHeadFileSchema.Type;
	readonly versions: ReadonlyMap<string, PublishedVersion>;
}
