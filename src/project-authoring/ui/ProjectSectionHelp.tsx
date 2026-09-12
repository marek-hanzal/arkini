import type { EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import type { ProjectSectionId } from "~/project-authoring/type/ProjectSections";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

export const ProjectSectionHelp: Record<ProjectSectionId, EditorPageHelpContent> = {
	general: {
		title: <Tx label="Project" />,
		content: <Mx label="Project general help" />,
	},
	artwork: {
		title: <Tx label="Artwork" />,
		content: <Mx label="Project artwork help" />,
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
