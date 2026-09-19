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
		const { itemId } = operation;
		const lineId = operation.operation === "create" ? operation.line.id : operation.lineId;
		const failFx = (message: string) =>
			Effect.fail(
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Operation ${index + 1} (${operation.operation}, item ${itemId}, line ${lineId}): ${message}`,
				}),
			);
		const item = items[itemId];
		if (item === undefined) return yield* failFx(`Item ${itemId} does not exist.`);
		if (revision !== project.revision)
			return yield* Effect.fail(
				new ProjectRepositoryError({
					operation: "replace-config",
					reason: "revision-conflict",
					message: `Revision ${revision} is stale; the open project is at revision ${project.revision}. Read the project again before editing lines.`,
				}),
			);
		const target = JSON.stringify([
			itemId,
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
			return yield* failFx(`Line ${lineId} already exists on item ${itemId}.`);
		if (operation.operation !== "create" && matches.length === 0)
			return yield* failFx(`Line ${lineId} does not exist on item ${itemId}.`);
		if (operation.operation !== "create" && matches.length > 1)
			return yield* failFx(
				`Line ${lineId} is ambiguous on item ${itemId}; fix its duplicate line IDs before editing it.`,
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
		items[itemId] = {
			...item,
			lines,
		};
		const indices = touched.get(itemId) ?? [];
		indices.push(index + 1);
		touched.set(itemId, indices);
	}
	// Validate completed items, not intermediate states between edits on the same owner.
	for (const [itemId, indices] of touched) {
		items[itemId] = yield* Effect.try({
			try: () => ItemSchema.parse(items[itemId]),
			catch: (cause) =>
				new ProjectOperationError({
					reason: "invalid-item",
					message: `Operations ${indices.join(", ")} (item ${itemId}): the resulting item is invalid.`,
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
				readonly itemId: string;
				readonly line: LineSchema.Type;
		  }
		| {
				readonly operation: "replace";
				readonly itemId: string;
				readonly lineId: string;
				readonly line: LineSchema.Type;
		  }
		| {
				readonly operation: "delete";
				readonly itemId: string;
				readonly lineId: string;
		  };
}
