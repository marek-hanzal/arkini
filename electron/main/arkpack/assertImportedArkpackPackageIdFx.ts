import { Effect } from "effect";

const packageIdPattern = /^[a-f0-9]{64}$/;

/** Validates one imported Arkpack SHA-256 package identity before filesystem use. */
export const assertImportedArkpackPackageIdFx = Effect.fn("assertImportedArkpackPackageIdFx")(
	(packageId: string) =>
		packageIdPattern.test(packageId)
			? Effect.succeed(packageId)
			: Effect.fail(new Error("Invalid imported Arkpack package identity.")),
);
