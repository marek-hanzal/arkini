const createOggPageFn = ({
	flags,
	packet,
	sequence,
}: {
	readonly flags: number;
	readonly packet: Uint8Array;
	readonly sequence: number;
}) => {
	const bytes = Buffer.alloc(28 + packet.byteLength);
	bytes.write("OggS", 0, "ascii");
	bytes[5] = flags;
	bytes.writeUInt32LE(1, 14);
	bytes.writeUInt32LE(sequence, 18);
	bytes[26] = 1;
	bytes[27] = packet.byteLength;
	bytes.set(packet, 28);
	let checksum = 0;
	for (const byte of bytes) {
		checksum ^= byte << 24;
		for (let bit = 0; bit < 8; bit += 1)
			checksum =
				(checksum & 0x80000000) === 0
					? (checksum << 1) >>> 0
					: ((checksum << 1) ^ 0x04c11db7) >>> 0;
	}
	bytes.writeUInt32LE(checksum >>> 0, 22);
	return bytes;
};

/** Creates one structurally complete tiny Ogg/Opus stream for filesystem tests. */
export const createTestOggOpusBytesFn = () => {
	const identification = Buffer.alloc(19);
	identification.write("OpusHead", 0, "ascii");
	identification[8] = 1;
	identification[9] = 2;
	const comments = Buffer.alloc(16);
	comments.write("OpusTags", 0, "ascii");
	return Buffer.concat([
		createOggPageFn({
			flags: 0x02,
			packet: identification,
			sequence: 0,
		}),
		createOggPageFn({
			flags: 0,
			packet: comments,
			sequence: 1,
		}),
		createOggPageFn({
			flags: 0x04,
			packet: Uint8Array.of(0xf8),
			sequence: 2,
		}),
	]);
};
