import { useEditorProject } from "~/authoring-session/useEditorProject";
import { formatByteSizeFn } from "~/ui/formatByteSizeFn";
import { ItemInfoFact, ItemInfoFacts } from "~/ui/item-detail/ItemInfoPresentation";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";

export const EditorAssetTechnical = ({ resourceId }: { readonly resourceId: string }) => {
	const project = useEditorProject();
	const resource = useEditorAssetById(resourceId);
	if (resource === undefined) return null;
	return (
		<ItemInfoFacts>
			<ItemInfoFact
				label="Resource ID"
				mono
				value={resource.id}
			/>
			<ItemInfoFact
				label="MIME type"
				mono
				value={resource.mime}
			/>
			<ItemInfoFact
				label="Byte size"
				value={formatByteSizeFn(resource.bytes.byteLength)}
			/>
			<ItemInfoFact
				label="Project revision"
				value={String(project.revision)}
			/>
			<ItemInfoFact
				label="Package status"
				value="Included in current project"
			/>
		</ItemInfoFacts>
	);
};
