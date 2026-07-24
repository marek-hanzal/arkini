import { Effect } from "effect";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import { assertImportedArkpackPackageIdFx } from "./assertImportedArkpackPackageIdFx";

export namespace parseInstalledArkpackDescriptorFx {
	export interface Props {
		readonly value: unknown;
		readonly expectedPackageId?: string;
	}
}

const parseTrust = (value: unknown): ArkiniDesktopApi.ArkpackDescriptor["trust"] | undefined => {
	if (value === undefined) {
		return {
			type: "external",
			reason: "unsigned",
		};
	}
	if (typeof value !== "object" || value === null) return undefined;
	const trust = value as Partial<ArkiniDesktopApi.ArkpackDescriptor["trust"]>;
	if (trust.type === "official" && typeof trust.keyId === "string" && trust.keyId.length > 0) {
		return {
			type: "official",
			keyId: trust.keyId,
		};
	}
	if (
		trust.type === "external" &&
		(trust.reason === "unsigned" || trust.reason === "unknown-key")
	) {
		return {
			type: "external",
			reason: trust.reason,
		};
	}
	if (
		trust.type === "invalid" &&
		(trust.reason === "malformed-signature" ||
			trust.reason === "invalid-signature" ||
			trust.reason === "hash-mismatch") &&
		(trust.keyId === undefined || typeof trust.keyId === "string")
	) {
		return {
			type: "invalid",
			reason: trust.reason,
			...(trust.keyId === undefined
				? {}
				: {
						keyId: trust.keyId,
					}),
		};
	}
	return undefined;
};

/** Validates persisted imported-Arkpack metadata before exposing it to the renderer. */
export const parseInstalledArkpackDescriptorFx = Effect.fn("parseInstalledArkpackDescriptorFx")(
	function* ({ value, expectedPackageId }: parseInstalledArkpackDescriptorFx.Props) {
		if (typeof value !== "object" || value === null) {
			return yield* Effect.fail(new Error("Invalid Arkpack metadata."));
		}
		const descriptor = value as Partial<ArkiniDesktopApi.ArkpackDescriptor>;
		const trust = parseTrust(descriptor.trust);
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
			return yield* Effect.fail(new Error("Invalid Arkpack metadata."));
		}
		return {
			...descriptor,
			trust,
		} as ArkiniDesktopApi.ArkpackDescriptor;
	},
);
