import type { PayloadSchema } from "~/arkpack/artifact/schema/PayloadSchema";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";

const avatarRoles = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

/** Reads configured About avatar resources in stable anonymous package-role order. */
export const readAboutPortraitResourcesFn = (
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
