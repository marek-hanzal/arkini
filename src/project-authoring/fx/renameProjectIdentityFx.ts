import { Effect } from "effect";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { IdSchema } from "~/game-value/schema/IdSchema";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

export namespace renameProjectIdentityFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly expectedRevision: number;
		readonly newProjectId: string;
		readonly projectId: string;
	}
}

/** Replaces package identity through the canonical revision-pinned project commit. */
export const renameProjectIdentityFx = Effect.fn("renameProjectIdentityFx")(function* ({
	config,
	expectedRevision,
	newProjectId: candidate,
	projectId,
}: renameProjectIdentityFx.Props) {
	const newProjectId = yield* Effect.try({
		try: () => IdSchema.parse(candidate),
		catch: (cause) =>
			new Error("The new Editor project ID is invalid.", {
				cause,
			}),
	});
	if (newProjectId === projectId)
		return yield* Effect.fail(new Error(`Project ${projectId} already has that ID.`));
	const nextConfig = GameConfigSchema.parse({
		...config,
		meta: {
			...config.meta,
			id: newProjectId,
		},
	});
	const repository = yield* ProjectRepository;
	return yield* repository.replaceConfigFx({
		config: nextConfig,
		expectedRevision,
		projectId,
	});
});
