import { EditorWelcome } from "~/ui/editor/EditorWelcome";
import { MainPageLayout } from "~/ui/main-page/MainPageLayout";

export namespace EditorWelcomePage {
	export type Props = EditorWelcome.Props;
}

export const EditorWelcomePage = ({ recentProjects }: EditorWelcomePage.Props) => (
	<MainPageLayout
		labelledBy="editor-welcome-title"
		page="editor-welcome"
		panelMode="responsive"
		panelClassName="max-w-3xl"
	>
		<EditorWelcome recentProjects={recentProjects} />
	</MainPageLayout>
);
