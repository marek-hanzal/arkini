import { encodeGameProjectFileStemFn } from "~/game-config/source/encodeGameProjectFileStemFn";

/** Derives the canonical self-contained artifact owned by one package identity. */
export const readArkpackArtifactNameFn = (packageId: string) =>
	`${encodeGameProjectFileStemFn(packageId)}.arkpack`;
