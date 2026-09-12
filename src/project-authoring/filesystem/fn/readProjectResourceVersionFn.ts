export namespace readProjectResourceVersionFn {
	export interface Props {
		readonly size: number;
		readonly dev: number;
		readonly ino: number;
		readonly mtimeMs: number;
		readonly birthtimeMs: number;
	}
}

/** File metadata invalidates renderer URLs without reading or hashing PNG contents. */
export const readProjectResourceVersionFn = ({
	size,
	dev,
	ino,
	mtimeMs,
	birthtimeMs,
}: readProjectResourceVersionFn.Props): string => `${size}:${mtimeMs}:${birthtimeMs}:${dev}:${ino}`;
