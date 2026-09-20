const {test}=require('node:test');const assert=require('node:assert/strict');const {OutputFlow}=require('../src/output-flow.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('startup output is lossless and producer resumes only after parsed acknowledgements',async()=>{
  const result=[];let pauses=0,resumes=0;
  const f=new OutputFlow(s=>result.push(s),()=>pauses++,()=>resumes++,{high:100,low:20});
  f.push('a'.repeat(60));f.push('b'.repeat(60));assert.equal(pauses,1);assert.equal(result.length,0);
  f.attach();assert.equal(result.join(''),'a'.repeat(60)+'b'.repeat(60));f.acknowledge(90);assert.equal(resumes,0);f.acknowledge(30);assert.equal(resumes,1);
  f.push('x');f.push('y');await tick();assert.equal(result.at(-1),'xy');f.acknowledge(2);assert.equal(f.pending,0);f.close();
});
test('interactive data flushes on the next event loop turn without a frame timer',async()=>{
  const result=[];const f=new OutputFlow(s=>result.push(s),()=>{},()=>{});f.attach();f.push('x');await tick();assert.deepEqual(result,['x']);f.close();f.push('ignored');await tick();assert.deepEqual(result,['x']);
});
