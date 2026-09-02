export const ItemConnectionFilters = [
	"required-by",
	"inputs",
	"produces",
] as const;

export type ItemConnectionFilter = (typeof ItemConnectionFilters)[number];
