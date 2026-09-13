export const ItemConnectionFilters = [
	"required-by",
	"inputs",
	"produces",
	"produced-by",
] as const;

export type ItemConnectionFilter = (typeof ItemConnectionFilters)[number];
