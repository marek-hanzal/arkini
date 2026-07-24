import { Effect } from "effect";

const packageIdPattern = /^[a-f0-9]{64}$/;

/** Validates one imported Arkpack SHA-256 package identity before filesystem use. */
export const assertImportedArkpackPackageIdFx = Effect.fn("assertImportedArkpackPackageIdFx")(
	function* (packageId: string) {
		if (packageIdPattern.test(packageId)) return packageId;
		return yield* Effect.fail(new Error("Invalid imported Arkpack package identity."));
	},
);
