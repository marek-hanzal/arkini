export const SectionIds = [
	"identity",
	"artwork",
	"merges",
	"production",
	"clock",
	"automation",
	"connections",
	"chain",
	"notes",
	"delete",
] as const;

export type SectionId = (typeof SectionIds)[number];

export type OptionalCapability = "units" | "merges" | "clock" | "production";

export interface SectionDescriptor {
	readonly id: SectionId;
	readonly label: string;
	readonly shortcut?: string;
}
