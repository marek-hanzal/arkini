import { randomUUID } from "node:crypto";
import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { writeSyncedArkpackFileFx } from "./writeSyncedArkpackFileFx";

export namespace writeUserArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly record: ArkiniElectronApi.ArkpackInstall;
	}
}

/** Atomically installs one validated package into the user-preferred root. */
export const writeUserArkpackFx = Effect.fn("writeUserArkpackFx")(
	({ root, fileSystem, record }: writeUserArkpackFx.Props) =>
		Effect.gen(function* () {
			if (record.packageId.length === 0) {
				return yield* Effect.fail(new Error("Arkpack package identity is empty."));
			}
			if (record.bytes.byteLength > ArkpackLimits.maxCompressedBytes) {
				return yield* Effect.fail(
					new Error(
						`Arkpack exceeds the ${ArkpackLimits.maxCompressedBytes} byte compressed limit.`,
					),
				);
			}
			yield* fileSystem.makeDirectory(root, {
				recursive: true,
			});
			const filename = `${encodeURIComponent(record.packageId)}.game.arkpack`;
			const output = join(root, filename);
			const temporary = join(root, `.${filename}.${randomUUID()}.pending`);
			yield* writeSyncedArkpackFileFx({
				fileSystem,
				path: temporary,
				bytes: record.bytes,
			}).pipe(
				Effect.andThen(fileSystem.rename(temporary, output)),
				Effect.ensuring(
					fileSystem
						.remove(temporary, {
							force: true,
						})
						.pipe(Effect.orDie),
				),
			);
			yield* fileSystem.remove(`${output}.sig`, {
				force: true,
			});
		}).pipe(
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "install user Arkpack",
						cause,
					}),
			),
		),
);
