import type { Effect } from "effect";
import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

export namespace ArkpackStorage {
	export interface LoadedRecord {
		readonly descriptor: ArkpackDescriptor;
		readonly bytes: ArrayBuffer;
	}
}

/** Effect-native renderer capability for installed Arkpack persistence. */
export interface ArkpackStorage {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkpackDescriptor>, unknown>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ArkpackStorage.LoadedRecord | undefined, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
	readonly writeFx: (
		descriptor: ArkpackDescriptor,
		bytes: ArrayBuffer,
	) => Effect.Effect<void, unknown>;
}
