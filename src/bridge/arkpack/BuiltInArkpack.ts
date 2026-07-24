import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";

/** One package binary embedded into the application with declared trust expectations. */
export interface BuiltInArkpack {
	readonly packageId: string;
	readonly url: string;
	readonly signatureUrl?: string;
	readonly descriptor: ArkpackDescriptor & {
		readonly source: "built-in";
	};
}
