import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { join } from "node:path";

import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";

const root = process.argv[2];
if (root === undefined) throw new Error("Expected a lock root.");

await Effect.runPromise(
	Effect.gen(function* () {
		const filesystemWrite = yield* createFilesystemWriteFx();
		yield* filesystemWrite.withLockFx(
			join(root, ".write.lock"),
			Effect.sync(() => process.stdout.write("locked\n")).pipe(
				Effect.andThen(Effect.sleep("2 seconds")),
			),
		);
	}).pipe(Effect.provide(NodeServices.layer)),
);
