import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

export namespace writeSyncedArkpackFileFx {
	export interface Props {
		readonly fileSystem: FileSystem.FileSystem;
		readonly path: string;
		readonly bytes: Uint8Array | string;
	}
}

/** Writes and fsyncs one Arkpack catalog file before atomic directory publication. */
export const writeSyncedArkpackFileFx = Effect.fn("writeSyncedArkpackFileFx")(
	({ fileSystem, path, bytes }: writeSyncedArkpackFileFx.Props) =>
		Effect.scoped(
			Effect.gen(function* () {
				const file = yield* fileSystem.open(path, {
					flag: "w",
				});
				yield* file.writeAll(
					typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes,
				);
				yield* file.sync;
			}),
		),
);
