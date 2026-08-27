import { randomUUID } from "node:crypto";
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

const refuseOverwrite = (output: string) =>
	new ArkpackInputError({
		operation: "write-sign-key",
		message: `Refusing to overwrite existing signing environment ${output}.`,
		cause: {
			output,
		},
	});

/** Generates one signing secret and writes it as a protected dotenv input. */
export const writeArkpackSignKeyFx = Effect.fn("writeArkpackSignKeyFx")(function* ({
	force,
	output,
}: writeArkpackSignKeyFx.Props) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!force && (yield* fileSystem.exists(output))) {
		return yield* Effect.fail(refuseOverwrite(output));
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
	const pending = `${output}.${randomUUID()}.pending`;
	yield* Effect.gen(function* () {
		yield* fileSystem.writeFileString(pending, lines.join("\n"), {
			flag: "wx",
			mode: 0o600,
		});
		yield* fileSystem.chmod(pending, 0o600);
		yield* Effect.scoped(
			Effect.gen(function* () {
				const file = yield* fileSystem.open(pending, {
					flag: "r+",
				});
				yield* file.sync;
			}),
		);
		if (force) yield* fileSystem.rename(pending, output);
		else
			yield* fileSystem.link(pending, output).pipe(
				Effect.catch((cause) =>
					Effect.gen(function* () {
						if (yield* fileSystem.exists(output))
							return yield* Effect.fail(refuseOverwrite(output));
						return yield* Effect.fail(cause);
					}),
				),
			);
	}).pipe(
		Effect.ensuring(
			fileSystem
				.remove(pending, {
					force: true,
				})
				.pipe(Effect.ignore),
		),
	);
	return {
		output,
		publicKey: pair.publicKey,
	} as const;
});
