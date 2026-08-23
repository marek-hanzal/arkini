import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";
import type { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

type ArkpackSource = "bundled" | "user";

/** Descriptor derived from a validated package payload and its detached signature. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly gameId: string;
	readonly title: string;
	readonly version: ArkpackVersionSchema.Type;
	readonly game: ArkiniVersionSchema.Type;
	readonly trust: ArkpackTrustSchema.Type;
	readonly source: ArkpackSource;
	readonly overridesBundled?: boolean;
	readonly filename?: string;
}
