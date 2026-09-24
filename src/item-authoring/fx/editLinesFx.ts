import { match } from "ts-pattern";
import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";

/** Builds the whole line batch before one existing best-effort repository commit. */
export const editLinesFx = Effect.fn("editItemLinesFx")(function* ({
	project,
	revision,
	operations,
	repository,
}: {
	readonly project: Project;
	readonly revision: number;
	readonly operations: ReadonlyArray<editLinesFx.Operation>;
	readonly repository: ProjectRepositoryService;
}): Effect.fn.Return<editLinesFx.Output, ProjectOperationError | ProjectRepositoryError> {
	if (operations.length < 1 || operations.length > 20)
		return yield* Effect.fail(
			new ProjectOperationError({
				reason: "invalid-item",
				message: "A line batch requires 1–20 operations.",
			}),
		);
	const items = {
		...project.config.items,
	};
	const targets = new Set<string>();
	const touched = new Map<string, number[]>();
	const applied: editLinesFx.AppliedOperation[] = [];
	for (const [index, operation] of operations.entries()) {
		const { itemUid } = operation;
		const lineUid = operation.operation === "create" ? createId() : operation.lineUid;
		const failFx = (message: string) =>
			Effect.fail(
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Operation ${index + 1} (${operation.operation}, item ${itemUid}, line ${lineUid}): ${message}`,
				}),
			);
		const item = items[itemUid];
		if (!Object.hasOwn(items, itemUid) || item === undefined)
			return yield* failFx(`Item ${itemUid} does not exist.`);
		if (revision !== project.revision)
			return yield* Effect.fail(
				new ProjectRepositoryError({
					operation: "replace-config",
					reason: "revision-conflict",
					message: `Revision ${revision} is stale; the open project is at revision ${project.revision}. Read the project again before editing lines.`,
				}),
			);
		const target = JSON.stringify([
			itemUid,
			lineUid,
		]);
		if (targets.has(target))
			return yield* failFx("Each item/line pair may be edited only once per batch.");
		targets.add(target);
		const selectedIndex = item.lines.findIndex((line) => line.uid === lineUid);
		if (operation.operation !== "create" && selectedIndex === -1)
			return yield* failFx(`Line ${lineUid} does not exist on item ${itemUid}.`);
		const canonical: editLinesFx.AppliedOperation =
			operation.operation === "delete"
				? operation
				: {
						...operation,
						line: {
							...operation.line,
							uid: lineUid,
						},
					};
		applied.push(canonical);
		const lines = match(canonical)
			.with(
				{
					operation: "create",
				},
				({ line }) => [
					...item.lines,
					line,
				],
			)
			.with(
				{
					operation: "delete",
				},
				() => item.lines.filter((_line, lineIndex) => lineIndex !== selectedIndex),
			)
			.with(
				{
					operation: "replace",
				},
				(canonical) =>
					item.lines.map((line, lineIndex) =>
						lineIndex === selectedIndex ? canonical.line : line,
					),
			)
			.exhaustive();
		items[itemUid] = {
			...item,
			lines,
		};
		const indices = touched.get(itemUid) ?? [];
		indices.push(index + 1);
		touched.set(itemUid, indices);
	}
	// Validate completed items, not intermediate states between edits on the same owner.
	for (const [itemUid, indices] of touched) {
		items[itemUid] = yield* Effect.try({
			try: () => ItemSchema.parse(items[itemUid]),
			catch: (cause) =>
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Operations ${indices.join(", ")} (item ${itemUid}): the resulting item is invalid.`,
					cause,
				}),
		});
	}
	const commit = yield* repository.replaceConfigFx({
		projectId: project.projectId,
		expectedRevision: revision,
		config: {
			...project.config,
			items,
		},
	});
	return {
		commit,
		operations: applied,
	};
});

export namespace editLinesFx {
	export interface Output {
		readonly commit: ProjectCommit;
		readonly operations: readonly AppliedOperation[];
	}
	export type AppliedOperation =
		| {
				readonly operation: "create";
				readonly itemUid: string;
				readonly line: LineSchema.Type;
		  }
		| {
				readonly operation: "replace";
				readonly itemUid: string;
				readonly lineUid: string;
				readonly line: LineSchema.Type;
		  }
		| {
				readonly operation: "delete";
				readonly itemUid: string;
				readonly lineUid: string;
		  };

	export type Operation =
		| {
				readonly operation: "create";
				readonly itemUid: string;
				readonly line: Omit<LineSchema.Type, "uid">;
		  }
		| {
				readonly operation: "replace";
				readonly itemUid: string;
				readonly lineUid: string;
				readonly line: Omit<LineSchema.Type, "uid">;
		  }
		| {
				readonly operation: "delete";
				readonly itemUid: string;
				readonly lineUid: string;
		  };
}
