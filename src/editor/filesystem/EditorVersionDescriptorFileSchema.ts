import { z } from "zod";

import {
	EditorProjectVersionBodySchema,
	EditorProjectVersionSubjectSchema,
	EditorProjectVersionTagSchema,
} from "~/editor/version/EditorProjectVersionMetadataSchema";
import { IdSchema } from "~/engine/common/schema/IdSchema";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";
import { EditorObjectHashSchema } from "./EditorObjectHashSchema";

/** User-authored metadata for one immutable version manifest. */
export const EditorVersionDescriptorFileSchema = z
	.object({
		versionId: IdSchema,
		parentVersionId: IdSchema.optional(),
		subject: EditorProjectVersionSubjectSchema,
		body: EditorProjectVersionBodySchema.optional(),
		tag: EditorProjectVersionTagSchema.optional(),
		arkini: ArkiniVersionSchema,
		arkpackVersion: ArkpackVersionSchema,
		sourceRevision: z.number().int().nonnegative(),
		contentFingerprint: EditorObjectHashSchema,
		createdAtMs: z.number().int().nonnegative(),
	})
	.strict()
	.meta({
		id: "EditorVersionDescriptorFileSchema",
		description: "One versions/<versionId>/version.json metadata file.",
	});

export type EditorVersionDescriptorFileSchema = typeof EditorVersionDescriptorFileSchema;

export namespace EditorVersionDescriptorFileSchema {
	export type Type = z.infer<EditorVersionDescriptorFileSchema>;
}
