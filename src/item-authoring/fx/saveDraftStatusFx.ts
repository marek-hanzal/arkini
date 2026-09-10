import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export namespace saveDraftStatusFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly draft: boolean;
		readonly expectedRevision: number;
		readonly itemId: ItemSchema.Type["id"];
		readonly projectId: string;
	}
}

/** Persists one version-noop draft flag without rebuilding the Editor Board game. */
export const saveDraftStatusFx = Effect.fn("saveEditorItemDraftStatusFx")(function* ({
	config,
	draft,
	expectedRevision,
	itemId,
	projectId,
}: saveDraftStatusFx.Props) {
	const repository = yield* ProjectRepository;
	const item = config.items[itemId];
	if (item === undefined)
		return yield* Effect.fail(
			new Error(`Item ${itemId} does not exist in the current project.`),
		);
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const saved = yield* saveWithRepositoryFx({
				config,
				expectedRevision,
				item: {
					...item,
					draft,
				},
				projectId,
				repository,
			});
			yield* publishEditorProjectFx(
				projectId,
				{
					commit: saved.commit,
				},
				"advance-noop",
			);
			return saved.item;
		}),
	);
});
