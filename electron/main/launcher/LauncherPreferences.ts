import type { Effect } from "effect";
import type { LastPackageIdSchema } from "../../../desktop/launcher/LastPackageIdSchema";

/** Effect-native main-process capability for application-wide launcher preferences. */
export interface LauncherPreferences {
	readonly readLastPackageIdFx: Effect.Effect<LastPackageIdSchema.Type | null, unknown>;
	readonly writeLastPackageIdFx: (
		packageId: LastPackageIdSchema.Type,
	) => Effect.Effect<void, unknown>;
}
