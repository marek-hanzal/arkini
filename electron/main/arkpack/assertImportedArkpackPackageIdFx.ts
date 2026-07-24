import { Effect } from "effect";
import { ElectronMainError } from "../ElectronMainError";

const packageIdPattern = /^[a-f0-9]{64}$/;

/** Validates one imported Arkpack SHA-256 package identity before filesystem use. */
export const assertImportedArkpackPackageIdFx = Effect.fn("assertImportedArkpackPackageIdFx")(
	function* (packageId: string) {
		if (packageIdPattern.test(packageId)) return packageId;
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Invalid imported Arkpack package identity",
				cause: packageId,
			}),
		);
	},
);
