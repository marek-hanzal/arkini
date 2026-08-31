import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export namespace saveProjectConfigFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly expectedRevision: number;
		readonly projectId: string;
	}
}

/** Atomically replaces one complete canonical project config and publishes its revision. */
export const saveProjectConfigFx = Effect.fn("saveEditorProjectConfigFx")(function* ({
	config: candidate,
	expectedRevision,
	projectId,
}: saveProjectConfigFx.Props) {
	const config = yield* Effect.try({
		try: () => GameConfigSchema.parse(candidate),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-config",
				message: "The project configuration is invalid.",
				cause,
			}),
	});
	const repository = yield* ProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const commit = yield* repository.replaceConfigFx({
				config,
				expectedRevision,
				projectId,
			});
			yield* publishEditorProjectFx(projectId, {
				commit,
			});
			return config;
		}),
	);
});
