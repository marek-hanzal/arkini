import { About } from "~/ui/launcher/About";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const AboutPage = () => (
	<MainPageLayout
		labelledBy="about-title"
		page="about"
	>
		<About />
	</MainPageLayout>
);
