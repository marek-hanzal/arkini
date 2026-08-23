import type { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import type { ElectronMainError } from "../ElectronMainError";

/** Thin main-process filesystem capability over bundled and user Arkpack roots. */
export interface ArkpackCatalog {
	readonly listFx: Effect.Effect<ReadonlyArray<ArkiniElectronApi.ArkpackFile>, ElectronMainError>;
	readonly readFx: (
		packageId: string,
	) => Effect.Effect<ReadonlyArray<ArkiniElectronApi.ArkpackFile>, ElectronMainError>;
	readonly installFx: (
		record: ArkiniElectronApi.ArkpackInstall,
	) => Effect.Effect<void, ElectronMainError>;
	readonly removeFx: (packageId: string) => Effect.Effect<void, ElectronMainError>;
}
