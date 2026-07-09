export const bytesToArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
	bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
