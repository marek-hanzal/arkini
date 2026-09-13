import type { DropSchema } from "~/production-output/schema/DropSchema";
import { EditorCollectionOption } from "~/editor-control/ui/EditorCollectionOption";
import { EditorItemThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";

/** Lists possible emitted identities, not condition references or guaranteed runtime outcomes. */
export const OutputDropOption = ({
	label,
	drops,
	summary,
}: {
	readonly label: string;
	readonly drops: readonly DropSchema.Type[];
	readonly summary?: string;
}) => {
	const project = useEditorProject();
	const ids = [
		...new Set(drops.map((drop) => drop.itemId)),
	];
	return (
		<EditorCollectionOption
			label={label}
			details={
				summary === undefined ? undefined : (
					<span className="text-xs text-subtle">{summary}</span>
				)
			}
		>
			{ids.map((id) => (
				<EditorItemThumbnail
					key={id}
					size="md"
					className="rounded-md"
					resourceIds={
						project.config.items[id]?.asset.default ?? [
							"",
						]
					}
				/>
			))}
		</EditorCollectionOption>
	);
};
