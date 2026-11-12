import catalogue from '../public/data/apartment-catalogue.json';
const key=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\bgarden\b/g,'gardens').replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'');
const groups=new Map<string,Set<string>>();
for(const b of catalogue.buildings){if(!b.group)continue;for(const name of [b.name,...b.aliases]){const k=key(name);const choices=groups.get(k)||new Set<string>();choices.add(b.group);groups.set(k,choices);}}
/** Presentation only: preserve saved building identity, coordinates and route grouping. */
export function buildingLabel(name?:string):string{
 if(!name)return '';
 const matches=groups.get(key(name));if(!matches||matches.size!==1)return name;
 const group=[...matches][0];return key(name).includes(key(group))?name:name+' · '+group;
}
