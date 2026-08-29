export namespace readArtworkLayoutFn {
	export interface Props {
		readonly faceSize: number;
		readonly inset: number;
		readonly layered: boolean;
	}
}

const layeredArtworkToFaceRatio = 0.75;

/** Projects stable artwork bounds for one tile face revision. */
export const readArtworkLayoutFn = ({ faceSize, inset, layered }: readArtworkLayoutFn.Props) => {
	const artworkSize = layered ? faceSize * layeredArtworkToFaceRatio : faceSize;
	return {
		primary: {
			x: inset,
			y: inset,
			size: artworkSize,
		},
		secondary: {
			x: inset + faceSize - artworkSize,
			y: inset + faceSize - artworkSize,
			size: artworkSize,
		},
	} as const;
};
