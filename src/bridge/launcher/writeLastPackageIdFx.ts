import { Effect } from "effect";
import type { LastPackageIdSchema } from "../../../electron/contract/launcher/LastPackageIdSchema";
import { LastPackageIdError } from "~/bridge/launcher/LastPackageIdError";

/** Persists one successfully bootstrapped Game package for the next launcher session. */
export const writeLastPackageIdFx = Effect.fn("writeLastPackageIdFx")(
	(packageId: LastPackageIdSchema.Type) =>
		Effect.tryPromise({
			try: () => window.arkini.launcher.writeLastPackageId(packageId),
			catch: (cause) =>
				new LastPackageIdError({
					operation: "write",
					cause,
				}),
		}),
);
