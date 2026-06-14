import type { ResourceId } from "./manifestId";

export interface ResourceDefinition {
	id: ResourceId;
	code: string;
	name: string;
	description: string;
	symbol: string;
	sort: number;
}
