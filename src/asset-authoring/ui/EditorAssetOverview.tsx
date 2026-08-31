import { useState } from "react";

import { Fact, FactList } from "~/ui/ui/FactList";
import { useEditorAssetById } from "~/asset-authoring/ui/useEditorAssetById";
import { useResourceUrl } from "~/authoring-session/ui/ResourceUrlSession";

export const EditorAssetOverview = ({ resourceId }: { readonly resourceId: string }) => {
	const resource = useEditorAssetById(resourceId);
	const url = useResourceUrl(resourceId);
	const [dimensions, setDimensionsFn] = useState<{
		readonly height: number;
		readonly url: string;
		readonly width: number;
	}>();
	if (resource === undefined) return null;
	const currentDimensions = dimensions?.url === url ? dimensions : undefined;
	return (
		<section className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
			<div className="grid min-h-72 place-items-center overflow-hidden p-5">
				{url === undefined ? (
					<p className="text-sm text-muted">Preparing asset preview…</p>
				) : (
					<img
						src={url}
						alt={`${resource.id} preview`}
						className="max-h-[32rem] max-w-full object-contain"
						draggable={false}
						onLoad={(event) =>
							setDimensionsFn({
								height: event.currentTarget.naturalHeight,
								url,
								width: event.currentTarget.naturalWidth,
							})
						}
					/>
				)}
			</div>
			<FactList>
				<Fact
					label="Resource ID"
					mono
					value={resource.id}
				/>
				<Fact
					label="Dimensions"
					value={
						currentDimensions === undefined
							? "Reading image…"
							: `${currentDimensions.width} × ${currentDimensions.height} px`
					}
				/>
			</FactList>
		</section>
	);
};
