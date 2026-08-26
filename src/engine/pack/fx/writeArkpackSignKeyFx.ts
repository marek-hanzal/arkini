import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { ArkpackInputError } from "~/engine/pack/error/ArkpackInputError";
import { generateArkpackKeyPairFx } from "./generateArkpackKeyPairFx";

export namespace writeArkpackSignKeyFx {
	export interface Props {
		readonly force: boolean;
		readonly output: string;
	}
}

/** Generates one signing secret and writes it as a protected dotenv input. */
export const writeArkpackSignKeyFx = Effect.fn("writeArkpackSignKeyFx")(function* ({
	force,
	output,
}: writeArkpackSignKeyFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!force && (yield* fileSystem.exists(output))) {
		return yield* Effect.fail(
			new ArkpackInputError({
				operation: "write-sign-key",
				message: `Refusing to overwrite existing signing environment ${output}.`,
				cause: {
					output,
				},
			}),
		);
	}
	const pair = yield* generateArkpackKeyPairFx();
	const existing = (yield* fileSystem.exists(output))
		? yield* fileSystem.readFileString(output)
		: "";
	const lines = existing.split(/\r?\n/).filter((line) => !line.startsWith("ARKINI_SIGN_KEY="));
	while (lines.at(-1) === "") lines.pop();
	lines.push(`ARKINI_SIGN_KEY=${pair.signKey}`, "");
	yield* fileSystem.makeDirectory(path.dirname(path.resolve(output)), {
		recursive: true,
	});
	yield* fileSystem.writeFileString(output, lines.join("\n"), {
		mode: 0o600,
	});
	yield* fileSystem.chmod(output, 0o600);
	return {
		output,
		publicKey: pair.publicKey,
	} as const;
});
