import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ArkpackLimits } from "../../../shared/ArkpackLimits";
import { ElectronMainError } from "../ElectronMainError";
import { writeArkpackFileFx } from "./writeArkpackFileFx";
import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

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
			if (record.bytes.byteLength > ArkpackLimits.maxArkpackBytes) {
				return yield* Effect.fail(
					new Error(`Arkpack exceeds the ${ArkpackLimits.maxArkpackBytes} byte limit.`),
				);
			}
			const stem = encodeGameProjectFileStem(record.packageId);
			yield* writeArkpackFileFx({
				arkpackPath: join(root, `${stem}.arkpack`),
				bytes: record.bytes,
				fileSystem,
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
