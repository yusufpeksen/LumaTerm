const {test}=require('node:test');
const assert=require('node:assert/strict');
const {tr,msg,setLanguage}=require('../src/i18n.cjs');
test('English translation never rewrites interpolated file names or credentials',()=>{
  setLanguage('en');
  assert.equal(tr('Ayarlar'),'Settings');
  assert.equal(tr('<button>Bağlantıyı kaydet</button>'),'<button>Save connection</button>');
  assert.equal(msg`<label>Dosya hazır</label>${'Ayarlar / Yeni terminal'}`,'<label>File ready</label>Ayarlar / Yeni terminal');
  setLanguage('tr');assert.equal(tr('Ayarlar'),'Ayarlar');setLanguage('en');
});
