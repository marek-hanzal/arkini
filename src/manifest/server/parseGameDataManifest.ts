import { GameDataManifestSchema } from "./GameDataManifestSchema";

export function parseGameDataManifest(manifest: parseGameDataManifest.Input) {
  return GameDataManifestSchema.parse(manifest);
}

export namespace parseGameDataManifest {
  export type Input = unknown;
}
