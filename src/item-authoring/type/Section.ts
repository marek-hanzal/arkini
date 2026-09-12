export const SectionIds = [
	"identity",
	"artwork",
	"units",
	"merges",
	"action",
	"clock",
	"production",
	"estimate",
	"connections",
	"notes",
	"delete",
] as const;

export type SectionId = (typeof SectionIds)[number];

export type OptionalCapability = Extract<SectionId, "units" | "merges" | "clock">;

export interface SectionDescriptor {
	readonly id: SectionId;
	readonly label: string;
}
