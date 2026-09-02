import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import type {
	ProjectVersionDescriptor,
	ProjectVersionDiff,
	ProjectVersionReference,
} from "~/project-version/type/ProjectVersion";
import {
	ProjectVersionBodySchema,
	ProjectVersionSubjectSchema,
	ProjectVersionTagSchema,
} from "~/project-version/schema/ProjectVersionMetadataSchema";
import { IdSchema } from "~/game-config/schema/IdSchema";

type ToolResult = {
	readonly isError?: boolean;
	readonly content: Array<{
		readonly type: "text";
		readonly text: string;
	}>;
};

type RunTool = (effect: Effect.Effect<string, unknown, never>) => Promise<ToolResult>;

const referenceSchema = z
	.union([
		z.literal("current"),
		IdSchema,
	])
	.meta({
		id: "VersionReferenceSchema",
		description: 'Use "current" for the saved working copy or an exact version ID.',
	});

const VersionStatusInputSchema = z.object({}).strict().meta({
	$id: "urn:arkini:schema:mcp:version-status-input",
	title: "Version status tool input",
	description: "The version status tool accepts no arguments.",
});

const VersionCommitPreviewInputSchema = z.object({}).strict().meta({
	$id: "urn:arkini:schema:mcp:version-commit-preview-input",
	title: "Version commit preview tool input",
	description: "The version commit preview tool accepts no arguments.",
});

const VersionListInputSchema = z
	.object({
		limit: z.number().int().min(1).max(100).default(50),
		offset: z.number().int().min(0).default(0),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:version-list-input",
		title: "Version list tool input",
		description: "Pagination for the saved project version list.",
	});

const VersionDiffInputSchema = z
	.object({
		from: referenceSchema,
		to: referenceSchema,
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:version-diff-input",
		title: "Version diff tool input",
		description: "The two saved-state references compared by the version diff tool.",
	});

const VersionCommitInputSchema = z
	.object({
		message: ProjectVersionSubjectSchema,
		body: ProjectVersionBodySchema.optional(),
		previewFingerprint: z
			.string()
			.regex(/^[a-f0-9]{64}$/)
			.describe("Exact fingerprint returned by version_commit_preview."),
		tag: ProjectVersionTagSchema.optional(),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:version-commit-input",
		title: "Version commit tool input",
		description: "Metadata for a new explicit snapshot of the saved editor project.",
	});

const VersionCheckoutInputSchema = z
	.object({
		versionId: IdSchema,
		confirmDiscardCurrentChanges: z
			.literal(true)
			.describe(
				"Must be true to acknowledge permanent loss of the current saved state and unsaved drafts.",
			),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:version-checkout-input",
		title: "Version checkout tool input",
		description: "The saved version to restore and the required destructive confirmation.",
	});

const VersionTagInputSchema = z
	.object({
		versionId: IdSchema,
		tag: ProjectVersionTagSchema.optional(),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:version-tag-input",
		title: "Version tag tool input",
		description: "The saved version and optional replacement tag.",
	});

const decodeReferenceFn = (value: string): ProjectVersionReference =>
	value === "current"
		? {
				type: "current",
			}
		: {
				type: "version",
				versionId: value,
			};

const describeVersionFn = (version: ProjectVersionDescriptor) =>
	[
		`${version.versionId} · ${version.subject}`,
		`  ${new Date(version.createdAtMs).toISOString()} · Arkpack v${version.arkpackVersion} · Arkini ${version.arkini}`,
		...(version.parentVersionId === undefined
			? []
			: [
					`  Parent: ${version.parentVersionId}`,
				]),
		...(version.tag === undefined
			? []
			: [
					`  Tag: ${version.tag}`,
				]),
	].join("\n");

const formatDiffFn = (diff: ProjectVersionDiff) => {
	const formatBumpFn = (bump: "major" | "minor" | undefined) =>
		bump === undefined ? "" : ` · ${bump} bump`;
	const lines = [
		"Version diff",
		`Changed: ${diff.hasChanges ? "yes" : "no"}`,
		`Project fields: ${diff.project.length}`,
		...diff.project.map(({ bump, path }) => `  ${path}${formatBumpFn(bump)}`),
		`Items: ${diff.items.length}`,
		...diff.items.flatMap(({ change, uid, values }) => [
			`  ${change} ${uid} · ${values.length} field changes`,
			...values.map(({ bump, path }) => `    ${path || "Entire item"}${formatBumpFn(bump)}`),
		]),
		`Resources: ${diff.resources.length}`,
		...diff.resources.map(({ bump, change, id }) => `  ${change} ${id}${formatBumpFn(bump)}`),
		`Board scenarios: ${diff.scenarios.length}`,
		...diff.scenarios.map(({ change, id }) => `  ${change} ${id}`),
	];
	return lines.join("\n");
};

export namespace registerVersionToolsFn {
	export interface Props {
		readonly notifyProjectChangedFn: (projectId: string) => void;
		readonly readProjectFx: () => Effect.Effect<Project, unknown, never>;
		readonly repository: ProjectRepositoryService;
		readonly requestVersionCheckoutFx: (
			projectId: string,
			versionId: string,
		) => Effect.Effect<void, unknown, never>;
		readonly runToolFn: RunTool;
		readonly server: McpServer;
	}
}

