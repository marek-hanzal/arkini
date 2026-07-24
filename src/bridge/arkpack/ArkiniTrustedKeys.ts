import ArkiniTrustedKeysJson from "../../../game/arkini.arkpack.keys.json";

import { ArkpackTrustedKeysSchema } from "~/engine/pack/schema/ArkpackTrustedKeysSchema";

/** Immutable public keys trusted to identify official Arkini-authored packages. */
export const ArkiniTrustedKeys = ArkpackTrustedKeysSchema.parse(ArkiniTrustedKeysJson);
