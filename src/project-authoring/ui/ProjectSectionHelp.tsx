import type { EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

export const ProjectSectionHelp: Record<ProjectSectionId, EditorPageHelpContent> = {
	introduction: {
		title: <Tx label="Introduction" />,
		content: (
			<Mx label="Write a Markdown welcome for new players. It appears before a new game starts and is skipped when a save exists. Leave it empty to start immediately." />
		),
	},
	general: {
		title: <Tx label="Project" />,
		content: <Mx label="Project general help" />,
	},
	images: {
		title: <Tx label="Images" />,
		content: <Mx label="Project images help" />,
	},
	board: {
		title: <Tx label="Board" />,
		content: (
			<>
				<Mx label="Board editing help" />
				<Mx label="Starting layout controls help" />
			</>
		),
	},
	toolbar: {
		title: <Tx label="Toolbar" />,
		content: (
			<>
				<Mx label="Toolbar editing help" />
				<Mx label="Starting layout controls help" />
			</>
		),
	},
	inventory: {
		title: <Tx label="Inventory" />,
		content: (
			<>
				<Mx label="Inventory editing help" />
				<Mx label="Starting layout controls help" />
			</>
		),
	},
};
