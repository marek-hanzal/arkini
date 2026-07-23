/**
 * Shared presentation clock for producer anticipation and output release.
 * Runtime publication stays immediate; only the already-published actor motion waits.
 */
export const tileProducerEmissionReleaseDelay = 0.12;
