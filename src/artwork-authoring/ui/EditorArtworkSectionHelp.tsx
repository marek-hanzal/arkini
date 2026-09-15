import type { EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

export const EditorArtworkSectionHelp = {
	overview: {
		title: <Tx label="Artwork" />,
		content: <Mx label="Artwork overview help" />,
	},
	usage: {
		title: <Tx label="Usage" />,
		content: <Mx label="Artwork usage help" />,
	},
	notes: {
		title: <Tx label="Notes" />,
		content: <Mx label="Notes help" />,
	},
	delete: {
		title: <Tx label="Delete artwork" />,
		content: <Mx label="Artwork delete help" />,
	},
	edit: {
		title: <Tx label="Edit artwork" />,
		content: <Mx label="Artwork editing help" />,
	},
} satisfies Record<string, EditorPageHelpContent>;
