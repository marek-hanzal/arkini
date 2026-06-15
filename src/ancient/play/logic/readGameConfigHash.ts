import { Effect } from "effect";
import { readGameConfigHashFx } from "../fx/readGameConfigHashFx";

export const readGameConfigHash = () => Effect.runSync(readGameConfigHashFx());
