const fs=require('node:fs');
const acorn=require('acorn');
const {tr,setLanguage}=require('../src/i18n.cjs');
setLanguage('en');
let missing=0;
for(const file of ['renderer.js','main.cjs','sessions.cjs','files.cjs','store.cjs','core.cjs']){
  const source=fs.readFileSync('src/'+file,'utf8');
  const tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:file.endsWith('.js')?'module':'script'});
  function check(value){const translated=tr(value).replaceAll('Türkçe','');if(/[ıİğĞşŞçÇöÖüÜ]/.test(translated)){console.error(file,translated);missing++;}}
  function walk(node){if(!node||typeof node!=='object')return;if(node.type==='Literal'&&typeof node.value==='string')check(node.value);if(node.type==='TemplateElement')check(node.value.cooked);for(const v of Object.values(node)){if(Array.isArray(v))v.forEach(x=>{if(x?.type)walk(x);});else if(v?.type)walk(v);}}
  walk(tree);
}
if(missing)process.exitCode=1;else console.log('Localization coverage: no untranslated Turkish UI text.');
