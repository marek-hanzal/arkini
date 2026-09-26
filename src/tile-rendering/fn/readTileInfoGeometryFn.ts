/** Keep the detail control usable at a fitted Board while letting it grow with zoom. */
export const readTileInfoGeometryFn = (zoom: number, tileSize: number) => {
	const safeZoom = Math.max(0.08, zoom);
	const diameter = Math.max(22, Math.min(48, 76 * safeZoom));
	const scale = diameter / (22 * safeZoom);
	const inset = Math.min(tileSize / 2, diameter / (2 * safeZoom) + 8 / safeZoom);
	return {
		inset,
		scale,
		shadowOffset: 22 / diameter,
	};
};
