import { FileSystem } from "@effect/platform";
import { Effect, Option } from "effect";
import { join } from "node:path";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { parseInstalledArkpackDescriptorFx } from "./parseInstalledArkpackDescriptorFx";

const packageIdPattern = /^[a-f0-9]{64}$/;

export namespace listInstalledArkpacksFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
	}
}

/** Lists imported metadata without reading Arkpack payload bytes. */
export const listInstalledArkpacksFx = Effect.fn("listInstalledArkpacksFx")(function* ({
	root,
	fileSystem,
}: listInstalledArkpacksFx.Props) {
	yield* fileSystem.makeDirectory(root, {
		recursive: true,
	});
	const entries = yield* fileSystem.readDirectory(root);
	const candidates = yield* Effect.forEach(entries, (entry) => {
		if (!packageIdPattern.test(entry)) return Effect.succeed(Option.none());
		const directory = join(root, entry);
		return Effect.gen(function* () {
			const info = yield* fileSystem.stat(directory);
			if (info.type !== "Directory") return Option.none();
			const metadata = yield* fileSystem.readFileString(join(directory, "descriptor.json"));
			const value = yield* Effect.try({
				try: () => JSON.parse(metadata) as unknown,
				catch: (cause) => cause,
			});
			return Option.some(
				yield* parseInstalledArkpackDescriptorFx({
					value,
					expectedPackageId: entry,
				}),
			);
		}).pipe(Effect.catchAll(() => Effect.succeed(Option.none())));
	});
	return candidates
		.filter(Option.isSome)
		.map(({ value }) => value)
		.sort(
			(left, right) =>
				(right.importedAtMs ?? 0) - (left.importedAtMs ?? 0) ||
				left.packageId.localeCompare(right.packageId),
		) satisfies ReadonlyArray<ArkiniDesktopApi.ArkpackDescriptor>;
});
