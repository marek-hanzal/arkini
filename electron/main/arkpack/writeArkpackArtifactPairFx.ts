import { basename, dirname, join } from "node:path";
import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, FileSystem } from "effect";

import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { readArkpackSignaturePathFx } from "~/engine/pack/fx/readArkpackSignaturePathFx";
import type { ArkpackSignatureSchema } from "~/engine/pack/schema/ArkpackSignatureSchema";
import { readCanonicalArkpackPathFx } from "./recoverArkpackArtifactPairFx";

/** Writes an Arkpack and its optional detached signature as one recoverable pair. */
export const writeArkpackArtifactPairFx = Effect.fn("writeArkpackArtifactPairFx")(
	({
		arkpackPath,
		bytes,
		fileSystem,
		signature,
	}: {
		readonly arkpackPath: string;
		readonly bytes: Uint8Array;
		readonly fileSystem: FileSystem.FileSystem;
		readonly signature?: ArkpackSignatureSchema.Type;
	}) =>
		Effect.gen(function* () {
			const root = dirname(arkpackPath);
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			const target = yield* readCanonicalArkpackPathFx(fileSystem, arkpackPath);
			const signatureTarget = yield* readArkpackSignaturePathFx(target);
			const lock = join(dirname(target), `.${basename(target)}.lock`);
			const filesystemWrite = yield* createFilesystemWriteFx().pipe(
				Effect.provide(NodePath.layer),
				Effect.provideService(FileSystem.FileSystem, fileSystem),
			);
			yield* filesystemWrite.writeFilesFx({
				lock,
				root: dirname(target),
				writes: [
					...(signature === undefined
						? []
						: [
								{
									target: signatureTarget,
									bytes: new TextEncoder().encode(`${signature}\n`),
								},
							]),
					{
						target,
						bytes,
					},
				],
				deletes:
					signature === undefined
						? [
								signatureTarget,
							]
						: [],
			});
		}),
);
