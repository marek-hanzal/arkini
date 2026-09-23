import { Effect } from "effect";
import { SerakkiDefaultPackageId } from "~shared/SerakkiAppMetadata";
import { loadSerapackFx } from "~/serapack-catalog/fx/loadSerapackFx";
import type { LoadedSerapackResource } from "~/serapack-catalog/fx/readSerapackCandidatesFx";

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
	readonly resources: ReadonlyArray<LoadedSerapackResource>;
}) => {
	const resourceById = new Map(
		payload.resources.map((resource) => [
			resource.uid,
			resource,
		]),
	);
	return avatarRoles.flatMap((role) => {
		const resourceUid = payload.config.resources[role];
		if (resourceUid === undefined) return [];
		const resource = resourceById.get(resourceUid);
		return resource === undefined
			? []
			: [
					resource,
				];
	});
};

/** Resolves canonical Serakki About portraits to lazy installed-resource URLs. */
export const createAboutPortraitImagesFx = Effect.fn("createAboutPortraitImagesFx")(() =>
	Effect.gen(function* () {
		const loaded = yield* loadSerapackFx({
			packageId: SerakkiDefaultPackageId,
		});
		return readAboutPortraitResourcesFn(loaded.payload).map(({ url }) => url);
	}).pipe(Effect.catch(() => Effect.succeed([]))),
);
