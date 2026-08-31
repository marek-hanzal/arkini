import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import type { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

type ArkpackSource = "bundled" | "user";

/** Descriptor derived from a validated package payload and its soft release provenance. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly title: string;
	readonly version: GameVersionSchema.Type;
	readonly arkini: ArkiniVersionSchema.Type;
	readonly provenance: ArkpackProvenanceSchema.Type;
	readonly source: ArkpackSource;
	readonly overridesBundled?: boolean;
	readonly filename?: string;
}
