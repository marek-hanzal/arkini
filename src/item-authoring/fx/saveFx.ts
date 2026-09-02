import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Effect } from "effect";

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { publishEditorProjectFx } from "~/authoring-session/fx/publishEditorProjectFx";
import { saveWithRepositoryFx } from "~/item-authoring/fx/saveWithRepositoryFx";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";

export namespace saveFx {
	export interface Props {
		readonly config: GameConfigSchema.Type;
		readonly expectedRevision: number;
		readonly item: ItemSchema.Type;
		readonly projectId: string;
	}
}

/** Atomically validates and saves one UID-owned item into the canonical project. */
export const saveFx = Effect.fn("saveEditorItemFx")(function* ({
	config,
	expectedRevision,
	item: candidate,
	projectId,
}: saveFx.Props) {
	const repository = yield* ProjectRepository;
	yield* Effect.yieldNow;
	return yield* Effect.uninterruptible(
		Effect.gen(function* () {
			const { commit, item } = yield* saveWithRepositoryFx({
				config,
				expectedRevision,
				item: candidate,
				projectId,
				repository,
			});
			yield* publishEditorProjectFx(projectId, {
				commit,
			});
			return item;
		}),
	);
});
