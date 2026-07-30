import { EditorWelcome } from "~/ui/editor/EditorWelcome";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export const EditorWelcomePage = () => (
	<MainPageLayout
		labelledBy="editor-welcome-title"
		page="editor-welcome"
		panelMode="responsive"
	>
		<EditorWelcome />
	</MainPageLayout>
);
