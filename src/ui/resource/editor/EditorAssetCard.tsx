import { Image as ImageIcon } from "lucide-react";

import { useEditorProject } from "~/ui/editor/useEditorProject";
import type { EditorProject } from "~/editor/EditorProject";
import { ButtonLink } from "~/ui/button/Button";
import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

export const EditorAssetCard = ({
	filter,
	query,
	resource,
}: {
	readonly filter: "all" | "unused";
	readonly query: string;
	readonly resource: EditorProject["resources"][number];
}) => {
	const project = useEditorProject();
	const url = useEditorResourceUrl(resource.id);
	return (
		<ButtonLink
			to="/editor/$projectId/assets/$resourceId/detail/overview"
			params={{
				projectId: project.projectId,
				resourceId: resource.id,
			}}
			search={{
				filter,
				query,
			}}
			className="group grid min-h-0 min-w-0 grid-rows-[minmax(8rem,1fr)_auto] overflow-hidden rounded-xl border-0 border-l-2 border-line-strong bg-surface-raised/60 p-0 text-left shadow-none hover:bg-surface-raised"
			data-ui="EditorAssetCard"
		>
			<span className="grid min-h-32 place-items-center overflow-hidden p-4">
				{url === undefined ? (
					<ImageIcon
						className="size-8 text-subtle"
						aria-hidden="true"
					/>
				) : (
					<img
						src={url}
						alt=""
						className="max-h-44 max-w-full object-contain"
						draggable={false}
						loading="lazy"
					/>
				)}
			</span>
			<span className="min-w-0 px-3 py-2.5">
				<span className="block truncate font-semibold">{resource.id}</span>
			</span>
		</ButtonLink>
	);
};
