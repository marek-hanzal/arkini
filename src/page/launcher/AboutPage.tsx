import { useAboutPortraitAssets } from "~/bridge/arkpack/useAboutPortraitAssets";
import { About } from "~/ui/launcher/About";
import { AboutEasterEgg } from "~/ui/launcher/AboutEasterEgg";
import { AboutJumpscare } from "~/ui/launcher/AboutJumpscare";
import { useAboutEasterEggDelay } from "~/ui/launcher/useAboutEasterEggDelay";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const AboutPage = () => {
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
};
