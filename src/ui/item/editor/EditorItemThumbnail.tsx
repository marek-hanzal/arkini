import { useEditorResourceUrl } from "~/ui/resource/editor/useEditorResourceUrl";

export namespace EditorItemThumbnail {
	export interface Props {
		readonly resourceIds:
			| readonly [
					string,
			  ]
			| readonly [
					string,
					string,
			  ];
	}
}

/** Renders the complete default item composition from back to front. */
export const EditorItemThumbnail = ({ resourceIds }: EditorItemThumbnail.Props) => {
	const backgroundUrl = useEditorResourceUrl(resourceIds[0]);
	const foregroundUrl = useEditorResourceUrl(resourceIds[1]);
	return (
		<div
			className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-canvas/70"
			data-ui="EditorItemThumbnail"
		>
			{backgroundUrl === undefined ? (
				<span className="text-xl font-semibold text-subtle">?</span>
			) : (
				<img
					src={backgroundUrl}
					alt=""
					className="absolute inset-0 size-full object-contain p-1"
					draggable={false}
				/>
			)}
			{foregroundUrl === undefined ? null : (
				<img
					src={foregroundUrl}
					alt=""
					className="absolute inset-0 size-full object-contain p-1"
					draggable={false}
				/>
			)}
		</div>
	);
};
