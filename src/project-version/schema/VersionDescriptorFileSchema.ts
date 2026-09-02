import { z } from "zod";

import {
	ProjectVersionBodySchema,
	ProjectVersionSubjectSchema,
	ProjectVersionTagSchema,
} from "~/project-version/schema/ProjectVersionMetadataSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";
import { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";
import { VersionObjectHashSchema } from "./VersionObjectHashSchema";

/** User-authored metadata for one immutable version manifest. */
export const VersionDescriptorFileSchema = z
	.object({
		parentVersionId: IdSchema.optional(),
		subject: ProjectVersionSubjectSchema,
		body: ProjectVersionBodySchema.optional(),
		tag: ProjectVersionTagSchema.optional(),
		arkini: ArkiniVersionSchema,
		version: GameVersionSchema,
		sourceRevision: z.number().int().nonnegative(),
		contentFingerprint: VersionObjectHashSchema,
		createdAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorVersionDescriptorFileSchema",
		description: "Metadata stored below its ID-owned versions/<versionId>/version.json path.",
	});

export type VersionDescriptorFileSchema = typeof VersionDescriptorFileSchema;

export namespace VersionDescriptorFileSchema {
	export type Type = z.infer<VersionDescriptorFileSchema>;
}
