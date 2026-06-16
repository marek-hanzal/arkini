import { match, P } from "ts-pattern";
import type { ActivationDepletionSchema } from "~/v0/activation/type/ActivationDepletionSchema";
import type { StashDefinition } from "~/v0/manifest/activation/StashDefinition";

export const resolveActivationDepletion = (
	stash: StashDefinition,
): ActivationDepletionSchema.Type =>
	match(stash.onDepleted)
		.with("remove", () => ({
			kind: "remove" as const,
		}))
		.with(
			{
				replaceWithItemId: P.string,
			},
			({ replaceWithItemId }) => ({
				kind: "replace" as const,
				itemId: replaceWithItemId,
			}),
		)
		.exhaustive();
