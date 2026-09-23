import { open, stat } from "node:fs/promises";
import { Effect } from "effect";

const HeaderBytes = 256 * 1024;
const OggCapturePattern = Buffer.from("OggS", "ascii");
const OpusIdentification = Buffer.from("OpusHead", "ascii");
const OpusComments = Buffer.from("OpusTags", "ascii");
const OggCrcPolynomial = 0x04c11db7;

const startsWithFn = (source: Buffer, expected: Buffer, offset = 0) =>
	source.subarray(offset, offset + expected.length).equals(expected);

const readOggCrcFn = (source: Buffer, start: number, end: number) => {
	let checksum = 0;
	for (let offset = start; offset < end; offset += 1) {
		const byte = offset >= start + 22 && offset < start + 26 ? 0 : source[offset]!;
		checksum ^= byte << 24;
		for (let bit = 0; bit < 8; bit += 1)
			checksum =
				(checksum & 0x80000000) === 0
					? (checksum << 1) >>> 0
					: ((checksum << 1) ^ OggCrcPolynomial) >>> 0;
	}
	return checksum >>> 0;
};

const hasCompleteOpusHeadersFn = (source: Buffer) => {
	let offset = 0;
	let packetIndex = 0;
	let packetLength = 0;
	let packetPrefix = Buffer.alloc(8);
	let packetPrefixLength = 0;
	while (offset + 27 <= source.length) {
		if (
			!startsWithFn(source, OggCapturePattern, offset) ||
			source[offset + 4] !== 0 ||
			(offset === 0 && (source[offset + 5]! & 0x02) === 0)
		)
			return false;
		const segmentCount = source[offset + 26]!;
		const segmentTableOffset = offset + 27;
		const bodyOffset = segmentTableOffset + segmentCount;
		if (bodyOffset > source.length) return false;
		let bodyLength = 0;
		for (let index = 0; index < segmentCount; index += 1)
			bodyLength += source[segmentTableOffset + index]!;
		const pageEnd = bodyOffset + bodyLength;
		if (
			pageEnd > source.length ||
			source.readUInt32LE(offset + 22) !== readOggCrcFn(source, offset, pageEnd)
		)
			return false;
		let bodyCursor = bodyOffset;
		for (let index = 0; index < segmentCount; index += 1) {
			const segmentLength = source[segmentTableOffset + index]!;
			if (bodyCursor + segmentLength > source.length) return false;
			const prefixBytes = Math.min(8 - packetPrefixLength, segmentLength);
			if (prefixBytes > 0) {
				source.copy(packetPrefix, packetPrefixLength, bodyCursor, bodyCursor + prefixBytes);
				packetPrefixLength += prefixBytes;
			}
			packetLength += segmentLength;
			bodyCursor += segmentLength;
			if (segmentLength === 255) continue;
			if (
				(packetIndex === 0 &&
					(packetLength < 19 || !packetPrefix.equals(OpusIdentification))) ||
				(packetIndex === 1 && (packetLength < 16 || !packetPrefix.equals(OpusComments)))
			)
				return false;
			if (packetIndex >= 2) return packetLength > 0;
			packetIndex += 1;
			packetLength = 0;
			packetPrefix = Buffer.alloc(8);
			packetPrefixLength = 0;
		}
		offset = bodyCursor;
	}
	return false;
};

/** Validates bounded Ogg/Opus headers and the presence of one audio packet. */
export const validateOggOpusFileFx = Effect.fn("validateOggOpusFileFx")(
	(path: string, resourceUid: string) =>
		Effect.tryPromise({
			try: async () => {
				const info = await stat(path);
				if (!info.isFile() || info.size < 1)
					throw new Error(`Audio ${resourceUid} must be a valid Ogg/Opus file.`);
				const file = await open(path, "r");
				try {
					const header = Buffer.alloc(Math.min(HeaderBytes, info.size));
					const { bytesRead } = await file.read(header, 0, header.length, 0);
					if (!hasCompleteOpusHeadersFn(header.subarray(0, bytesRead)))
						throw new Error(`Audio ${resourceUid} must be a valid Ogg/Opus file.`);
					return Number(info.size);
				} finally {
					await file.close();
				}
			},
			catch: (cause) =>
				cause instanceof Error && cause.message.startsWith(`Audio ${resourceUid}`)
					? cause
					: new Error(`Audio ${resourceUid} must decode as a valid Ogg/Opus file.`, {
							cause,
						}),
		}),
);
