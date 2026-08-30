export const EditorItemSectionIds = [
	"identity",
	"artwork",
	"charges",
	"merges",
	"action",
	"production",
	"estimate",
	"delete",
] as const;

export type EditorItemSectionId = (typeof EditorItemSectionIds)[number];

export type EditorItemOptionalCapability = Extract<EditorItemSectionId, "charges" | "merges">;

export interface EditorItemSectionDescriptor {
	readonly id: EditorItemSectionId;
	readonly label: string;
}
