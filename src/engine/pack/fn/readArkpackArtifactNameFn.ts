import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

/** Derives the canonical self-contained artifact owned by one package identity. */
export const readArkpackArtifactNameFn = (packageId: string) =>
	`${encodeGameProjectFileStem(packageId)}.arkpack`;
