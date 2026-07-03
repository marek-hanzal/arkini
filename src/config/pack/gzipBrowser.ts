import { bytesToArrayBuffer } from "~/config/pack/bytesToArrayBuffer";
export const decompressGzipBytes = async (bytes: Uint8Array): Promise<Uint8Array> => {
	if (!("DecompressionStream" in globalThis)) {
		throw new Error("This browser does not support DecompressionStream for Arkini packs.");
	}

	const stream = new Blob([
		bytesToArrayBuffer(bytes),
	])
		.stream()
		.pipeThrough(new DecompressionStream("gzip"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
};
