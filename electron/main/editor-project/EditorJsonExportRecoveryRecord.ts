import { FileSystem, Path } from "effect";
import { Effect } from "effect";
import { z } from "zod";

import { assertSafeEditorJsonExportRootFx } from "./assertSafeEditorJsonExportRootFx";

export const EditorJsonExportOwnershipFile = ".arkini-export-transaction";
export const EditorJsonExportCleanupSuffix = ".cleanup";

const schema = z
	.object({
		hadTarget: z.boolean(),
		source: z.string().min(1),
		target: z.string().min(1),
		transaction: z.string().uuid(),
	})
	.strict()
	.meta({
		id: "EditorJsonExportRecoveryRecordSchema",
		description: "One interrupted Editor JSON directory swap recovery record.",
	});

export type EditorJsonExportRecoveryRecord = z.infer<typeof schema>;

export const assertCanonicalEditorJsonExportRecoveryDirectoryFx = Effect.fn(
	"assertCanonicalEditorJsonExportRecoveryDirectoryFx",
)(function* (recoveryDirectory: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const name = path.basename(recoveryDirectory);
	const info = yield* fileSystem.stat(recoveryDirectory);
	if (
		info.type !== "Directory" ||
		(yield* fileSystem.realPath(recoveryDirectory)) !== recoveryDirectory
	)
		return yield* Effect.fail(
			new Error(`Editor export recovery entry ${name} is not canonical.`),
		);
});

export const readEditorJsonExportRecoveryRecordFx = Effect.fn(
	"readEditorJsonExportRecoveryRecordFx",
)(function* (recoveryDirectory: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const name = path.basename(recoveryDirectory);
	const transaction = name.endsWith(EditorJsonExportCleanupSuffix)
		? name.slice(0, -EditorJsonExportCleanupSuffix.length)
		: name;
	if (!z.string().uuid().safeParse(transaction).success)
		return yield* Effect.fail(new Error(`Editor export recovery entry ${name} is invalid.`));
	yield* assertCanonicalEditorJsonExportRecoveryDirectoryFx(recoveryDirectory);
	const recordFile = path.join(recoveryDirectory, "record.json");
	if (!(yield* fileSystem.exists(recordFile)))
		return yield* Effect.fail(new Error(`Editor export recovery entry ${name} has no record.`));
	const record = yield* fileSystem.readFileString(recordFile).pipe(
		Effect.flatMap((source) =>
			Effect.try({
				try: () => schema.parse(JSON.parse(source)),
				catch: (cause) => cause,
			}),
		),
	);
	if (
		!path.isAbsolute(record.source) ||
		!path.isAbsolute(record.target) ||
		record.transaction !== transaction
	)
		return yield* Effect.fail(new Error("Editor export recovery record is invalid."));
	const safeTarget = yield* assertSafeEditorJsonExportRootFx({
		source: record.source,
		target: record.target,
	});
	if (safeTarget !== record.target)
		return yield* Effect.fail(new Error("Editor export recovery target is not canonical."));
	return record;
});

export const readEditorJsonExportRecoveryPaths = (
	path: Path.Path,
	record: EditorJsonExportRecoveryRecord,
) => {
	const parent = path.dirname(record.target);
	const name = path.basename(record.target);
	return {
		marker: path.join(record.target, EditorJsonExportOwnershipFile),
		parent,
		pending: path.join(parent, `.${name}.${record.transaction}.pending`),
		previous: path.join(parent, `.${name}.${record.transaction}.previous`),
		restore: path.join(parent, `.${name}.${record.transaction}.restore`),
	};
};

export const isOwnedEditorJsonExportTargetFx = Effect.fn("isOwnedEditorJsonExportTargetFx")(
	function* (marker: string, transaction: string) {
		const fileSystem = yield* FileSystem.FileSystem;
		if (!(yield* fileSystem.exists(marker))) return false;
		const info = yield* fileSystem.stat(marker);
		return (
			info.type === "File" &&
			(yield* fileSystem.realPath(marker)) === marker &&
			(yield* fileSystem.readFileString(marker)) === transaction
		);
	},
);

export const assertCanonicalEditorJsonExportArtifactFx = Effect.fn(
	"assertCanonicalEditorJsonExportArtifactFx",
)(function* (target: string) {
	const fileSystem = yield* FileSystem.FileSystem;
	if (!(yield* fileSystem.exists(target))) return false;
	const info = yield* fileSystem.stat(target);
	if (info.type !== "Directory" || (yield* fileSystem.realPath(target)) !== target)
		return yield* Effect.fail(
			new Error(`Editor export recovery artifact ${target} is not canonical.`),
		);
	return true;
});
