import { FileSystem } from "effect";
import { Effect } from "effect";
import { join } from "node:path";
import { AppearanceThemeSchema } from "../../contract/appearance/AppearanceThemeSchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace readAppearanceThemeFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
	}
}

/** Reads the persisted preference, recovering missing or malformed data to Arkini's dark default. */
export const readAppearanceThemeFx = Effect.fn("readAppearanceThemeFx")(function* ({
	root,
	fileSystem,
}: readAppearanceThemeFx.Props) {
	const path = join(root, "appearance.theme");
	const stored = yield* fileSystem.readFileString(path).pipe(
		Effect.map((value): string | null => value),
		Effect.catchIf(
			(cause) => cause.reason._tag === "NotFound",
			() => Effect.succeed(null),
		),
		Effect.mapError(
			(cause) =>
				new ElectronMainError({
					operation: "read the appearance preference",
					cause,
				}),
		),
	);
	if (stored === null) return "dark";
	const parsed = AppearanceThemeSchema.safeParse(stored.trim());
	return parsed.success ? parsed.data : "dark";
});
