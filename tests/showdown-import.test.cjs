const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parse}=require('../static/showdown-import.js');
const set=`Sparky (Pikachu) (F) @ Light Ball
Ability: Static
Level: 50
Tera Type: Electric
EVs: 252 SpA / 4 SpD / 252 Spe
IVs: 0 Atk
Timid Nature
- Thunderbolt
- Volt Switch`;
test('imports a complete Showdown export with nicknames, heading and Windows newlines',()=>{
 const result=parse(('=== [gen9ou] Team ===\n\n'+set).replaceAll('\n','\r\n'));
 assert.equal(result.count,1);assert.deepEqual(result.warnings,[]);
 assert.deepEqual(result.team[0],{species:'Pikachu',nickname:'Sparky',gender:'F',item:'Light Ball',ability:'Static',level:50,tera_type:'Electric',nature:'Timid',evs:{spa:252,spd:4,spe:252},ivs:{atk:0},moves:['Thunderbolt','Volt Switch']});
});
test('imports six members without network or model calls',()=>{
 assert.equal(parse(Array(6).fill(set).join('\n\n')).count,6);
});
test('imports standalone gender fields without unsupported-line warnings',()=>{
 for(const gender of ['F','M','N']) {
  const result=parse(set.replace(' (F) @',' @').replace('Ability: Static',`Ability: Static\nGender: ${gender}`));
  assert.equal(result.team[0].gender,gender);assert.deepEqual(result.warnings,[]);
 }
 for(const text of ['Pikachu\nGender: X','Pikachu\nGender:','Pikachu\nGender: F\nGender: M','Pikachu (F)\nGender: M']) assert(parse(text).error,text);
});
test('warns about missing fields and unknown lines',()=>{
 const result=parse('Pikachu\nAbilty: Static\n- Thunderbolt');
 assert(result.warnings.some(w=>w.includes('unrecognized')));
 assert(result.warnings.some(w=>w.includes('no ability')));
});
test('rejects malformed or out of range sets and multi-team backups',()=>{
 for(const text of ['', 'Ability: Static', 'Pikachu\nLevel: 101','Pikachu\nLevel: nope','Pikachu\nLevel: 0','Pikachu\nEVs: 253 Atk','Pikachu\nEVs: 252 Atk / 252 Spe / 252 HP','Pikachu\nIVs: 32 HP','Pikachu\nEVs: 252 Atk / 4 Atk','Pikachu\nAbility: Static\nAbility: Static','Pikachu\n- A\n- B\n- C\n- D\n- E','Pikachu\n- A\n- A','Pikachu\nAbility:',Array(7).fill('Pikachu').join('\n\n'),'Pikachu\n\n=== [gen9ou] Other ===\nPikachu','a'.repeat(12001)]) assert(parse(text).error,text);
});
