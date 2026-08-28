import { Effect, FileSystem, Path } from "effect";

const isContained = (path: Path.Path, root: string, target: string) => {
	const relative = path.relative(root, target);
	return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

/** Verifies every existing path component stays below the owned root and is not a link. */
export const isFilesystemPathSafeFx = Effect.fn("isFilesystemPathSafeFx")(function* (
	fileSystem: FileSystem.FileSystem,
	root: string,
	target: string,
) {
	const path = yield* Path.Path;
	const resolvedRoot = path.resolve(root);
	const resolvedTarget = path.resolve(target);
	if (!isContained(path, resolvedRoot, resolvedTarget)) return false;
	const canonicalRoot = yield* fileSystem.realPath(resolvedRoot);
	const candidates = [
		resolvedRoot,
	];
	for (const segment of path
		.relative(resolvedRoot, resolvedTarget)
		.split(path.sep)
		.filter(Boolean))
		candidates.push(path.join(candidates.at(-1) ?? resolvedRoot, segment));
	for (const candidate of candidates) {
		if (!(yield* fileSystem.exists(candidate))) break;
		const canonicalCandidate = yield* fileSystem.realPath(candidate);
		if (!isContained(path, canonicalRoot, canonicalCandidate)) return false;
		if (
			yield* fileSystem.readLink(candidate).pipe(
				Effect.as(true),
				Effect.catch(() => Effect.succeed(false)),
			)
		)
			return false;
	}
	return true;
});
