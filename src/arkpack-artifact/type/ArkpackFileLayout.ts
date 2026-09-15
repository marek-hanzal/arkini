import type { ManifestSchema } from "~/arkpack-artifact/schema/ManifestSchema";

export interface ArkpackFileResourceLayout {
	readonly id: string;
	readonly mime: string;
	readonly length: number;
	readonly offset: number;
}

/** Validated byte ranges of one Arkpack file without materializing its payload. */
export interface ArkpackFileLayout {
	readonly arkpackPath: string;
	readonly contentHash: string;
	readonly configLength: number;
	readonly configOffset: number;
	readonly manifest: ManifestSchema.Type;
	readonly payloadLength: number;
	readonly payloadOffset: number;
	readonly proof?: Uint8Array;
	readonly resources: ReadonlyArray<ArkpackFileResourceLayout>;
	readonly size: number;
}
