import identity from '../../../../cursadex-version.json';

/** Fork display identity is separate from upstream protocol/plugin identity. */
export const CURSADEX_VERSION = identity.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(CURSADEX_VERSION)) {
  throw new Error('Invalid Cursadex display version');
}
