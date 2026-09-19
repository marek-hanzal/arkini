import { Effect } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { renameGameResourceFx } from "~/game-config-resource/fx/renameGameResourceFx";
import { renameFx } from "~/item-authoring/fx/renameFx";
import { notifyProjectChangedFx } from "./notifyProjectChangedFx";

/** Renames an item through a revision-pinned whole-config commit. */
export const renameItemFx = Effect.fn("renameItemFx")(function* ({
	itemId,
	id,
	title,
	artwork = false,
	notifyProjectChangedFn,
	project,
	repository,
	revision,
}: {
	readonly itemId: string;
	readonly id?: string;
	readonly title?: string;
	readonly artwork?: boolean;
	readonly notifyProjectChangedFn: (projectId: string) => void;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly revision?: number;
}) {
	if (revision !== undefined && revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read item_config again before renaming the item.`,
			),
		);
	if (id === undefined && title === undefined)
		return yield* Effect.fail(new Error("Supply at least one of title or id."));
	if (artwork && id === undefined)
		return yield* Effect.fail(new Error("Artwork synchronization requires id."));
	const original = project.config.items[itemId];
	if (original === undefined)
		return yield* Effect.fail(new Error(`Item ${itemId} does not exist.`));
	const newItemId = id ?? itemId;
	const renamed =
		newItemId === itemId
			? {
					config: project.config,
					updatedReferencePaths: [],
				}
			: yield* renameFx({
					config: project.config,
					itemId,
					newItemId,
				});
	let config = renamed.config;
	if (title !== undefined)
		config = {
			...config,
			items: {
				...config.items,
				[newItemId]: {
					...config.items[newItemId]!,
					title,
				},
			},
		};
	let artworkId: string | undefined;
	if (artwork) {
		if (original.artwork.default.length !== 1)
			return yield* Effect.fail(
				new Error("Artwork synchronization requires exactly one default Artwork."),
			);
		artworkId = original.artwork.default[0]!;
		if (
			!project.resources.some(
				(resource) => resource.id === artworkId && resource.type === "artwork",
			)
		)
			return yield* Effect.fail(new Error(`Artwork ${artworkId} does not exist.`));
		config = yield* renameGameResourceFx({
			config,
			from: artworkId,
			to: newItemId,
		});
	}
	// The existing resource commit owns collision checks, ordered file writes, and Note rewrites.
	const commit =
		artworkId === undefined
			? yield* repository.replaceConfigFx({
					config,
					expectedRevision: revision ?? project.revision,
					projectId: project.projectId,
				})
			: yield* repository.replaceResourceFx({
					config,
					currentId: artworkId,
					expectedRevision: revision ?? project.revision,
					projectId: project.projectId,
					resource: {
						id: newItemId,
						type: "artwork",
					},
				});
	yield* notifyProjectChangedFx(notifyProjectChangedFn, project.projectId);
	const item = config.items[newItemId];
	if (item === undefined) return yield* Effect.die(new Error("Renamed item is missing."));
	return [
		"Renamed item.",
		`Previous ID: ${itemId}`,
		`ID: ${newItemId}`,
		`UID: ${item.uid}`,
		`Title: ${item.title}`,
		...(artworkId === undefined
			? []
			: [
					`Artwork: ${artworkId} → ${newItemId}`,
				]),
		`Revision: ${commit.revision}`,
		`Updated references: ${renamed.updatedReferencePaths.length}`,
	].join("\n");
});
