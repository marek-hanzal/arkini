import type { FC } from "react";

import type { AssetSchema } from "~/v1/item/schema/AssetSchema";
import { useItemAssetUrl } from "../../../pack/hook/useItemAssetUrl";

export namespace ItemAssetThumbnail {
	export interface Props {
		asset: AssetSchema.Type;
		title: string;
	}
}

export const ItemAssetThumbnail: FC<ItemAssetThumbnail.Props> = ({ asset, title }) => {
	const url = useItemAssetUrl(asset);

	return (
		<div className="grid size-11 place-items-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
			{url ? (
				<img
					src={url}
					alt={`${title} asset`}
					className="size-full object-contain p-1"
				/>
			) : (
				<span className="text-[10px] text-slate-600">N/A</span>
			)}
		</div>
	);
};
