import { About } from "~/ui/launcher/About";
import { AboutEasterEgg } from "~/ui/launcher/AboutEasterEgg";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const AboutPage = () => (
	<MainPageLayout
		labelledBy="about-title"
		overlay={<AboutEasterEgg />}
		page="about"
	>
		<About />
	</MainPageLayout>
);
