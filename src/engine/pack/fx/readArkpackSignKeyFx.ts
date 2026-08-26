import { Effect } from "effect";

import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";
import { ArkpackSignKeySchema } from "~/engine/pack/schema/ArkpackSignKeySchema";

/** Reads the one explicit base64 signing input without consulting files or defaults. */
export const readArkpackSignKeyFx = Effect.fn("readArkpackSignKeyFx")((candidate?: string) =>
	Effect.try({
		try: () => ArkpackSignKeySchema.parse(candidate?.trim()),
		catch: (cause) =>
			new ArkpackInputError({
				operation: "read-sign-key",
				message: "ARKINI_SIGN_KEY must contain a base64-encoded Ed25519 PKCS8 PEM key.",
				cause,
			}),
	}),
);
