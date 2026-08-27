import { z } from "zod";

const FilesystemWriteEntrySchema = z
	.object({
		target: z.string().min(1),
		backup: z.string().min(1),
		hadTarget: z.boolean(),
		oldMode: z.number().int().nonnegative().optional(),
	})
	.strict();

const FilesystemWriteReplacementSchema = FilesystemWriteEntrySchema.extend({
	pending: z.string().min(1),
	newMode: z.number().int().nonnegative(),
}).strict();

export const FilesystemWriteRecordSchema = z
	.object({
		version: z.literal(1),
		root: z.string().min(1),
		writes: z.array(FilesystemWriteReplacementSchema),
		deletes: z.array(FilesystemWriteEntrySchema),
	})
	.strict();

export type FilesystemWriteRecord = z.infer<typeof FilesystemWriteRecordSchema>;
