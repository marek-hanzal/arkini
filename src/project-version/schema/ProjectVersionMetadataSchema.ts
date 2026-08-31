import { z } from "zod";

export const ProjectVersionSubjectSchema = z.string().trim().min(1).max(120);
export const ProjectVersionBodySchema = z.string().trim().min(1).max(4_000);
export const ProjectVersionTagSchema = z
	.string()
	.trim()
	.min(1)
	.max(80)
	.refine((value) => !/[\r\n]/.test(value), "Version tags must use one line.");
