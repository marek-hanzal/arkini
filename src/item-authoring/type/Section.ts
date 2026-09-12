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

export type OptionalCapability = Extract<
	SectionId,
	"units" | "merges" | "clock" | "action" | "production"
>;

export interface SectionDescriptor {
	readonly id: SectionId;
	readonly label: string;
}

export type DetailSectionId = Extract<
	SectionId,
	"identity" | "production" | "merges" | "estimate" | "connections" | "notes" | "delete"
>;
