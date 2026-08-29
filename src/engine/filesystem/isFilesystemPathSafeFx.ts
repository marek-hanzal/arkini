import { Effect, FileSystem, Path } from "effect";

/** Verifies every existing path component stays below the owned root and is not a link. */
export const isFilesystemPathSafeFx = Effect.fn("isFilesystemPathSafeFx")(function* (
	fileSystem: FileSystem.FileSystem,
	root: string,
	target: string,
) {
	const path = yield* Path.Path;
	const resolvedRoot = path.resolve(root);
	const resolvedTarget = path.resolve(target);
	const resolvedRelative = path.relative(resolvedRoot, resolvedTarget);
	if (resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) return false;
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
		if (
			yield* fileSystem.readLink(candidate).pipe(
				Effect.as(true),
				Effect.catch(() => Effect.succeed(false)),
			)
		)
			return false;
		if (!(yield* fileSystem.exists(candidate))) break;
		const canonicalCandidate = yield* fileSystem.realPath(candidate);
		const canonicalRelative = path.relative(canonicalRoot, canonicalCandidate);
		if (canonicalRelative.startsWith("..") || path.isAbsolute(canonicalRelative)) return false;
	}
	return true;
});
