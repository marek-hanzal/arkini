import { FileSystem, Path } from "@effect/platform";
import { Effect } from "effect";

import { generateArkpackKeyPairFx } from "./generateArkpackKeyPairFx";

export namespace writeArkpackKeyPairFx {
	export interface Props {
		readonly force: boolean;
		readonly privateKeyOutput: string;
		readonly publicKeyOutput: string;
	}
}

/** Generates and writes one maintainer Ed25519 key pair without printing private bytes. */
export const writeArkpackKeyPairFx = Effect.fn("writeArkpackKeyPairFx")(function* ({
	force,
	privateKeyOutput,
	publicKeyOutput,
}: writeArkpackKeyPairFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const outputs = [
		privateKeyOutput,
		publicKeyOutput,
	];
	if (!force) {
		for (const output of outputs) {
			if (yield* fileSystem.exists(output)) {
				return yield* Effect.fail(
					new Error(`Refusing to overwrite existing Arkpack key output ${output}.`),
				);
			}
		}
	}
	const pair = yield* generateArkpackKeyPairFx();
	for (const output of outputs) {
		yield* fileSystem.makeDirectory(path.dirname(path.resolve(output)), {
			recursive: true,
		});
	}
	yield* Effect.all(
		[
			fileSystem.writeFileString(privateKeyOutput, pair.privateKey, {
				mode: 0o600,
			}),
			fileSystem.writeFileString(publicKeyOutput, pair.publicKey),
		],
		{
			concurrency: "unbounded",
			discard: true,
		},
	);
	yield* fileSystem.chmod(privateKeyOutput, 0o600);
	return {
		privateKeyOutput,
		publicKeyOutput,
	} as const;
});
