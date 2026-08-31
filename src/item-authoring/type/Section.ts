export const SectionIds = [
	"identity",
	"artwork",
	"charges",
	"merges",
	"action",
	"production",
	"estimate",
	"delete",
] as const;

export type SectionId = (typeof SectionIds)[number];

export type OptionalCapability = Extract<SectionId, "charges" | "merges">;

export interface SectionDescriptor {
	readonly id: SectionId;
	readonly label: string;
}
