import type { SectionId } from "~/item-authoring/type/Section";
import type { EditorPageHelpContent } from "~/authoring-shell/ui/EditorPageHelp";
import { Mx } from "~/translation/ui/Mx";
import { Tx } from "~/translation/ui/Tx";

/** Shares each item's page-level explanation between detail and authoring. */
export const ItemSectionHelp: Record<SectionId, EditorPageHelpContent> = {
	identity: {
		title: <Tx label="Item" />,
		content: (
			<>
				<Mx label="Item identity help" />
				<Mx label="Item units help" />
				<Mx label="Item detail music help" />
			</>
		),
	},
	production: {
		title: <Tx label="Production" />,
		content: <Mx label="Item production help" />,
	},
	notes: {
		title: <Tx label="Notes" />,
		content: <Mx label="Notes help" />,
	},
	delete: {
		title: <Tx label="Delete item" />,
		content: <Mx label="Item delete help" />,
	},
	merges: {
		title: <Tx label="Merges" />,
		content: <Mx label="Item merges help" />,
	},
	automation: {
		title: <Tx label="Automation" />,
		content: (
			<>
				<Mx label="Item clock help" />
				<Mx label="Item automation help" />
			</>
		),
	},
	artwork: {
		title: <Tx label="Artwork" />,
		content: <Mx label="Item artwork help" />,
	},
	chain: {
		title: <Tx label="Chain" />,
		content: <Mx label="Chain help" />,
	},
	connections: {
		title: <Tx label="Connections" />,
		content: <Mx label="Item connections help" />,
	},
};
