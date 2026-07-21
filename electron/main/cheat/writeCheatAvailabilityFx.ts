import { FileSystem } from "@effect/platform";
import { Effect } from "effect";
import { join } from "node:path";
import { CheatAvailabilitySchema } from "../../../desktop/cheat/CheatAvailabilitySchema";
import { ElectronMainError } from "../ElectronMainError";

export namespace writeCheatAvailabilityFx {
	export interface Props {
		readonly root: string;
		readonly fileSystem: FileSystem.FileSystem;
		readonly available: CheatAvailabilitySchema.Type;
	}
}

/** Atomically persists whether save-scoped cheat tooling is exposed by the application. */
export const writeCheatAvailabilityFx = Effect.fn("writeCheatAvailabilityFx")(function* ({
	root,
	fileSystem,
	available,
}: writeCheatAvailabilityFx.Props) {
	const validAvailable = yield* Effect.try({
		try: () => CheatAvailabilitySchema.parse(available),
		catch: (cause) =>
			new ElectronMainError({
				operation: "persist the cheat availability preference",
				cause,
			}),
	});
	const pending = join(root, "cheats-available.pending");
	const current = join(root, "cheats.available");
	yield* fileSystem
		.makeDirectory(root, {
			recursive: true,
		})
		.pipe(
			Effect.zipRight(fileSystem.writeFileString(pending, String(validAvailable))),
			Effect.zipRight(
				fileSystem.rename(pending, current).pipe(
					Effect.ensuring(
						fileSystem
							.remove(pending, {
								force: true,
							})
							.pipe(Effect.ignore),
					),
				),
			),
			Effect.mapError(
				(cause) =>
					new ElectronMainError({
						operation: "persist the cheat availability preference",
						cause,
					}),
			),
		);
});
