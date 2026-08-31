import { useAtomValue } from "@effect/atom-react";
import { createFileRoute } from "@tanstack/react-router";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect, useState } from "react";

import { About } from "~/launcher/ui/About";
import { AboutEasterEgg } from "~/launcher/ui/AboutEasterEgg";
import { AboutJumpscare } from "~/launcher/ui/AboutJumpscare";
import { AboutPortraitAssetsAtom } from "~/launcher/atom/AboutPortraitAssetsAtom";
import { LauncherPageLayout } from "~/launcher/ui/LauncherPageLayout";

const aboutEasterEggDelayMs = 2_000;

/** Delays the route-only easter egg until the settled About page has remained visible. */
const useAboutEasterEggDelay = () => {
	const [active, setActiveFn] = useState(false);

	useEffect(() => {
		const timeout = window.setTimeout(() => setActiveFn(true), aboutEasterEggDelayMs);
		return () => window.clearTimeout(timeout);
	}, []);

	return active;
};

const useAboutPortraitAssets = (): readonly string[] => {
	const result = useAtomValue(AboutPortraitAssetsAtom);
	return AsyncResult.isSuccess(result) ? result.value : [];
};

export const Route = createFileRoute("/_launcher/about")({
	component: () => {
		const portraitUrls = useAboutPortraitAssets();
		const easterEggActive = useAboutEasterEggDelay() && portraitUrls.length > 0;

		return (
			<LauncherPageLayout
				foregroundOverlay={
					portraitUrls.length === 0 ? undefined : (
						<AboutJumpscare
							active={easterEggActive}
							portraitUrls={portraitUrls}
						/>
					)
				}
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
			</LauncherPageLayout>
		);
	},
});
