import { About } from "~/ui/launcher/About";
import { AboutEasterEgg } from "~/ui/launcher/AboutEasterEgg";
import { AboutJumpscare } from "~/ui/launcher/AboutJumpscare";
import { useAboutEasterEggDelay } from "~/ui/launcher/useAboutEasterEggDelay";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const AboutPage = () => {
	const easterEggActive = useAboutEasterEggDelay();

	return (
		<MainPageLayout
			foregroundOverlay={<AboutJumpscare active={easterEggActive} />}
			labelledBy="about-title"
			overlay={<AboutEasterEgg active={easterEggActive} />}
			page="about"
		>
			<About />
		</MainPageLayout>
	);
};
