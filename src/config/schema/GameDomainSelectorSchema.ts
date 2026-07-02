import { z } from "zod";
import { IdSchema } from "~/config/schema/GameConfigScalarSchemas";

const TagSchema = z.string().min(1);

export const ResolvedDomainSelectorClauseSchema = z
	.object({
		ids: z.array(IdSchema).min(1),
	})
	.strict();

export const ResolvedDomainSelectorSchema = z.union([
	z
		.object({
			mode: z.literal("all"),
		})
		.strict(),
	z
		.object({
			anyOf: z.array(ResolvedDomainSelectorClauseSchema).min(1).optional(),
			allOf: z.array(ResolvedDomainSelectorClauseSchema).min(1).optional(),
			noneOf: z.array(ResolvedDomainSelectorClauseSchema).min(1).optional(),
		})
		.strict(),
]);

const AuthoringDomainSelectorRefSchema = z.union([
	z
		.object({
			id: IdSchema,
		})
		.strict(),
	z
		.object({
			ids: z.array(IdSchema).min(1),
		})
		.strict(),
	z
		.object({
			tag: TagSchema,
		})
		.strict(),
]);

export const AuthoringDomainSelectorSchema = z.union([
	z
		.object({
			mode: z.literal("all"),
		})
		.strict(),
	z
		.object({
			anyOf: z.array(AuthoringDomainSelectorRefSchema).min(1).optional(),
			allOf: z.array(AuthoringDomainSelectorRefSchema).min(1).optional(),
			noneOf: z.array(AuthoringDomainSelectorRefSchema).min(1).optional(),
		})
		.strict(),
]);
