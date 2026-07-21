import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

const avatarRoles = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
] as const;

/** Reads configured About avatar resources in stable anonymous package-role order. */
export const readAboutPortraitResources = (
	payload: PayloadSchema.Type,
): readonly ResourceSchema.Type[] => {
	const resourceById = new Map(
		payload.resources.map((resource) => [
			resource.id,
			resource,
		]),
	);
	return avatarRoles.flatMap((role) => {
		const resourceId = payload.config.resources[role];
		if (resourceId === undefined) return [];
		const resource = resourceById.get(resourceId);
		return resource === undefined
			? []
			: [
					resource,
				];
	});
};
