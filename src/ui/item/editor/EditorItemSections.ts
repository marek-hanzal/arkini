import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";

export const EditorItemSectionIds = [
	"identity",
	"artwork",
	"charges",
	"merges",
	"production",
	"estimate",
	"flow",
] as const;

export type EditorItemSectionId = (typeof EditorItemSectionIds)[number];

export type EditorItemOptionalCapability = Extract<EditorItemSectionId, "charges" | "merges">;

type EditorItemField = EditorItem extends infer Member
	? Member extends EditorItem
		? keyof Member
		: never
	: never;

/** Compile-time audit assigning every canonical top-level item field to one detail section. */
export const EditorItemFieldSections = {
	uid: "identity",
	id: "identity",
	type: "identity",
	title: "identity",
	description: "identity",
	scope: "identity",
	asset: "artwork",
	maxCount: "identity",
	maxStackSize: "identity",
	charges: "charges",
	merge: "merges",
	durationMs: "production",
	output: "production",
	maxQueueSize: "production",
	line: "production",
	lines: "production",
} as const satisfies Record<EditorItemField, EditorItemSectionId>;

export interface EditorItemSectionDescriptor {
	readonly id: EditorItemSectionId;
	readonly label: string;
}
