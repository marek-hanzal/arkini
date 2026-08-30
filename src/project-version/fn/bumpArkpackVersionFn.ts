import type { EditorProjectCompatibilityResult } from "~/project-version/type/EditorProjectCompatibility";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

const incrementDecimalDigitsFn = (digits: string) => {
	const result = Array.from(digits);
	let carry = 1;
	for (let index = result.length - 1; index >= 0 && carry === 1; index -= 1) {
		const next = digits.charCodeAt(index) - 48 + carry;
		result[index] = String(next % 10);
		carry = next >= 10 ? 1 : 0;
	}
	return `${carry === 1 ? "1" : ""}${result.join("")}`;
};

/** Applies one classified editor commit to its persisted gameplay compatibility version. */
export const bumpArkpackVersionFn = (
	version: ArkpackVersionSchema.Type,
	result: EditorProjectCompatibilityResult,
) => {
	const separator = version.indexOf(".");
	if (separator < 0) return version;
	const major = version.slice(0, separator);
	const minor = version.slice(separator + 1);
	return result === "major"
		? `${incrementDecimalDigitsFn(major)}.0`
		: result === "minor"
			? `${major}.${incrementDecimalDigitsFn(minor)}`
			: version;
};
