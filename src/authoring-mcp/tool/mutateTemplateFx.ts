import { match, P } from "ts-pattern";
import { createId } from "@paralleldrive/cuid2";
import { Effect } from "effect";
import { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import type { Project } from "~/project-authoring/type/Project";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import { readTemplateDeleteBlockersFn } from "~/template-authoring/fn/readTemplateDeleteBlockersFn";
import type { CreateTemplateInputSchema } from "./CreateTemplateInputSchema";
import type { EditTemplateInputSchema } from "./EditTemplateInputSchema";
import type { EditTemplateCellsInputSchema } from "./EditTemplateCellsInputSchema";
import { commitProjectConfigFx } from "./commitProjectConfigFx";

export namespace mutateTemplateFx {
	export type Change =
		| {
				readonly type: "create";
				readonly input: CreateTemplateInputSchema.Type;
		  }
		| {
				readonly type: "edit";
				readonly input: EditTemplateInputSchema.Type;
		  }
		| {
				readonly type: "cells";
				readonly input: EditTemplateCellsInputSchema.Type;
		  }
		| {
				readonly type: "delete";
				readonly input: {
					readonly templateUid: string;
					readonly revision: number;
				};
		  };
}

const editCellsFx = Effect.fn("editTemplateCellsFx")(function* (
	template: TemplateSchema.Type,
	changes: EditTemplateCellsInputSchema.Type["changes"],
	items: Project["config"]["items"],
) {
	const board = [
		...template.board,
	];
	for (const [index, change] of changes.entries()) {
		if (
			(change.type === "place" || change.type === "replace") &&
			!Object.hasOwn(items, change.itemUid)
		)
			return yield* Effect.fail(
				new Error(
					`Change ${index + 1}: item ${change.itemUid} does not exist. Use item_collection to find an existing item UID.`,
				),
			);
		const source = change.type === "move" ? change.from : change;
		const destination = change.type === "move" ? change.to : source;
		for (const point of change.type === "move"
			? [
					source,
					destination,
				]
			: [
					source,
				]) {
			if (point.x >= template.width || point.y >= template.height)
				return yield* Effect.fail(
					new Error(
						`Change ${index + 1}: cell (${point.x}, ${point.y}) is outside template ${template.uid} (${template.width} × ${template.height}).`,
					),
				);
		}
		const sourceIndex = board.findIndex((cell) => cell.x === source.x && cell.y === source.y);
		if (change.type !== "place" && sourceIndex === -1)
			return yield* Effect.fail(
				new Error(
					`Change ${index + 1}: cell (${source.x}, ${source.y}) is empty; ${change.type} requires an existing item.`,
				),
			);
		if (
			(change.type === "place" || change.type === "move") &&
			board.some((cell) => cell.x === destination.x && cell.y === destination.y)
		)
			return yield* Effect.fail(
				new Error(
					`Change ${index + 1}: cell (${destination.x}, ${destination.y}) is occupied; use replace to overwrite it.`,
				),
			);
		match(change)
			.with(
				{
					type: "place",
				},
				(change) => {
					board.push({
						x: change.x,
						y: change.y,
						itemUid: change.itemUid,
					});
				},
			)
			.with(
				{
					type: "replace",
				},
				(change) => {
					board[sourceIndex] = {
						x: change.x,
						y: change.y,
						itemUid: change.itemUid,
					};
				},
			)
			.with(
				{
					type: "move",
				},
				(change) => {
					board[sourceIndex] = {
						...board[sourceIndex]!,
						...change.to,
					};
				},
			)
			.with(
				{
					type: "remove",
				},
				() => {
					board.splice(sourceIndex, 1);
				},
			)
			.exhaustive();
	}
	return board;
});

/** Plans one template candidate, validates it, then uses the Editor's revision-guarded commit. */
export const mutateTemplateFx = Effect.fn("mutateTemplateFx")(function* ({
	change,
	project,
	repository,
	notifyProjectChangedFn,
}: {
	readonly change: mutateTemplateFx.Change;
	readonly project: Project;
	readonly repository: ProjectRepositoryService;
	readonly notifyProjectChangedFn: (projectId: string) => void;
}) {
	const { revision } = change.input;
	if (revision !== project.revision)
		return yield* Effect.fail(
			new Error(
				`Revision ${revision} is stale; the open project is at revision ${project.revision}. Read template_detail or template_config again before editing.`,
			),
		);
	const templates = project.config.templates ?? [];
	const uid = change.type === "create" ? createId() : change.input.templateUid;
	const previous = templates.find((template) => template.uid === uid);
	if (change.type === "create" && previous !== undefined)
		return yield* Effect.fail(new Error(`Template UID ${uid} already exists; retry creation.`));
	if (change.type !== "create" && previous === undefined)
		return yield* Effect.fail(
			new Error(
				`Template ${uid} does not exist. Read template_collection for available UIDs.`,
			),
		);
	let next: TemplateSchema.Type | undefined = yield* match(change)
		.with(
			{
				type: "create",
			},
			({ input }) =>
				Effect.succeed({
					uid,
					title: input.title,
					width: input.width ?? project.config.meta.board.width,
					height: input.height ?? project.config.meta.board.height,
					board: input.board,
				}),
		)
		.with(
			{
				type: "edit",
			},
			({ input }) =>
				Effect.succeed({
					...previous!,
					...input.patch,
				}),
		)
		.with(
			{
				type: "cells",
			},
			({ input }) =>
				editCellsFx(previous!, input.changes, project.config.items).pipe(
					Effect.map((board) => ({
						...previous!,
						board,
					})),
				),
		)
		.with(
			{
				type: "delete",
			},
			() =>
				Effect.gen(function* () {
					const blockers = readTemplateDeleteBlockersFn(project.config, uid);
					if (blockers.length > 0)
						return yield* Effect.fail(
							new Error(
								[
									`Template ${uid} is referenced. Update these references before deleting:`,
									...blockers.map(
										(entry) => `- ${entry.path.join(".")}: ${entry.message}`,
									),
								].join("\n"),
							),
						);
					return undefined;
				}),
		)
		.exhaustive();
	if (next !== undefined) {
		const parsed = TemplateSchema.safeParse(next);
		if (!parsed.success)
			return yield* Effect.fail(
				new Error(
					`Invalid template ${uid}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
				),
			);
		next = parsed.data;
		// The repository permits unfinished projects. Validate this template's item references only.
		for (const cell of next.board) {
			if (!Object.hasOwn(project.config.items, cell.itemUid))
				return yield* Effect.fail(
					new Error(
						`Template ${uid}, cell (${cell.x}, ${cell.y}): item ${cell.itemUid} does not exist. Use item_collection to find an existing item UID.`,
					),
				);
		}
	}
	const candidate = next;
	const commit = yield* commitProjectConfigFx({
		config: {
			...project.config,
			templates:
				change.type === "create"
					? [
							...templates,
							candidate!,
						]
					: templates.flatMap((template) =>
							match({
								selected: template.uid === uid,
								candidate,
							})
								.with(
									{
										selected: false,
									},
									() => [
										template,
									],
								)
								.with(
									{
										candidate: undefined,
									},
									() => [],
								)
								.with(
									{
										candidate: P.nonNullable,
									},
									({ candidate }) => [
										candidate,
									],
								)
								.exhaustive(),
						),
		},
		project,
		repository,
		revision,
		notifyProjectChangedFn,
	});
	return [
		match(change.type)
			.with("delete", () => "Deleted template.")
			.with("create", () => "Created template.")
			.with("edit", "cells", () => "Edited template.")
			.exhaustive(),
		`UID: ${uid}`,
		`Revision: ${commit.revision}`,
		...(candidate === undefined
			? []
			: [
					`Board: ${candidate.width} × ${candidate.height}; items: ${candidate.board.length}`,
				]),
	].join("\n");
});
