import type { EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

export const EditorAssetSectionHelp = {
	overview: {
		title: <Tx label="Asset" />,
		content: <Mx label="Asset overview help" />,
	},
	usage: {
		title: <Tx label="Usage" />,
		content: <Mx label="Asset usage help" />,
	},
	technical: {
		title: <Tx label="Technical" />,
		content: <Mx label="Asset technical help" />,
	},
	notes: {
		title: <Tx label="Notes" />,
		content: <Mx label="Notes help" />,
	},
	delete: {
		title: <Tx label="Delete asset" />,
		content: <Mx label="Asset delete help" />,
	},
	edit: {
		title: <Tx label="Edit asset" />,
		content: <Mx label="Asset editing help" />,
	},
} satisfies Record<string, EditorPageHelpContent>;
