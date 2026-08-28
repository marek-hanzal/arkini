import type { Effect } from "effect";
import type { LastPackageIdSchema } from "../../contract/launcher/LastPackageIdSchema";
import type { ElectronMainError } from "../ElectronMainError";

/** Effect-native main-process capability for application-wide launcher preferences. */
export interface LauncherPreferences {
	readonly readLastPackageIdFx: Effect.Effect<LastPackageIdSchema.Type | null, ElectronMainError>;
	readonly writeLastPackageIdFx: (
		packageId: LastPackageIdSchema.Type,
	) => Effect.Effect<void, ElectronMainError>;
}
