export const SectionIds = [
	"identity",
	"artwork",
	"units",
	"merges",
	"clock",
	"production",
	"connections",
	"chain",
	"notes",
	"delete",
] as const;

export type SectionId = (typeof SectionIds)[number];

export type OptionalCapability = Extract<SectionId, "units" | "merges" | "clock" | "production">;

export interface SectionDescriptor {
	readonly id: SectionId;
	readonly label: string;
	readonly shortcut?: string;
}
