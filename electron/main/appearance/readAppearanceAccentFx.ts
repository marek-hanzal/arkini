import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { AppearanceAccentSchema } from "../../../desktop/appearance/AppearanceAccentSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace readAppearanceAccentFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
	}
}

/** Reads the persisted accent, recovering missing or malformed data to Arkini's rose default. */
export const readAppearanceAccentFx = Effect.fn("readAppearanceAccentFx")(function* ({
	root,
	fileSystem,
}: readAppearanceAccentFx.Props) {
	const path = join(root, "appearance.accent");
	const stored = yield* fileSystem.readFileString(path).pipe(
		Effect.map((value): string | null => value),
		Effect.catchIf(
			(cause) => cause._tag === "SystemError" && cause.reason === "NotFound",
			() => Effect.succeed(null),
		),
		Effect.mapError(
			(cause) =>
				new ElectronMainError({
					operation: "read the appearance accent preference",
					cause,
				}),
		),
	);
	if (stored === null) return "rose";
	const parsed = AppearanceAccentSchema.safeParse(stored.trim());
	return parsed.success ? parsed.data : "rose";
});
