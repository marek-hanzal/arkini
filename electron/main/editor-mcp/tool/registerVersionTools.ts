import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { EditorProjectRepositoryService } from "~/project-authoring/repository/EditorProjectRepository";
import type { EditorProject } from "~/project-authoring/EditorProject";
import type {
	EditorProjectVersionDescriptor,
	EditorProjectVersionDiff,
	EditorProjectVersionReference,
} from "~/project-version/EditorProjectVersion";
import {
	EditorProjectVersionBodySchema,
	EditorProjectVersionSubjectSchema,
	EditorProjectVersionTagSchema,
} from "~/project-version/EditorProjectVersionMetadataSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";

type ToolResult = {
	readonly isError?: boolean;
	readonly content: Array<{
		readonly type: "text";
		readonly text: string;
	}>;
};

type RunTool = (effect: Effect.Effect<string, unknown>) => Promise<ToolResult>;

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
		message: EditorProjectVersionSubjectSchema,
		body: EditorProjectVersionBodySchema.optional(),
		tag: EditorProjectVersionTagSchema.optional(),
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
		tag: EditorProjectVersionTagSchema.optional(),
	})
	.strict()
	.meta({
		$id: "urn:arkini:schema:mcp:version-tag-input",
		title: "Version tag tool input",
		description: "The saved version and optional replacement tag.",
	});

const decodeReference = (value: string): EditorProjectVersionReference =>
	value === "current"
		? {
				type: "current",
			}
		: {
				type: "version",
				versionId: value,
			};

const describeVersion = (version: EditorProjectVersionDescriptor) =>
	[
		`${version.versionId} · ${version.subject}`,
		`  ${new Date(version.createdAtMs).toISOString()} · Arkini ${version.arkini}`,
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

const formatDiff = (diff: EditorProjectVersionDiff) => {
	const formatBump = (bump: "major" | "minor" | undefined) =>
		bump === undefined ? "" : ` · ${bump} bump`;
	const lines = [
		"Version diff",
		`Changed: ${diff.hasChanges ? "yes" : "no"}`,
		`Project fields: ${diff.project.length}`,
		...diff.project.map(({ bump, path }) => `  ${path}${formatBump(bump)}`),
		`Items: ${diff.items.length}`,
		...diff.items.flatMap(({ change, uid, values }) => [
			`  ${change} ${uid} · ${values.length} field changes`,
			...values.map(({ bump, path }) => `    ${path || "Entire item"}${formatBump(bump)}`),
		]),
		`Resources: ${diff.resources.length}`,
		...diff.resources.map(({ bump, change, id }) => `  ${change} ${id}${formatBump(bump)}`),
		`Board scenarios: ${diff.scenarios.length}`,
		...diff.scenarios.map(({ change, id }) => `  ${change} ${id}`),
	];
	return lines.join("\n");
};

export namespace registerVersionTools {
	export interface Props {
		readonly notifyProjectChanged: (projectId: string) => void;
		readonly readProjectFx: () => Effect.Effect<EditorProject, unknown>;
		readonly repository: EditorProjectRepositoryService;
		readonly requestVersionCheckoutFx: (
			projectId: string,
			versionId: string,
		) => Effect.Effect<void, unknown>;
		readonly runTool: RunTool;
		readonly server: McpServer;
	}
}

/** Registers explicit, saved-state version tools without exposing raw snapshot payloads. */
export const registerVersionTools = ({
	notifyProjectChanged,
	readProjectFx,
	repository,
	requestVersionCheckoutFx,
	runTool,
	server,
}: registerVersionTools.Props) => {
	server.registerTool(
		"version_status",
		{
			description:
				"Read whether the open project's saved working copy differs from its current version base.",
			inputSchema: VersionStatusInputSchema,
		},
		async () =>
			runTool(
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
		"version_list",
		{
			description:
				"List version metadata newest first. Snapshot contents and binary assets are never dumped.",
			inputSchema: VersionListInputSchema,
		},
		async ({ limit, offset }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) => repository.listVersionsFx(project.projectId)),
					Effect.map((versions) => {
						const page = versions.slice(offset, offset + limit);
						return [
							"Versions",
							`Total: ${versions.length}`,
							`Showing: ${page.length} from offset ${offset}`,
							...page.map(describeVersion),
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
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository.diffVersionsFx({
							projectId: project.projectId,
							from: decodeReference(from),
							to: decodeReference(to),
						}),
					),
					Effect.map(formatDiff),
				),
			),
	);
	server.registerTool(
		"version_commit",
		{
			description:
				"Create an explicit full snapshot of the open project's saved state, including assets and Board scenarios. Unsaved editor drafts are excluded.",
			inputSchema: VersionCommitInputSchema,
		},
		async ({ body, message, tag }) =>
			runTool(
				readProjectFx().pipe(
					Effect.flatMap((project) =>
						repository.readVersionStatusFx(project.projectId).pipe(
							Effect.flatMap((status) =>
								repository.createVersionFx({
									projectId: project.projectId,
									expectedFingerprint: status.currentFingerprint,
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
								}),
							),
							Effect.tap(() =>
								Effect.sync(() => notifyProjectChanged(project.projectId)),
							),
						),
					),
					Effect.map((version) => `Version created\n${describeVersion(version)}`),
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
			runTool(
				Effect.gen(function* () {
					const project = yield* readProjectFx();
					const versions = yield* repository.listVersionsFx(project.projectId);
					const version = versions.find((candidate) => candidate.versionId === versionId);
					if (version === undefined)
						return yield* Effect.fail(
							new Error(`Version ${versionId} does not exist.`),
						);
					yield* requestVersionCheckoutFx(project.projectId, versionId);
					return `Version checked out\n${describeVersion(version)}\nThe mounted editor was refreshed in place.`;
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
			runTool(
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
									Effect.sync(() => notifyProjectChanged(project.projectId)),
								),
							),
					),
					Effect.map((version) => `Version tag updated\n${describeVersion(version)}`),
				),
			),
	);
};
