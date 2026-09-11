/** Decodes canonical portable filename stems, including encoded lone UTF-16 surrogates. */
export const decodeGameProjectFileStemFn = (stem: string) => {
	// URI decoding rejects the lone-surrogate triplets emitted by the total writer.
	const withLoneSurrogates = stem.replace(
		/%ED%([AB][0-9A-F])%([89AB][0-9A-F])/gu,
		(_match, secondByte: string, thirdByte: string) =>
			String.fromCharCode(
				0xd000 |
					((Number.parseInt(secondByte, 16) & 0x3f) << 6) |
					(Number.parseInt(thirdByte, 16) & 0x3f),
			),
	);
	try {
		return decodeURIComponent(withLoneSurrogates);
	} catch {
		return undefined;
	}
};
