import { ArkpackPublicKeySchema } from "~/engine/pack/schema/ArkpackPublicKeySchema";

declare const __ARKINI_PUBLIC_KEY__: string | undefined;

/** Public trust baked into a built Arkini application and CLI. */
export const ArkiniBuiltPublicKey =
	typeof __ARKINI_PUBLIC_KEY__ === "string"
		? ArkpackPublicKeySchema.parse(__ARKINI_PUBLIC_KEY__)
		: undefined;
