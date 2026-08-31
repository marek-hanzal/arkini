const encodeUnpairedSurrogateFn = (codeUnit: number) =>
	[
		0xe0 | (codeUnit >> 12),
		0x80 | ((codeUnit >> 6) & 0x3f),
		0x80 | (codeUnit & 0x3f),
	]
		.map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`)
		.join("");

/** Encodes one exact project identity as its collision-safe portable filename segment. */
export const encodeGameProjectFileStemFn = (projectId: string) => {
	let encoded = "";
	let wellFormed = "";
	const flushWellFormedFn = () => {
		encoded += encodeURIComponent(wellFormed);
		wellFormed = "";
	};

	for (let index = 0; index < projectId.length; index += 1) {
		const codeUnit = projectId.charCodeAt(index);
		if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
			const nextCodeUnit = projectId.charCodeAt(index + 1);
			if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
				wellFormed += projectId[index] + projectId[index + 1];
				index += 1;
				continue;
			}
			flushWellFormedFn();
			encoded += encodeUnpairedSurrogateFn(codeUnit);
			continue;
		}
		if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
			flushWellFormedFn();
			encoded += encodeUnpairedSurrogateFn(codeUnit);
			continue;
		}
		wellFormed += projectId[index];
	}
	flushWellFormedFn();

	return encoded.replaceAll(".", "%2E");
};
