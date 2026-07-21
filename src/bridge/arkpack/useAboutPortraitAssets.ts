import { useEffect, useState } from "react";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { readAboutPortraitResources } from "~/bridge/arkpack/readAboutPortraitResources";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Resolves optional About avatars from the canonical built-in package resource owner. */
export const useAboutPortraitAssets = (): readonly string[] => {
	const [portraitUrls, setPortraitUrls] = useState<readonly string[]>([]);

	useEffect(() => {
		let disposed = false;
		let ownedUrls: string[] = [];
		void RendererRuntime.runPromise(
			loadArkpackFx({
				packageId: ArkiniArkpack.packageId,
			}),
		)
			.then((loaded) => {
				const urls = readAboutPortraitResources(loaded.payload).map((resource) =>
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
				if (disposed) {
					for (const url of urls) URL.revokeObjectURL(url);
					return;
				}
				ownedUrls = urls;
				setPortraitUrls(urls);
			})
			.catch(() => {
				if (!disposed) setPortraitUrls([]);
			});

		return () => {
			disposed = true;
			for (const url of ownedUrls) URL.revokeObjectURL(url);
			ownedUrls = [];
		};
	}, []);

	return portraitUrls;
};
