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

const revokeUrlsFx = Effect.fn("createAboutPortraitAssetsFx.revokeUrlsFx")(function* (
	urls: ReadonlyArray<string>,
) {
	for (const url of urls)
		yield* Effect.sync(() => URL.revokeObjectURL(url)).pipe(
			Effect.catchCause(() => Effect.void),
		);
});

/** Resolves canonical Arkini About portraits to lazy installed-resource URLs. */
export const createAboutPortraitAssetsFx = Effect.fn("createAboutPortraitAssetsFx")(() =>
	Effect.gen(function* () {
		const loaded = yield* loadArkpackFx({
			packageId: ArkiniDefaultPackageId,
		});
		const resources = readAboutPortraitResourcesFn(loaded.payload);
		if (resources.every((resource) => "url" in resource))
			return resources.map(({ url }) => url);
		if (!resources.every((resource) => "bytes" in resource))
			return yield* Effect.fail(new Error("Arkpack resources use a mixed storage mode."));
		const urls: string[] = [];
		return yield* Effect.acquireRelease(
			Effect.try({
				try: () => {
					for (const resource of resources)
						urls.push(
							URL.createObjectURL(
								new Blob(
									[
										resource.bytes.slice().buffer,
									],
									{
										type: resource.mime,
									},
								),
							),
						);
					return urls;
				},
				catch: (cause) => cause,
			}).pipe(Effect.tapError(() => revokeUrlsFx(urls))),
			revokeUrlsFx,
			{
				interruptible: true,
			},
		);
	}).pipe(Effect.catch(() => Effect.succeed([]))),
);
