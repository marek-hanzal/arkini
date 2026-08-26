import { Argument, Command, Flag } from "effect/unstable/cli";
import { Console, Effect, Option } from "effect";

import { ArkiniBuiltPublicKey } from "~/engine/pack/ArkiniBuiltPublicKey";
import { verifyArkpackFileFx } from "~/engine/pack/fx/verifyArkpackFileFx";
import { ArkpackPublicKeySchema } from "~/engine/pack/schema/ArkpackPublicKeySchema";
import { handleArkpackInputErrorFx } from "./handleArkpackInputErrorFx";

const runArkpackVerifyFx = Effect.fn("runArkpackVerifyFx")(function* ({
	arkpackPath,
	publicKey: candidatePublicKey,
}: {
	readonly arkpackPath: string;
	readonly publicKey?: string;
}) {
	const publicKey =
		candidatePublicKey !== undefined
			? yield* Effect.try({
					try: () => ArkpackPublicKeySchema.parse(candidatePublicKey),
					catch: (cause) => cause,
				})
			: ArkiniBuiltPublicKey;
	if (publicKey === undefined)
		return yield* Effect.fail(
			new Error("This Arkini CLI has no embedded public key; pass --public-key."),
		);
	const result = yield* verifyArkpackFileFx({
		arkpackPath,
		publicKey,
	});
	yield* Console.log(JSON.stringify(result));
	if (result.trust.type === "invalid") {
		return yield* Effect.fail(
			new Error(`Arkpack signature is invalid: ${result.trust.reason}.`),
		);
	}
});

export const ArkpackVerifyCommand = Command.make(
	"verify",
	{
		arkpack: Argument.file("arkpack"),
		publicKey: Flag.optional(
			Flag.string("public-key").pipe(
				Flag.withDescription(
					"Explicit base64 SPKI key instead of this CLI build identity.",
				),
			),
		),
	},
	({ arkpack, publicKey }) =>
		runArkpackVerifyFx({
			arkpackPath: arkpack,
			publicKey: Option.getOrUndefined(publicKey),
		}).pipe(Effect.catch(handleArkpackInputErrorFx)),
).pipe(Command.withDescription("Verify one Arkpack against exactly one public key."));
