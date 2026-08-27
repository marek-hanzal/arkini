import * as NodeServices from "@effect/platform-node/NodeServices";
import { Deferred, Effect, FileSystem } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { writeArkpackSignKeyFx } from "~/engine/pack/fx/writeArkpackSignKeyFx";

describe("writeArkpackSignKeyFx", () => {
	it.effect("preserves the existing dotenv when atomic publication fails", () =>
		Effect.gen(function* () {
			const nodeFileSystem = yield* FileSystem.FileSystem;
			const root = yield* nodeFileSystem.makeTempDirectoryScoped();
			const output = `${root}/.env.local`;
			const previous = "EDITOR_PORT=4123\nARKINI_SIGN_KEY=old-value\n";
			yield* nodeFileSystem.writeFileString(output, previous);
			const fileSystem = {
				...nodeFileSystem,
				rename: (oldPath: string, newPath: string) =>
					newPath === output
						? nodeFileSystem.rename(`${root}/missing-key`, newPath)
						: nodeFileSystem.rename(oldPath, newPath),
			} satisfies FileSystem.FileSystem;

			const result = yield* Effect.result(
				writeArkpackSignKeyFx({
					force: true,
					output,
				}).pipe(Effect.provideService(FileSystem.FileSystem, fileSystem)),
			);

			expect(result._tag).toBe("Failure");
			expect(yield* nodeFileSystem.readFileString(output)).toBe(previous);
			const entries = yield* nodeFileSystem.readDirectory(root);
			expect(entries.filter((entry) => entry.endsWith(".pending"))).toEqual([]);
		}).pipe(Effect.provide(NodeServices.layer)),
	);

	it.effect("allows exactly one concurrent non-force writer to claim the output", () =>
		Effect.gen(function* () {
			const nodeFileSystem = yield* FileSystem.FileSystem;
			const root = yield* nodeFileSystem.makeTempDirectoryScoped();
			const output = `${root}/.env.local`;
			const bothReady = yield* Deferred.make<void>();
			let linkCalls = 0;
			const fileSystem = {
				...nodeFileSystem,
				link: (from: string, to: string) =>
					Effect.gen(function* () {
						linkCalls += 1;
						if (linkCalls === 2) yield* Deferred.succeed(bothReady, undefined);
						yield* Deferred.await(bothReady);
						yield* nodeFileSystem.link(from, to);
					}),
			} satisfies FileSystem.FileSystem;
			const write = writeArkpackSignKeyFx({
				force: false,
				output,
			}).pipe(Effect.provideService(FileSystem.FileSystem, fileSystem), Effect.result);

			const results = yield* Effect.all(
				[
					write,
					write,
				],
				{
					concurrency: "unbounded",
				},
			);

			expect(results.filter((result) => result._tag === "Success")).toHaveLength(1);
			expect(results.filter((result) => result._tag === "Failure")).toHaveLength(1);
			expect(yield* nodeFileSystem.readFileString(output)).toMatch(
				/^ARKINI_SIGN_KEY=[A-Za-z0-9+/]+=*\n$/,
			);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
});
