import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { ElectronMainError } from "../ElectronMainError";

export namespace readCheatAvailabilityFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
	}
}

/** Reads application-wide cheat-tool availability, defaulting missing or malformed data to false. */
export const readCheatAvailabilityFx = Effect.fn("readCheatAvailabilityFx")(function* ({
	root,
	fileSystem,
}: readCheatAvailabilityFx.Props) {
	const path = join(root, "cheats.available");
	const stored = yield* fileSystem.readFileString(path).pipe(
		Effect.map((value): string | null => value),
		Effect.catchIf(
			(cause) => cause._tag === "SystemError" && cause.reason === "NotFound",
			() => Effect.succeed(null),
		),
		Effect.mapError(
			(cause) =>
				new ElectronMainError({
					operation: "read the cheat availability preference",
					cause,
				}),
		),
	);
	if (stored === null) return false;
	const value = stored.trim();
	if (value === "true") return true;
	if (value === "false") return false;
	return false;
});
