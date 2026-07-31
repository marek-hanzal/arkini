import { match } from "ts-pattern";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type {
	EditorDrop,
	EditorDropWeight,
	EditorInput,
	EditorLineRule,
	EditorMerge,
	EditorOutput,
	EditorQuery,
	EditorRoll,
	EditorSelector,
	EditorWhen,
} from "~/bridge/item/editor/EditorItemModel";
import type { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { createEditorLineDraft } from "~/engine/line/editor/createEditorLineDraft";

export const createEditorInputDraft = (type: EditorInput["type"], itemId = ""): EditorInput =>
	match(type)
		.with("simple", () => ({
			type: "simple" as const,
		}))
		.with("materials", () => ({
			type: "materials" as const,
			selector: {
				type: "item" as const,
				itemId,
			},
			mode: "consume" as const,
			quantity: {
				type: "value" as const,
				value: 1,
			},
			capacity: 0,
		}))
		.with("deposit", () => ({
			type: "deposit" as const,
			query: {
				scope: "board" as const,
				distance: "close" as const,
				selector: {
					type: "item" as const,
					itemId,
				},
			},
		}))
		.exhaustive();

export const createEditorDropDraft = (itemId = ""): EditorDrop => ({
	itemId,
	quantity: {
		type: "value",
		value: 1,
	},
	placement: "drop",
	rules: [],
});

export const createEditorRollDraft = (type: EditorRoll["type"], itemId = ""): EditorRoll =>
	match(type)
		.with("guaranteed", () => ({
			type: "guaranteed" as const,
			drop: [
				createEditorDropDraft(itemId),
			] as [
				EditorDrop,
			],
		}))
		.with("chance", () => ({
			type: "chance" as const,
			chance: 0.5,
			drop: [
				createEditorDropDraft(itemId),
			] as [
				EditorDrop,
			],
		}))
		.with("weight", () => ({
			type: "weight" as const,
			quantity: {
				type: "value" as const,
				value: 1,
			},
			drop: [
				{
					weight: 1,
					drop: [
						createEditorDropDraft(itemId),
					] as [
						EditorDrop,
					],
				},
				{
					weight: 1,
					drop: [
						createEditorDropDraft(itemId),
					] as [
						EditorDrop,
					],
				},
			] as [
				EditorDropWeight,
				EditorDropWeight,
				...EditorDropWeight[],
			],
		}))
		.exhaustive();

export const createEditorOutputDraft = (itemId = ""): EditorOutput => ({
	set: [
		{
			roll: [
				createEditorRollDraft("guaranteed", itemId),
			],
		},
	],
});

export const createEditorMergeDraft = (): EditorMerge => ({
	target: {
		type: "item",
		itemId: "",
	},
	action: "use",
	effect: "keep",
});

export const createEditorQueryDraft = (
	scope: EditorQuery["scope"],
	selector: EditorSelector,
): EditorQuery =>
	scope === "board"
		? {
				scope,
				distance: "close",
				selector,
			}
		: {
				scope,
				selector,
			};

export const createEditorWhenDraft = (
	type: EditorWhen["type"],
	query = createEditorQueryDraft("any", {
		type: "item",
		itemId: "",
	}),
): EditorWhen =>
	match(type)
		.with("exists", () => ({
			type: "exists" as const,
			query,
		}))
		.with("count", () => ({
			type: "count" as const,
			query,
			count: 1,
		}))
		.with("range", () => ({
			type: "range" as const,
			query,
			min: 1,
			max: 1,
		}))
		.exhaustive();

export const createEditorLineRuleDraft = (type: EditorLineRule["type"]): EditorLineRule =>
	({
		type,
		when: [
			createEditorWhenDraft("exists"),
		],
		...(type === "runtime:multiplier"
			? {
					multiplier: 1,
				}
			: {}),
	}) as EditorLineRule;

/** Creates one structurally complete initial value for the selected item schema. */
export const createEditorItemDraft = (
	type: ItemEnumSchema.Type,
	project: EditorProject,
	uid: string,
): ItemSchema.Type => {
	const itemId = type === "producer" ? "producer:new-item" : "item:new-item";
	const resourceId = project.resources[0]?.id ?? "missing-asset";
	const base = {
		uid,
		id: itemId,
		title: "",
		description: "",
		asset: {
			default: [
				resourceId,
			] as [
				string,
			],
		},
		tags: [],
		categoryId: Object.keys(project.config?.categories ?? {})[0] ?? "default",
		scope: "any" as const,
		maxStackSize: 1,
	};
	return match(type)
		.with("simple", (matchedType) => ({
			...base,
			type: matchedType,
		}))
		.with("inventory", (matchedType) => ({
			...base,
			type: matchedType,
			scope: "board" as const,
			maxCount: 1,
			maxStackSize: 1,
		}))
		.with("temporary", (matchedType) => ({
			...base,
			type: matchedType,
			scope: "board" as const,
			maxStackSize: 1,
			durationMs: 500,
		}))
		.with("deposit", (matchedType) => ({
			...base,
			type: matchedType,
			maxQueueSize: 1,
		}))
		.with("producer", (matchedType) => ({
			...base,
			type: matchedType,
			maxQueueSize: 1,
			lines: [
				createEditorLineDraft({
				existingLines: [],
				itemId,
				type: matchedType,
			}),
			] as [
				LineSchema.Type,
			],
		}))
		.with("blueprint", "craft", "stash", (lineType) => ({
			...base,
			type: lineType,
			line: createEditorLineDraft({
				existingLines: [],
				itemId,
				type: lineType,
			}),
		}))
		.exhaustive();
};
