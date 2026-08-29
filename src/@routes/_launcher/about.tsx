import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { About } from "~/ui/launcher/About";
import { AboutEasterEgg } from "~/ui/launcher/AboutEasterEgg";
import { AboutJumpscare } from "~/ui/launcher/AboutJumpscare";
import { AboutPortraitAssetsAtom } from "~/ui/launcher/about/AboutPortraitAssetsAtom";
import { useAboutEasterEggDelay } from "~/ui/launcher/useAboutEasterEggDelay";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

const useAboutPortraitAssets = (): readonly string[] => {
	const result = useAtomValue(AboutPortraitAssetsAtom);
	return AsyncResult.isSuccess(result) ? result.value : [];
};

export const Route = createFileRoute("/_launcher/about")({
	component: () => {
		const portraitUrls = useAboutPortraitAssets();
		const easterEggActive = useAboutEasterEggDelay() && portraitUrls.length > 0;

		return (
			<MainPageLayout
				foregroundOverlay={
					portraitUrls.length === 0 ? undefined : (
						<AboutJumpscare
							active={easterEggActive}
							portraitUrls={portraitUrls}
						/>
					)
				}
				labelledBy="about-title"
				overlay={
					portraitUrls.length === 0 ? undefined : (
						<AboutEasterEgg
							active={easterEggActive}
							portraitUrls={portraitUrls}
						/>
					)
				}
				page="about"
			>
				<About />
			</MainPageLayout>
		);
	},
});
