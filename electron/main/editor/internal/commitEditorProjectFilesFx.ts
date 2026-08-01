import { FileSystem } from "effect";
import { Effect, Exit } from "effect";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

import { ElectronMainError } from "../../ElectronMainError";

interface CommitFile {
	readonly bytes: Uint8Array;
	readonly target: string;
}

export namespace commitEditorProjectFilesFx {
	export interface Props {
		readonly content: CommitFile;
		readonly fileSystem: FileSystem.FileSystem;
		readonly manifest: CommitFile;
	}
}

const ignoreFailure = <A, E>(effect: Effect.Effect<A, E>) =>
	effect.pipe(
		Effect.asVoid,
		Effect.orElseSucceed(() => void 0),
	);

/** Publishes one content file and editor.json together with rollback on runtime failure. */
export const commitEditorProjectFilesFx = Effect.fn("commitEditorProjectFilesFx")(function* ({
	content,
	fileSystem,
	manifest,
}: commitEditorProjectFilesFx.Props) {
	const token = randomUUID();
	const contentDirectory = dirname(content.target);
	const manifestDirectory = dirname(manifest.target);
	const contentPending = join(contentDirectory, `.${token}.pending`);
	const contentBackup = join(contentDirectory, `.${token}.backup`);
	const manifestPending = join(manifestDirectory, `.${token}.manifest.pending`);
	const manifestBackup = join(manifestDirectory, `.${token}.manifest.backup`);
	let contentBackedUp = false;
	let contentPublished = false;
	let manifestBackedUp = false;
	let manifestPublished = false;

	const stageExit = yield* Effect.exit(
		Effect.all(
			[
				fileSystem.writeFile(contentPending, content.bytes),
				fileSystem.writeFile(manifestPending, manifest.bytes),
			],
			{
				concurrency: 1,
			},
		),
	);
	if (Exit.isFailure(stageExit)) {
		yield* Effect.all(
			[
				ignoreFailure(
					fileSystem.remove(contentPending, {
						force: true,
					}),
				),
				ignoreFailure(
					fileSystem.remove(manifestPending, {
						force: true,
					}),
				),
			],
			{
				concurrency: 1,
			},
		);
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Commit Arkini editor project files",
				cause: stageExit.cause,
			}),
		);
	}

	const publishExit = yield* Effect.exit(
		Effect.gen(function* () {
			if (yield* fileSystem.exists(content.target)) {
				yield* fileSystem.rename(content.target, contentBackup);
				contentBackedUp = true;
			}
			yield* fileSystem.rename(manifest.target, manifestBackup);
			manifestBackedUp = true;
			yield* fileSystem.rename(contentPending, content.target);
			contentPublished = true;
			yield* fileSystem.rename(manifestPending, manifest.target);
			manifestPublished = true;
		}),
	);
	if (Exit.isFailure(publishExit)) {
		yield* Effect.all(
			[
				manifestPublished
					? ignoreFailure(
							fileSystem.remove(manifest.target, {
								force: true,
							}),
						)
					: Effect.void,
				manifestBackedUp
					? ignoreFailure(fileSystem.rename(manifestBackup, manifest.target))
					: Effect.void,
				contentPublished
					? ignoreFailure(
							fileSystem.remove(content.target, {
								force: true,
							}),
						)
					: Effect.void,
				contentBackedUp
					? ignoreFailure(fileSystem.rename(contentBackup, content.target))
					: Effect.void,
			],
			{
				concurrency: 1,
			},
		);
		yield* Effect.all(
			[
				ignoreFailure(
					fileSystem.remove(contentPending, {
						force: true,
					}),
				),
				ignoreFailure(
					fileSystem.remove(manifestPending, {
						force: true,
					}),
				),
				ignoreFailure(
					fileSystem.remove(contentBackup, {
						force: true,
					}),
				),
				ignoreFailure(
					fileSystem.remove(manifestBackup, {
						force: true,
					}),
				),
			],
			{
				concurrency: 1,
			},
		);
		return yield* Effect.fail(
			new ElectronMainError({
				operation: "Commit Arkini editor project files",
				cause: publishExit.cause,
			}),
		);
	}

	yield* Effect.all(
		[
			ignoreFailure(
				fileSystem.remove(contentBackup, {
					force: true,
				}),
			),
			ignoreFailure(
				fileSystem.remove(manifestBackup, {
					force: true,
				}),
			),
		],
		{
			concurrency: 1,
		},
	);
});