/** Registers explicit, saved-state version tools without exposing raw snapshot payloads. */
export const registerVersionToolsFn = ({
	notifyProjectChangedFn,
	readProjectFx,
	repository,
	requestVersionCheckoutFx,
	runToolFn,
	server,
}: registerVersionToolsFn.Props) => {
	server.registerTool(
		"version_status",
		{
			description:
				"Read whether the open project's saved working copy differs from its current version base.",
			inputSchema: VersionStatusInputSchema,
		},
		async () =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => repository.readVersionStatusFx(project.projectId)),
					Effect.map((status) =>
						[
							"Version status",
							`Versions: ${status.versionCount}`,
							`Working copy: ${status.dirty ? "dirty" : "clean"}`,
							`Current base: ${status.currentBaseVersionId ?? "none"}`,
							`Can commit: ${status.canCommit ? "yes" : "no"}`,
						].join("\n"),
					),
				),
			),
	);
	server.registerTool(
		"version_commit_preview",
		{
			description:
				"Preview the exact Arkpack version, compatibility bump, diff, and Board scenario deletions that version_commit would apply to the open project's saved working copy.",
			inputSchema: VersionCommitPreviewInputSchema,
		},
		async () =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository.previewVersionCommitFx(project.projectId),
					),
					Effect.map((preview) =>
						[
							"Version commit preview",
							`Resulting Arkpack: v${preview.nextArkpackVersion}`,
							`Compatibility bump: ${preview.bump}`,
							`Board scenarios deleted by commit: ${preview.scenariosToDelete.length}`,
							...preview.scenariosToDelete.map((name) => `  ${name}`),
							`Commit fingerprint: ${preview.currentFingerprint}`,
							`Can commit: ${preview.canCommit ? "yes" : "no"}`,
							...(preview.diff === undefined
								? []
								: [
										formatDiffFn(preview.diff),
									]),
						].join("\n"),
					),
				),
			),
	);
	server.registerTool(
		"version_list",
		{
			description:
				"List version metadata newest first. Snapshot contents and binary assets are never dumped.",
			inputSchema: VersionListInputSchema,
		},
		async ({ limit, offset }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) => repository.listVersionsFx(project.projectId)),
					Effect.map((versions) => {
						const page = versions.slice(offset, offset + limit);
						return [
							"Versions",
							`Total: ${versions.length}`,
							`Showing: ${page.length} from offset ${offset}`,
							...page.map(describeVersionFn),
						].join("\n");
					}),
				),
			),
	);
	server.registerTool(
		"version_diff",
		{
			description:
				"Compare any two saved versions or the saved working copy. Returns structural paths and identities, never complete values or binary data.",
			inputSchema: VersionDiffInputSchema,
		},
		async ({ from, to }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository.diffVersionsFx({
							projectId: project.projectId,
							from: decodeReferenceFn(from),
							to: decodeReferenceFn(to),
						}),
					),
					Effect.map(formatDiffFn),
				),
			),
	);
	server.registerTool(
		"version_commit",
		{
			description:
				"Commit the open project's saved state after version_commit_preview. The commit applies one compatibility bump; a major commit permanently deletes every current Board scenario. Unsaved editor drafts are excluded.",
			inputSchema: VersionCommitInputSchema,
		},
		async ({ body, message, previewFingerprint, tag }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository.previewVersionCommitFx(project.projectId).pipe(
							Effect.flatMap((preview) =>
								preview.currentFingerprint !== previewFingerprint
									? Effect.fail(
											new Error(
												"The saved project changed after version_commit_preview. Preview the commit again.",
											),
										)
									: repository
											.createVersionFx({
												projectId: project.projectId,
												expectedFingerprint: previewFingerprint,
												subject: message,
												...(body === undefined
													? {}
													: {
															body,
														}),
												...(tag === undefined
													? {}
													: {
															tag,
														}),
											})
											.pipe(
												Effect.map((version) => ({
													preview,
													version,
												})),
											),
							),
							Effect.tap(() =>
								Effect.sync(() => notifyProjectChangedFn(project.projectId)),
							),
						),
					),
					Effect.map(({ preview, version }) =>
						[
							"Version created",
							describeVersionFn(version),
							`Compatibility bump: ${preview.bump}`,
							...(preview.scenariosToDelete.length === 0
								? []
								: [
										`Deleted Board scenarios: ${preview.scenariosToDelete.join(", ")}`,
									]),
						].join("\n"),
					),
				),
			),
	);
	server.registerTool(
		"version_checkout",
		{
			description:
				"Replace the entire open editor project with one applicable version through the renderer checkout handshake. This permanently discards the current saved state and every unsaved draft.",
			inputSchema: VersionCheckoutInputSchema,
		},
		async ({ versionId }) =>
			runToolFn(
				Effect.gen(function* () {
					const project = yield* readProjectFx();
					const versions = yield* repository.listVersionsFx(project.projectId);
					const version = versions.find((candidate) => candidate.versionId === versionId);
					if (version === undefined)
						return yield* Effect.fail(
							new Error(`Version ${versionId} does not exist.`),
						);
					yield* requestVersionCheckoutFx(project.projectId, versionId);
					return `Version checked out\n${describeVersionFn(version)}\nThe mounted editor was refreshed in place.`;
				}),
			),
	);
	server.registerTool(
		"version_tag",
		{
			description:
				"Set a one-line user label on an applicable version, or omit tag to clear it. Tags have no graph semantics.",
			inputSchema: VersionTagInputSchema,
		},
		async ({ tag, versionId }) =>
			runToolFn(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository
							.updateVersionTagFx({
								projectId: project.projectId,
								versionId,
								...(tag === undefined
									? {}
									: {
											tag,
										}),
							})
							.pipe(
								Effect.tap(() =>
									Effect.sync(() => notifyProjectChangedFn(project.projectId)),
								),
							),
					),
					Effect.map((version) => `Version tag updated\n${describeVersionFn(version)}`),
				),
			),
	);
};
