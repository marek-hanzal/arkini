import { app } from "electron";
import { Effect, FileSystem, Path } from "effect";

const containsPath = (path: Path.Path, parent: string, candidate: string) => {
	const relative = path.relative(parent, candidate);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const overlapsPath = (path: Path.Path, left: string, right: string) =>
	containsPath(path, left, right) || containsPath(path, right, left);

/** Resolves and rejects any export target that could replace an Arkini-owned or broad tree. */
export const assertSafeEditorJsonExportRootFx = Effect.fn("assertSafeEditorJsonExportRootFx")(
	function* ({ source, target }: { readonly source: string; readonly target: string }) {
		const fileSystem = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const absolute = path.resolve(target);
		const targetExists = yield* fileSystem.exists(absolute);
		const resolved = yield* targetExists
			? fileSystem.realPath(absolute)
			: fileSystem
					.realPath(path.dirname(absolute))
					.pipe(Effect.map((parent) => path.join(parent, path.basename(absolute))));
		if (path.parse(resolved).root === resolved)
			return yield* Effect.fail(
				new Error("A filesystem root cannot be replaced by the Editor."),
			);
		const sourceExists = yield* fileSystem.exists(source);
		const resolvedSource = yield* sourceExists
			? fileSystem.realPath(source)
			: Effect.succeed(path.resolve(source));
		if (overlapsPath(path, resolvedSource, resolved))
			return yield* Effect.fail(
				new Error(
					"The export folder cannot contain or be contained by the open Editor project.",
				),
			);

		const home = yield* fileSystem.realPath(app.getPath("home"));
		const protectedTrees = yield* Effect.forEach(
			[
				app.getPath("userData"),
				...(app.isPackaged
					? [
							app.getAppPath(),
							...(typeof process.resourcesPath === "string"
								? [
										process.resourcesPath,
									]
								: []),
						]
					: []),
			],
			fileSystem.realPath,
		);
		if (
			containsPath(path, resolved, home) ||
			protectedTrees.some((protectedPath) => overlapsPath(path, resolved, protectedPath))
		)
			return yield* Effect.fail(
				new Error(
					"Choose a dedicated export folder outside the home root, application bundle, and Arkini data directory.",
				),
			);
		return resolved;
	},
);
