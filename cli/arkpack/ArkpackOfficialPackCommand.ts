import { Command } from "@effect/cli";
import { Console, Effect } from "effect";

import { packSignedDirectoryFx } from "~/engine/pack/fx/packSignedDirectoryFx";
import { readArkpackPrivateKeyFx } from "~/engine/pack/fx/readArkpackPrivateKeyFx";
import { readArkpackTrustedKeysFx } from "~/engine/pack/fx/readArkpackTrustedKeysFx";

const keyId = "arkini-official-2026-01";

export const ArkpackOfficialPackCommand = Command.make("pack-official", {}, () =>
	Effect.gen(function* () {
		const privateKey = yield* readArkpackPrivateKeyFx({
			environmentValue: process.env.ARKINI_ARKPACK_PRIVATE_KEY,
			path: ".arkini/arkpack-private.pem",
		});
		const trustedKeys = yield* readArkpackTrustedKeysFx("game/arkini.arkpack.keys.json");
		const result = yield* packSignedDirectoryFx({
			input: "game/arkini",
			keyId,
			metadata: {
				output: "game/arkini.game.arkpack.metadata.json",
				packageId: "arkini",
			},
			privateKey,
			trustedKeys,
		});
		yield* Console.log(`Packed and verified ${result.packed.output} with ${keyId}.`);
	}),
).pipe(Command.withDescription("Pack, sign, and post-verify the bundled official Arkini package."));
