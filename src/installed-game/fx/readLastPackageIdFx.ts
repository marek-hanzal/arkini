import { Effect } from "effect";
import { LastPackageIdSchema } from "../../../electron/contract/launcher/LastPackageIdSchema";
import { LastPackageIdError } from "~/installed-game/error/LastPackageIdError";

/** Reads and validates the package ID last persisted after successful Game bootstrap. */
export const readLastPackageIdFx = Effect.fn("readLastPackageIdFx")(() =>
	Effect.tryPromise({
		try: async () => {
			const packageId = await window.arkini.launcher.readLastPackageId();
			return packageId === null ? null : LastPackageIdSchema.parse(packageId);
		},
		catch: (cause) =>
			new LastPackageIdError({
				operation: "read",
				cause,
			}),
	}),
);
