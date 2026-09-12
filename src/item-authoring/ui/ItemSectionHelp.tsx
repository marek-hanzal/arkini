import type { SectionId } from "~/item-authoring/type/Section";
import type { EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

/** Shares each item's page-level explanation between detail and authoring. */
export const ItemSectionHelp: Partial<Record<SectionId, EditorPageHelpContent>> = {
	merges: {
		title: <Tx label="Merges" />,
		content: <Mx label="Item merges help" />,
	},
	units: {
		title: <Tx label="Units" />,
		content: <Mx label="Item units help" />,
	},
	clock: {
		title: <Tx label="Clock" />,
		content: <Mx label="Item clock help" />,
	},
	artwork: {
		title: <Tx label="Artwork" />,
		content: <Mx label="Item artwork help" />,
	},
	estimate: {
		title: <Tx label="Estimate" />,
		content: <Mx label="Item estimate help" />,
	},
	connections: {
		title: <Tx label="Connections" />,
		content: <Mx label="Item connections help" />,
	},
};
