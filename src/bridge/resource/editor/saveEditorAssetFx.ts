import { Effect } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorWorkspace } from "~/bridge/editor/EditorWorkspace";
import { createEditorProjectFromWriteFx } from "~/bridge/editor/createEditorProjectFromWriteFx";
import { createEditorWorkspaceFx } from "~/bridge/editor/createEditorWorkspaceFx";
import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { compileEditorProjectFilesFx } from "~/engine/editor/fx/compileEditorProjectFilesFx";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import {
	validateResourceEditorSourceIdFx,
} from "~/engine/resource/editor/fx/createResourceEditorSourceFilesFx";

const pngMagic = [
	137,
	80,
	78,
	71,
	13,
	10,
	26,
	10,
] as const;
const maxPngBytes = 16 * 1024 * 1024;
const maxPngDimension = 8192;
const maxPngPixels = 16 * 1024 * 1024;

interface EditorAssetFileInput {
	readonly name: string;
	readonly size: number;
	readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

const readResourceId = (filename: string) =>
	filename
		.replace(/\.png$/i, "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/^[.-]+|[.-]+$/g, "")
		.toLowerCase();

const readPngDimensionsFx = (bytes: Uint8Array, resourceId: string) =>
	Effect.scoped(
		Effect.gen(function* () {
			const bitmap = yield* Effect.acquireRelease(
				Effect.tryPromise({
					try: () =>
						createImageBitmap(
							new Blob(
								[
									bytes.slice().buffer,
								],
								{
									type: "image/png",
								},
							),
						),
					catch: (cause) =>
						new EditorProjectError({
							reason: "unsupported-project-file",
							message: `Asset ${resourceId} must decode as a valid PNG image.`,
							cause,
						}),
				}),
				(bitmap) => Effect.sync(() => bitmap.close()),
			);
			return {
				height: bitmap.height,
				width: bitmap.width,
			};
		}),
	);

/** Validates one PNG, compiles it against memory, and persists only the asset delta. */
export const saveEditorAssetFx = Effect.fn("saveEditorAssetFx")(function* ({
	expectedRevision,
	file: inputFile,
	project,
	workspace: providedWorkspace,
}: {
	readonly expectedRevision: string;
	readonly file: EditorAssetFileInput;
	readonly project: EditorProject;
	readonly workspace?: EditorWorkspace;
}) {
	if (!inputFile.name.toLowerCase().endsWith(".png") || inputFile.size > maxPngBytes) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Asset ${inputFile.name} must be a PNG no larger than ${maxPngBytes} bytes.`,
			}),
		);
	}
	if (project.revision !== expectedRevision) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Editor project ${project.projectId} changed after the asset picker opened.`,
			}),
		);
	}
	const proposedResourceId = yield* validateResourceEditorSourceIdFx(
		readResourceId(inputFile.name),
	);
	const bytes = yield* Effect.tryPromise({
		try: async () => new Uint8Array(await inputFile.arrayBuffer()),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Asset ${proposedResourceId} could not be read.`,
				cause,
			}),
	});
	const hasPngEnvelope =
		bytes.byteLength >= 24 &&
		bytes.byteLength <= maxPngBytes &&
		pngMagic.every((byte, index) => bytes[index] === byte);
	if (!hasPngEnvelope) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Asset ${proposedResourceId} must be a valid bounded PNG image.`,
			}),
		);
	}
	const { height, width } = yield* readPngDimensionsFx(bytes, proposedResourceId);
	if (
		width < 1 ||
		height < 1 ||
		width > maxPngDimension ||
		height > maxPngDimension ||
		width * height > maxPngPixels
	) {
		return yield* Effect.fail(
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Asset ${proposedResourceId} exceeds the supported PNG dimensions.`,
			}),
		);
	}
	const sourcePath = Object.values(project.fileIndex).find(({ path }) => {
		if (!path.startsWith("assets/") && !path.startsWith("resources/")) return false;
		const filename = path.slice(path.lastIndexOf("/") + 1);
		return filename.toLowerCase() === `${proposedResourceId}.png`.toLowerCase();
	})?.path;
	const resourceId =
		sourcePath === undefined
			? proposedResourceId
			: sourcePath.slice(sourcePath.lastIndexOf("/") + 1, -".png".length);
	const { file, sourceFiles } = yield* Effect.try({
		try: () => ({
			file: EditorSourceFileSchema.parse({
				path: sourcePath ?? `assets/${resourceId}.png`,
				bytes,
			}),
			sourceFiles: EditorSourceFileSchema.array().parse(
				Object.values(project.fileIndex).filter(({ path }) => path !== "editor.json"),
			),
		}),
		catch: (cause) =>
			new EditorProjectError({
				reason: "unsupported-project-file",
				message: `Asset ${resourceId} cannot be represented in this project.`,
				cause,
			}),
	});
	const mode = sourcePath === undefined ? "create" : "replace";
	const candidateFiles = [
		...sourceFiles.filter(({ path }) => path !== sourcePath),
		file,
	];
	const compilation = yield* compileEditorProjectFilesFx(candidateFiles);
	const workspace = providedWorkspace ?? (yield* createEditorWorkspaceFx());
	const write = yield* workspace.writeFx({
		projectId: project.projectId,
		file,
		expectedRevision,
		mode,
	});
	const nextProject = yield* createEditorProjectFromWriteFx({
		compilation,
		project,
		write,
	});
	return {
		project: nextProject,
		resourceId,
		revision: write.revision,
	};
});
