const isTextPart = (part: string | undefined): part is string =>
	part !== undefined && part.length > 0;

export const joinTextParts = (parts: readonly (string | undefined)[], separator = " · ") =>
	parts.filter(isTextPart).join(separator);
