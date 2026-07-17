import { Effect } from "effect";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";

export namespace parseInstalledArkpackDescriptorFx {
	export interface Props {
		readonly value: unknown;
		readonly expectedPackageId?: string;
	}
}

/** Validates persisted imported-Arkpack metadata before exposing it to the renderer. */
export const parseInstalledArkpackDescriptorFx = Effect.fn("parseInstalledArkpackDescriptorFx")(
	function* ({ value, expectedPackageId }: parseInstalledArkpackDescriptorFx.Props) {
		if (typeof value !== "object" || value === null) {
			return yield* Effect.fail(new Error("Invalid Arkpack metadata."));
		}
		const descriptor = value as Partial<ArkiniDesktopApi.ArkpackDescriptor>;
		yield* assertImportedArkpackPackageIdFx(descriptor.packageId ?? "");
		if (
			(expectedPackageId !== undefined && descriptor.packageId !== expectedPackageId) ||
			descriptor.contentHash !== descriptor.packageId ||
			typeof descriptor.gameId !== "string" ||
			typeof descriptor.title !== "string" ||
			typeof descriptor.configVersion !== "string" ||
			typeof descriptor.compressedSize !== "number" ||
			descriptor.source !== "imported"
		) {
			return yield* Effect.fail(new Error("Invalid Arkpack metadata."));
		}
		return descriptor as ArkiniDesktopApi.ArkpackDescriptor;
	},
);
