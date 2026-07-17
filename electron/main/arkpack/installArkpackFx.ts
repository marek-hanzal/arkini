import { FileSystem } from "@effect/platform";
import { Effect, Exit } from "effect";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { parseInstalledArkpackDescriptorFx } from "./parseInstalledArkpackDescriptorFx";
import { readInstalledArkpackFx } from "./readInstalledArkpackFx";
import { writeSyncedArkpackFileFx } from "./writeSyncedArkpackFileFx";

export namespace installArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly record: ArkiniDesktopApi.ArkpackRecord;
	}
}

/** Validates and atomically publishes one imported Arkpack directory. */
export const installArkpackFx = Effect.fn("installArkpackFx")(function* ({
	root,
	fileSystem,
	record: { descriptor, bytes },
}: installArkpackFx.Props) {
	const parsed = yield* parseInstalledArkpackDescriptorFx({
		value: descriptor,
		expectedPackageId: descriptor.packageId,
	});
	const id = parsed.packageId;
	const actualHash = createHash("sha256").update(bytes).digest("hex");
	if (actualHash !== id) {
		return yield* Effect.fail(
			new Error("Arkpack binary does not match its SHA-256 package identity."),
		);
	}
	if (parsed.compressedSize !== bytes.byteLength) {
		return yield* Effect.fail(
			new Error("Arkpack metadata size does not match its binary payload."),
		);
	}

	yield* fileSystem.makeDirectory(root, {
		recursive: true,
	});
	const finalDirectory = join(root, id);
	const installedExit = yield* Effect.exit(
		readInstalledArkpackFx({
			root,
			fileSystem,
			packageId: id,
		}),
	);
	if (Exit.isSuccess(installedExit) && installedExit.value !== null) {
		const installedHash = createHash("sha256").update(installedExit.value.bytes).digest("hex");
		if (installedHash === id) return;
	}
	if (Exit.isFailure(installedExit) || installedExit.value !== null) {
		yield* fileSystem.remove(finalDirectory, {
			recursive: true,
			force: true,
		});
	}

	const temporaryDirectory = join(root, `.${id}.${randomUUID()}.pending`);
	yield* fileSystem.makeDirectory(temporaryDirectory);
	yield* Effect.gen(function* () {
		yield* writeSyncedArkpackFileFx({
			fileSystem,
			path: join(temporaryDirectory, "package.arkpack"),
			bytes,
		});
		yield* writeSyncedArkpackFileFx({
			fileSystem,
			path: join(temporaryDirectory, "descriptor.json"),
			bytes: JSON.stringify(parsed),
		});
		yield* fileSystem.rename(temporaryDirectory, finalDirectory);
	}).pipe(
		Effect.ensuring(
			fileSystem
				.remove(temporaryDirectory, {
					recursive: true,
					force: true,
				})
				.pipe(Effect.ignore),
		),
	);
});
