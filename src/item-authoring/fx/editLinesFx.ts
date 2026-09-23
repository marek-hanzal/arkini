import { Effect } from "effect";

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { ProjectOperationError } from "~/project-authoring/error/ProjectOperationError";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { Project } from "~/project-authoring/type/Project";
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
}) {
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
	for (const [index, operation] of operations.entries()) {
		const { itemUid } = operation;
		const lineId = operation.operation === "create" ? operation.line.id : operation.lineId;
		const failFx = (message: string) =>
			Effect.fail(
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Operation ${index + 1} (${operation.operation}, item ${itemUid}, line ${lineId}): ${message}`,
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
			lineId,
		]);
		if (targets.has(target))
			return yield* failFx("Each item/line pair may be edited only once per batch.");
		targets.add(target);
		if (operation.operation === "replace" && operation.line.id !== lineId)
			return yield* failFx(
				`Replacement line ID ${operation.line.id} must match target line ID ${lineId}.`,
			);
		const matches = item.lines.filter((line) => line.id === lineId);
		if (operation.operation === "create" && matches.length > 0)
			return yield* failFx(`Line ${lineId} already exists on item ${itemUid}.`);
		if (operation.operation !== "create" && matches.length === 0)
			return yield* failFx(`Line ${lineId} does not exist on item ${itemUid}.`);
		if (operation.operation !== "create" && matches.length > 1)
			return yield* failFx(
				`Line ${lineId} is ambiguous on item ${itemUid}; fix its duplicate line IDs before editing it.`,
			);
		const lines =
			operation.operation === "create"
				? [
						...item.lines,
						operation.line,
					]
				: operation.operation === "delete"
					? item.lines.filter((line) => line !== matches[0])
					: item.lines.map((line) => (line === matches[0] ? operation.line : line));
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
	return yield* repository.replaceConfigFx({
		projectId: project.projectId,
		expectedRevision: revision,
		config: {
			...project.config,
			items,
		},
	});
});

export namespace editLinesFx {
	export type Operation =
		| {
				readonly operation: "create";
				readonly itemUid: string;
				readonly line: LineSchema.Type;
		  }
		| {
				readonly operation: "replace";
				readonly itemUid: string;
				readonly lineId: string;
				readonly line: LineSchema.Type;
		  }
		| {
				readonly operation: "delete";
				readonly itemUid: string;
				readonly lineId: string;
		  };
}
