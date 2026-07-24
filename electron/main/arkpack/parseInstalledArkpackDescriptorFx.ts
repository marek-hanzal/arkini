import { Effect } from "effect";
import type { ArkiniElectronApi } from "../../contract/ArkiniElectronApi";
import { ElectronMainError } from "../ElectronMainError";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";
import { parseArkpackTrustFx } from "./parseArkpackTrustFx";

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
			return yield* Effect.fail(
				new ElectronMainError({
					operation: "parse installed Arkpack descriptor",
					cause: value,
				}),
			);
		}
		const descriptor = value as Partial<ArkiniElectronApi.ArkpackDescriptor>;
		const trust = yield* parseArkpackTrustFx({
			value: descriptor.trust,
		});
		yield* assertImportedArkpackPackageIdFx(descriptor.packageId ?? "");
		if (
			(expectedPackageId !== undefined && descriptor.packageId !== expectedPackageId) ||
			descriptor.contentHash !== descriptor.packageId ||
			typeof descriptor.gameId !== "string" ||
			typeof descriptor.title !== "string" ||
			typeof descriptor.configVersion !== "string" ||
			typeof descriptor.compressedSize !== "number" ||
			trust === undefined ||
			descriptor.source !== "imported"
		) {
			return yield* Effect.fail(
				new ElectronMainError({
					operation: "parse installed Arkpack descriptor",
					cause: value,
				}),
			);
		}
		return {
			...descriptor,
			// Imported storage contains no detached signature, so persisted trust is never proof.
			trust: {
				type: "external",
				reason: "unsigned",
			},
		} as ArkiniElectronApi.ArkpackDescriptor;
	},
);
