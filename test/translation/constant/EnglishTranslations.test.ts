import { describe, expect, it } from "vitest";

import { StorageSchema } from "~/item-definition/schema/StorageSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { translator } from "~/translation/constant/translator";

const expectTranslatedFn = (key: string) => {
	expect(translator.valueFn(key), key).toMatchObject({
		type: "translation",
	});
};

describe("EnglishTranslations", () => {
	it("covers every runtime-computed item type and storage key", () => {
		for (const type of TypeSchema.options) {
			expectTranslatedFn(`Item type - ${type}`);
			expectTranslatedFn(`Item type description - ${type}`);
		}
		expectTranslatedFn("Item type - missing");
		for (const scope of StorageSchema.options) {
			expectTranslatedFn(`Item storage scope - ${scope}`);
		}
	});
});
