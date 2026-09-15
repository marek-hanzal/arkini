export type ByteRange =
	| {
			readonly type: "full";
	  }
	| {
			readonly end: number;
			readonly length: number;
			readonly start: number;
			readonly type: "partial";
	  }
	| {
			readonly type: "invalid";
	  };

const readOffsetFn = (value: string) => {
	if (!/^\d+$/.test(value)) return undefined;
	const offset = Number(value);
	return Number.isSafeInteger(offset) ? offset : undefined;
};

/** Resolves one HTTP byte range against a native file size. */
export const readByteRangeFn = (header: string | null, size: number): ByteRange => {
	if (header === null)
		return {
			type: "full",
		};
	const match = /^bytes=(\d*)-(\d*)$/.exec(header);
	if (match === null || size <= 0)
		return {
			type: "invalid",
		};
	const [, startText = "", endText = ""] = match;
	if (startText === "" && endText === "")
		return {
			type: "invalid",
		};
	if (startText === "") {
		const suffixLength = readOffsetFn(endText);
		if (suffixLength === undefined || suffixLength === 0)
			return {
				type: "invalid",
			};
		const length = Math.min(size, suffixLength);
		return {
			end: size - 1,
			length,
			start: size - length,
			type: "partial",
		};
	}
	const start = readOffsetFn(startText);
	const requestedEnd = endText === "" ? size - 1 : readOffsetFn(endText);
	if (start === undefined || requestedEnd === undefined || start >= size || requestedEnd < start)
		return {
			type: "invalid",
		};
	const end = Math.min(size - 1, requestedEnd);
	return {
		end,
		length: end - start + 1,
		start,
		type: "partial",
	};
};
