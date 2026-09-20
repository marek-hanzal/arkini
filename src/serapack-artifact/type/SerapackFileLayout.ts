import type { ManifestSchema } from "~/serapack-artifact/schema/ManifestSchema";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

export interface SerapackFileResourceLayout {
	readonly id: string;
	readonly type: ResourceTypeSchema.Type;
	readonly length: number;
	readonly offset: number;
}

/** Validated byte ranges of one Serapack file without materializing its payload. */
export interface SerapackFileLayout {
	readonly serapackPath: string;
	readonly contentHash: string;
	readonly configLength: number;
	readonly configOffset: number;
	readonly manifest: ManifestSchema.Type;
	readonly payloadLength: number;
	readonly payloadOffset: number;
	readonly proof?: Uint8Array;
	readonly resources: ReadonlyArray<SerapackFileResourceLayout>;
	readonly size: number;
}
