import { Effect } from "effect";

import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ItemSchema as CanonicalItemSchema } from "~/item-definition/schema/ItemSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { renameFx } from "~/item-authoring/fx/renameFx";

/** Validates and persists one item through the canonical editor repository. */
export const saveWithRepositoryFx = Effect.fn("saveEditorItemWithRepositoryFx")(function* ({
	config,
	expectedRevision,
	item: candidate,
	projectId,
	repository,
}: {
	readonly config: GameConfigSchema.Type;
	readonly expectedRevision?: number;
	readonly item: Pick<ItemSchema.Type, "id" | "type"> & Record<string, unknown>;
	readonly projectId: string;
	readonly repository: ProjectRepositoryService;
}) {
	const item = yield* Effect.try({
		try: () => CanonicalItemSchema.parse(candidate),
		catch: (cause) =>
			new ProjectOperationError({
				reason: "invalid-item",
				message: `Item ${candidate.id} does not satisfy its ${candidate.type} schema.`,
				cause,
			}),
	});
	const previous = Object.entries(config.items).find(([, existing]) => existing.uid === item.uid);
	if (previous === undefined || previous[0] === item.id) {
		const commit = yield* repository.upsertItemFx({
			expectedRevision,
			projectId,
			item,
		});
		return {
			commit,
			item,
		} as const;
	}
	const [previousItemId] = previous;
	if (expectedRevision === undefined)
		return yield* Effect.fail(
			new Error("Renaming an Editor item requires its expected project revision."),
		);
	const renamed = yield* renameFx({
		config: {
			...config,
			items: {
				...config.items,
				[previousItemId]: item,
			},
		},
		itemId: previousItemId,
		newItemId: item.id,
	});
	const commit = yield* repository.replaceConfigFx({
		config: renamed.config,
		expectedRevision,
		projectId,
	});
	const saved = renamed.config.items[item.id];
	if (saved === undefined) return yield* Effect.die(new Error("Renamed item is missing."));
	return {
		commit,
		item: saved,
	} as const;
});
