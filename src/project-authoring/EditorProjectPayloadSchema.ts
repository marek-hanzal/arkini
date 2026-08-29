import { z } from "zod";

import type { EditorProjectCommit } from "~/project-authoring/EditorProject";
import { EditorProjectDescriptorSchema } from "~/project-authoring/EditorProjectDescriptor";
import { EditorProjectRecordSchema } from "~/project-authoring/EditorProjectRecordSchema";
import { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";

const projectTransportSchema = z
	.object({
		...EditorProjectDescriptorSchema.shape,
		revision: z.number().int().nonnegative(),
		config: GameConfigSchema,
	})
	.strict();

const commitTransportSchema = projectTransportSchema
	.extend({
		previousRevision: z.number().int().nonnegative(),
	})
	.refine(({ previousRevision, revision }) => previousRevision < revision, {
		message: "previousRevision must precede revision.",
		path: [
			"previousRevision",
		],
	});

const materializeProjectRecord = (transport: z.infer<typeof projectTransportSchema>) => {
	const record = EditorProjectRecordSchema.parse({
		projectId: transport.projectId,
		config: transport.config,
		version: transport.version,
		revision: transport.revision,
		createdAtMs: transport.createdAtMs,
		updatedAtMs: transport.updatedAtMs,
	});
	if (transport.title !== record.config.meta.title || transport.version !== record.version)
		throw new Error("Editor IPC metadata does not match the canonical project config.");
	return {
		projectId: record.projectId,
		title: record.config.meta.title,
		version: record.version,
		createdAtMs: record.createdAtMs,
		updatedAtMs: record.updatedAtMs,
		revision: record.revision,
		config: record.config,
	};
};

const materializeCommit = (
	transport: z.infer<typeof commitTransportSchema>,
): EditorProjectCommit => {
	return {
		...materializeProjectRecord(transport),
		previousRevision: transport.previousRevision,
	};
};

export const EditorProjectCommitPayloadSchema = commitTransportSchema.transform(materializeCommit);

export const EditorProjectPayloadSchema = projectTransportSchema
	.extend({
		resources: ResourceSchema.array(),
	})
	.transform((project) => ({
		...materializeProjectRecord(project),
		resources: project.resources
			.map((resource) => ({
				...resource,
				bytes: new Uint8Array(resource.bytes),
			}))
			.sort((left, right) => left.id.localeCompare(right.id)),
	}));
