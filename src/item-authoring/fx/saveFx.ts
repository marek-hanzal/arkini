import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { Cause, Clock, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { writeDiagnosticRecordFx } from "~/application-diagnostics/fx/writeDiagnosticRecordFx";

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
	const admission = yield* ProjectWriteAdmission;
	const startedAtMs = yield* Clock.currentTimeMillis;
	const context = {
		projectId,
		itemUid: candidate.uid,
		expectedRevision,
		startedAtMs,
	};
	const before = yield* Atom.get(EditorProjectAtom(projectId));
	yield* writeDiagnosticRecordFx({
		level: "info",
		category: [
			"editor",
			"item-save",
		],
		event: "item-save-started",
		data: {
			...context,
			visibleRevision: before?.revision ?? null,
			previousItemUid: config.items[candidate.uid]?.uid ?? null,
			lineCount: candidate.lines.length,
		},
	});
	yield* Effect.yieldNow;
	return yield* admission
		.admitWriteFx(
			"upsert-item",
			Effect.uninterruptible(
				Effect.gen(function* () {
					const { commit, item } = yield* saveWithRepositoryFx({
						expectedRevision,
						item: candidate,
						projectId,
						repository,
					});
					yield* writeDiagnosticRecordFx({
						level: "info",
						category: [
							"editor",
							"item-save",
						],
						event: "item-save-committed",
						data: {
							...context,
							commitProjectId: commit.projectId,
							previousRevision: commit.previousRevision,
							committedRevision: commit.revision,
							committedItemUid: commit.config.items[item.uid]?.uid ?? null,
						},
					});
					yield* publishEditorProjectFx(projectId, {
						commit,
					});
					const published = yield* Atom.get(EditorProjectAtom(projectId));
					const publishedItem =
						published === undefined ? undefined : published.config.items[item.uid];
					yield* writeDiagnosticRecordFx({
						level: publishedItem === undefined ? "warning" : "info",
						category: [
							"editor",
							"item-save",
						],
						event: "item-save-published",
						data: {
							...context,
							committedRevision: commit.revision,
							visibleRevision: published?.revision ?? null,
							visibleItemUid: publishedItem?.uid ?? null,
						},
					});
					return item;
				}),
			),
		)
		.pipe(
			Effect.onExit((exit) =>
				Exit.isFailure(exit)
					? writeDiagnosticRecordFx({
							level: "error",
							category: [
								"editor",
								"item-save",
							],
							event: "item-save-failed",
							data: {
								...context,
								cause: Cause.pretty(exit.cause).slice(0, 8192),
							},
						})
					: Effect.void,
			),
		);
});
