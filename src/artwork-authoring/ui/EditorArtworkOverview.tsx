import { useTranslator } from "~/translation/ui/useTranslator";
import { useState } from "react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { formatByteSizeFn } from "~/ui/fn/formatByteSizeFn";
import { Fact, FactList } from "~/ui/ui/FactList";
import { useEditorArtworkByUid } from "~/artwork-authoring/ui/useEditorArtworkByUid";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

export const EditorArtworkOverview = ({ resourceUid }: { readonly resourceUid: string }) => {
	const translator = useTranslator();
	const resource = useEditorArtworkByUid(resourceUid);
	const url = useResourceUrl(resourceUid);
	const [dimensions, setDimensionsFn] = useState<{
		readonly height: number;
		readonly url: string;
		readonly width: number;
	}>();
	if (resource === undefined) return null;
	const currentDimensions = dimensions?.url === url ? dimensions : undefined;
	return (
		<section
			className="mx-auto flex h-full min-h-0 w-3/4 min-w-0 flex-col gap-3 overflow-y-auto p-3"
			data-ui="EditorArtworkOverview"
		>
			<EditorRootCard dataUi="EditorArtworkDetailsCard">
				<FactList columns={3}>
					<Fact
						label={translator.textFn("Resource UID")}
						mono
						value={resource.uid}
					/>
					<Fact
						label={translator.textFn("Dimensions")}
						value={
							currentDimensions === undefined
								? translator.textFn("Reading image…")
								: `${currentDimensions.width} × ${currentDimensions.height} px`
						}
					/>
					<Fact
						label={translator.textFn("Byte size")}
						value={formatByteSizeFn(resource.size)}
					/>
				</FactList>
			</EditorRootCard>
			<div
				className="grid min-h-48 min-w-0 flex-1 place-items-center [container-type:size]"
				data-ui="EditorArtworkPreviewArea"
			>
				{url === undefined ? (
					<p className="text-sm text-muted">
						{translator.textFn("Preparing artwork preview…")}
					</p>
				) : (
					<div className="grid size-[min(80cqh,100cqw)] place-items-center overflow-hidden rounded-2xl border-2 border-accent bg-canvas/70">
						<img
							src={url}
							alt={`${resource.uid} preview`}
							className="size-full object-contain"
							draggable={false}
							onLoad={(event) =>
								setDimensionsFn({
									height: event.currentTarget.naturalHeight,
									url,
									width: event.currentTarget.naturalWidth,
								})
							}
						/>
					</div>
				)}
			</div>
		</section>
	);
};
