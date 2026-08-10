import { McpServer } from "@modelcontextprotocol/server";
import { Effect } from "effect";
import { z } from "zod";

import type { EditorProject } from "../../src/editor/EditorProject";
import type { EditorProjectRepositoryService } from "../../src/editor/EditorProjectRepository";
import { IdSchema } from "../../src/engine/common/schema/IdSchema";
import { ItemSchema } from "../../src/engine/item/schema/ItemSchema";
import { ResourceSchema } from "../../src/engine/pack/schema/ResourceSchema";
import { GameConfigSchema } from "../../src/engine/schema/GameConfigSchema";

const resourceInputSchema = z
	.object({
		id: IdSchema,
		mime: z.string().min(1),
		bytesBase64: z.base64(),
	})
	.strict();

const parseResource = (candidate: z.infer<typeof resourceInputSchema>) =>
	ResourceSchema.parse({
		id: candidate.id,
		mime: candidate.mime,
		bytes: new Uint8Array(Buffer.from(candidate.bytesBase64, "base64")),
	});

const projectText = (project: EditorProject) =>
	[
		`Project: ${project.projectId}`,
		`Title: ${project.title}`,
		`Game version: ${project.game}`,
		`Revision: ${project.revision}`,
		`Updated: ${new Date(project.updatedAtMs).toISOString()}`,
		"Config:",
		JSON.stringify(project.config, null, 2),
		"Resources:",
		...project.resources.map(
			(resource) => `- ${resource.id} (${resource.mime}, ${resource.bytes.byteLength} bytes)`,
		),
	].join("\n");

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const runTool = async <Value>(
	effect: Effect.Effect<Value, unknown>,
	format: (value: Value) => string,
	structured?: (value: Value) => Record<string, unknown>,
) => {
	try {
		const value = await Effect.runPromise(effect);
		return {
			content: [
				{
					type: "text" as const,
					text: format(value),
				},
			],
			...(structured === undefined
				? {}
				: {
						structuredContent: structured(value),
					}),
		};
	} catch (cause) {
		return {
			isError: true,
			content: [
				{
					type: "text" as const,
					text: `Editor operation failed: ${errorText(cause)}`,
				},
			],
		};
	}
};

/** Builds one per-request MCP server backed by the same main-process SQLite authority as IPC. */
export const createEditorMcpServer = (repository: EditorProjectRepositoryService) => {
	const server = new McpServer(
		{
			name: "arkini-editor",
			version: "0.1.0",
		},
		{
			instructions:
				"Read the current project and revision before mutating it. Writes are revisioned and failures leave canonical state unchanged. Tool results are concise text; config inputs are validated against the game schema.",
		},
	);
	server.registerTool(
		"editor_list_projects",
		{
			description: "List local Arkini editor projects in most-recent order.",
		},
		async () =>
			runTool(
				repository.listProjectsFx,
				(projects) =>
					projects.length === 0
						? "No editor projects."
						: projects
								.map(
									(project) =>
										`- ${project.projectId}: ${project.title} (game ${project.game}, updated ${new Date(project.updatedAtMs).toISOString()})`,
								)
								.join("\n"),
				(projects) => ({
					projects: projects.map(({ projectId, title, game, updatedAtMs }) => ({
						projectId,
						title,
						game,
						updatedAtMs,
					})),
				}),
			),
	);
	server.registerTool(
		"editor_read_project",
		{
			description: "Read one canonical project config, revision, and resource metadata.",
			inputSchema: z
				.object({
					projectId: IdSchema,
				})
				.strict(),
		},
		async ({ projectId }) =>
			runTool(
				repository.readProjectFx(projectId),
				(project) =>
					project === null
						? `Project ${projectId} does not exist.`
						: projectText(project),
				(project) =>
					project === null
						? {
								projectId,
								found: false,
							}
						: {
								projectId: project.projectId,
								found: true,
								revision: project.revision,
							},
			),
	);
	server.registerTool(
		"editor_create_project",
		{
			description: "Atomically create a validated editor project and its resources.",
			inputSchema: z
				.object({
					projectId: IdSchema,
					config: GameConfigSchema,
					resources: resourceInputSchema.array().default([]),
				})
				.strict(),
		},
		async ({ projectId, config, resources }) =>
			runTool(
				repository.createProjectFx({
					projectId,
					config,
					resources: resources.map(parseResource),
				}),
				(project) => `Created ${project.projectId} at revision ${project.revision}.`,
				(project) => ({
					projectId: project.projectId,
					revision: project.revision,
				}),
			),
	);
	server.registerTool(
		"editor_replace_config",
		{
			description: "Replace a project's complete config at an expected revision.",
			inputSchema: z
				.object({
					projectId: IdSchema,
					expectedRevision: z.number().int().nonnegative(),
					config: GameConfigSchema,
				})
				.strict(),
		},
		async (input) =>
			runTool(
				repository.replaceConfigFx(input),
				(commit) => `Saved ${commit.projectId} at revision ${commit.revision}.`,
				(commit) => ({
					projectId: commit.projectId,
					revision: commit.revision,
				}),
			),
	);
	server.registerTool(
		"editor_upsert_item",
		{
			description: "Create or update one validated item in an editor project.",
			inputSchema: z
				.object({
					projectId: IdSchema,
					item: ItemSchema,
				})
				.strict(),
		},
		async (input) =>
			runTool(
				repository.upsertItemFx(input),
				(commit) => `Saved item in ${commit.projectId} at revision ${commit.revision}.`,
				(commit) => ({
					projectId: commit.projectId,
					revision: commit.revision,
				}),
			),
	);
	server.registerTool(
		"editor_upsert_resources",
		{
			description: "Atomically create or replace one or more base64-encoded resources.",
			inputSchema: z
				.object({
					projectId: IdSchema,
					resources: resourceInputSchema.array().min(1),
				})
				.strict(),
		},
		async ({ projectId, resources }) =>
			runTool(
				repository.upsertResourcesFx({
					projectId,
					resources: resources.map(parseResource),
				}),
				(project) =>
					`Saved ${resources.length} resource(s) in ${project.projectId} at revision ${project.revision}.`,
				(project) => ({
					projectId: project.projectId,
					revision: project.revision,
					resourceCount: resources.length,
				}),
			),
	);
	server.registerTool(
		"editor_replace_resource",
		{
			description:
				"Atomically replace or rename one resource together with the complete config that references it.",
			inputSchema: z
				.object({
					projectId: IdSchema,
					currentId: IdSchema,
					expectedRevision: z.number().int().nonnegative(),
					config: GameConfigSchema,
					resource: resourceInputSchema,
				})
				.strict(),
		},
		async ({ resource, ...input }) =>
			runTool(
				repository.replaceResourceFx({
					...input,
					resource: parseResource(resource),
				}),
				(project) =>
					`Saved resource in ${project.projectId} at revision ${project.revision}.`,
				(project) => ({
					projectId: project.projectId,
					revision: project.revision,
				}),
			),
	);
	return server;
};
