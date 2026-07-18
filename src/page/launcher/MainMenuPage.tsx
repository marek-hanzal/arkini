import { MainMenu } from "~/ui/launcher/MainMenu";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const MainMenuPage = () => (
	<MainPageLayout
		page="main-menu"
		panelMode="compact"
	>
		<MainMenu />
	</MainPageLayout>
);
