import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const identity=JSON.parse(readFileSync(resolve(root,'cursadex-version.json'),'utf8'));
const upstream=JSON.parse(readFileSync(resolve(root,'packages/explorer-ui/package.json'),'utf8')).version;
const semver=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
if(identity.schemaVersion!==1||typeof identity.version!=='string'||!semver.test(identity.version)||identity.upstreamVersion!==upstream){
 throw Error('Invalid Cursadex version or mismatched upstream UI identity');
}
console.log(`Cursadex ${identity.version}; upstream ${upstream}`);
