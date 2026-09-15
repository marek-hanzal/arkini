import { Effect } from "effect";
import { ArkiniDefaultPackageId } from "~shared/ArkiniAppMetadata";
import { loadArkpackFx } from "~/arkpack-catalog/fx/loadArkpackFx";
import type { LoadedArkpackResource } from "~/arkpack-catalog/fx/readArkpackCandidatesFx";

const avatarRoles = [
	"avatar-01",
	"avatar-02",
	"avatar-03",
	"avatar-04",
	"avatar-05",
	"avatar-06",
	"avatar-07",
] as const;

const readAboutPortraitResourcesFn = (payload: {
	readonly config: {
		readonly resources: Readonly<Record<string, string>>;
	};
	readonly resources: ReadonlyArray<LoadedArkpackResource>;
}) => {
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

/** Resolves canonical Arkini About portraits to lazy installed-resource URLs. */
export const createAboutPortraitAssetsFx = Effect.fn("createAboutPortraitAssetsFx")(() =>
	Effect.gen(function* () {
		const loaded = yield* loadArkpackFx({
			packageId: ArkiniDefaultPackageId,
		});
		return readAboutPortraitResourcesFn(loaded.payload).map(({ url }) => url);
	}).pipe(Effect.catch(() => Effect.succeed([]))),
);
