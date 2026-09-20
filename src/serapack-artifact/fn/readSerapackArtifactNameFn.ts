import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";

/** Derives the canonical self-contained artifact owned by one package identity. */
export const readSerapackArtifactNameFn = (packageId: string) =>
	`${encodeGameProjectFileStemFn(packageId)}.serapack`;
