import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { LastPackageIdSchema } from "../../../desktop/launcher/LastPackageIdSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace readLastPackageIdFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
	}
}

/** Reads the last successfully played package, recovering missing or malformed data to no choice. */
export const readLastPackageIdFx = Effect.fn("readLastPackageIdFx")(function* ({
	root,
	fileSystem,
}: readLastPackageIdFx.Props) {
	const path = join(root, "launcher.last-package");
	const stored = yield* fileSystem.readFileString(path).pipe(
		Effect.map((value): string | null => value),
		Effect.catchIf(
			(cause) => cause._tag === "SystemError" && cause.reason === "NotFound",
			() => Effect.succeed(null),
		),
		Effect.mapError(
			(cause) =>
				new ElectronMainError({
					operation: "read the last package preference",
					cause,
				}),
		),
	);
	if (stored === null) return null;
	const parsed = LastPackageIdSchema.safeParse(stored);
	return parsed.success ? parsed.data : null;
});
