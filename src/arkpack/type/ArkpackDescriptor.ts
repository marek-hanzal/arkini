import type { ArkpackProvenanceSchema } from "~/arkpack/artifact/schema/ArkpackProvenanceSchema";
import type { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

type ArkpackSource = "bundled" | "user";

/** Descriptor derived from a validated package payload and its soft release provenance. */
export interface ArkpackDescriptor {
	readonly packageId: string;
	readonly contentHash: string;
	readonly title: string;
	readonly version: ArkpackVersionSchema.Type;
	readonly arkini: ArkiniVersionSchema.Type;
	readonly provenance: ArkpackProvenanceSchema.Type;
	readonly source: ArkpackSource;
	readonly overridesBundled?: boolean;
	readonly filename?: string;
}
