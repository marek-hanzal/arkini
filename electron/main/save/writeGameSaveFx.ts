import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { assertGameSaveKeyFx } from "./assertGameSaveKeyFx";

export namespace writeGameSaveFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly key: ArkiniDesktopApi.SaveKey;
		readonly bytes: Uint8Array;
	}
}

/** Fsyncs one pending save then atomically replaces the exact committed save. */
export const writeGameSaveFx = Effect.fn("writeGameSaveFx")(function* ({
	root,
	fileSystem,
	key,
	bytes,
}: writeGameSaveFx.Props) {
	const valid = yield* assertGameSaveKeyFx(key);
	const directory = join(root, valid.packageId, valid.contentHash);
	const pending = join(directory, "pending.arksave");
	const current = join(directory, "current.arksave");
	yield* fileSystem.makeDirectory(directory, {
		recursive: true,
	});
	yield* Effect.scoped(
		Effect.gen(function* () {
			const file = yield* fileSystem.open(pending, {
				flag: "w",
			});
			yield* file.writeAll(bytes);
			yield* file.sync;
		}),
	);
	yield* fileSystem.rename(pending, current).pipe(
		Effect.ensuring(
			fileSystem
				.remove(pending, {
					force: true,
				})
				.pipe(Effect.ignore),
		),
	);
});
