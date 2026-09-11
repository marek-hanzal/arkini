/** Checks painter-specific PNG support; the caller still owns full image decode/CRC admission. */
export const readTilePaintingPngSupportFn = (bytes: Uint8Array): boolean => {
	if (bytes.byteLength < 33) return false;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (
		view.getUint32(0) !== 0x89504e47 ||
		view.getUint32(4) !== 0x0d0a1a0a ||
		view.getUint32(8) !== 13 ||
		view.getUint32(12) !== 0x49484452
	)
		return false;
	const width = view.getUint32(16);
	const height = view.getUint32(20);
	if (width < 1 || height < 1 || width > 2048 || height > 2048) return false;
	for (let offset = 8; offset + 12 <= view.byteLength; ) {
		const length = view.getUint32(offset);
		const type = view.getUint32(offset + 4);
		const next = offset + length + 12;
		if (next > view.byteLength || type === 0x6163544c) return false;
		if (type === 0x49454e44) return length === 0;
		offset = next;
	}
	return false;
};
