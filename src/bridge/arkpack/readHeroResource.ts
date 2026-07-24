import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

/** Reads the required Hero bytes selected by one validated package configuration. */
export const readHeroResource = (payload: PayloadSchema.Type): ResourceSchema.Type => {
	const resourceId = payload.config.resources.hero;
	const resource = payload.resources.find((candidate) => candidate.id === resourceId);
	if (resource === undefined) {
		throw new Error(`Arkpack Hero resource ${resourceId} is unavailable.`);
	}
	return resource;
};
