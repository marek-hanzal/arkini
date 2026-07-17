import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";
import { parseInstalledArkpackDescriptorFx } from "./parseInstalledArkpackDescriptorFx";

export namespace readInstalledArkpackFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly packageId: string;
	}
}

/** Reads one exact installed Arkpack descriptor and binary. */
export const readInstalledArkpackFx = Effect.fn("readInstalledArkpackFx")(function* ({
	root,
	fileSystem,
	packageId,
}: readInstalledArkpackFx.Props) {
	const id = yield* assertImportedArkpackPackageIdFx(packageId);
	const directory = join(root, id);
	if (!(yield* fileSystem.exists(directory))) return null;
	const [metadata, bytes] = yield* Effect.all(
		[
			fileSystem.readFileString(join(directory, "descriptor.json")),
			fileSystem.readFile(join(directory, "package.arkpack")),
		] as const,
		{
			concurrency: "unbounded",
		},
	);
	const descriptor = yield* Effect.try({
		try: () => JSON.parse(metadata) as unknown,
		catch: (cause) =>
			new Error("Invalid Arkpack metadata JSON.", {
				cause,
			}),
	}).pipe(
		Effect.flatMap((value) =>
			parseInstalledArkpackDescriptorFx({
				value,
				expectedPackageId: id,
			}),
		),
	);
	return {
		descriptor,
		bytes: Uint8Array.from(bytes),
	} satisfies ArkiniDesktopApi.ArkpackRecord;
});
