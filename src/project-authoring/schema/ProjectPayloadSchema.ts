import { z } from "zod";

import type { ProjectCommit } from "~/project-authoring/type/Project";
import { ProjectDescriptorSchema } from "~/project-authoring/schema/ProjectDescriptorSchema";
import { ProjectRecordSchema } from "~/project-authoring/schema/ProjectRecordSchema";
import { ProjectResourceSchema } from "~/project-authoring/schema/ProjectResourceSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

const projectTransportSchema = z
	.object({
		...ProjectDescriptorSchema.shape,
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

const materializeProjectRecordFn = (transport: z.infer<typeof projectTransportSchema>) => {
	const record = ProjectRecordSchema.parse({
		projectId: transport.projectId,
		config: transport.config,
		version: transport.version,
		revision: transport.revision,
		createdAtMs: transport.createdAtMs,
		updatedAtMs: transport.updatedAtMs,
	});
	if (
		transport.title !== record.config.meta.title ||
		transport.version.major !== record.version.major ||
		transport.version.minor !== record.version.minor ||
		transport.version.suffix !== record.version.suffix
	)
		throw new Error("Editor IPC metadata does not match the canonical project record.");
	return {
		projectId: record.projectId,
		title: record.config.meta.title,
		version: {
			...record.version,
		},
		createdAtMs: record.createdAtMs,
		updatedAtMs: record.updatedAtMs,
		revision: record.revision,
		config: record.config,
	};
};

const materializeCommitFn = (transport: z.infer<typeof commitTransportSchema>): ProjectCommit => {
	return {
		...materializeProjectRecordFn(transport),
		previousRevision: transport.previousRevision,
	};
};

export const ProjectCommitPayloadSchema = commitTransportSchema.transform(materializeCommitFn);

export const ProjectPayloadSchema = projectTransportSchema
	.extend({
		resources: ProjectResourceSchema.array(),
	})
	.transform((project) => ({
		...materializeProjectRecordFn(project),
		resources: project.resources
			.map((resource) => ({
				...resource,
			}))
			.sort((left, right) => left.id.localeCompare(right.id)),
	}));
