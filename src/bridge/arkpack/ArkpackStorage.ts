import type { Effect } from "effect";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";

export namespace ArkpackStorage {
	export interface File {
		readonly packageId: string;
		readonly filename: string;
		readonly bytes: ArrayBuffer;
		readonly trust: ArkpackTrustSchema.Type;
		readonly source: "bundled" | "user";
		readonly overridesBundled: boolean;
	}
}

/** Effect-native renderer capability for installed Arkpack persistence. */
export interface ArkpackStorage {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkpackStorage.File>, unknown>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<ArkpackStorage.File>, unknown>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, unknown>;
	readonly writeFx: (packageId: string, bytes: ArrayBuffer) => Effect.Effect<void, unknown>;
	readonly openUserDirectoryFx: Effect.Effect<void, unknown>;
}
