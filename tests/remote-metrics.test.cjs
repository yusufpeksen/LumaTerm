const test=require('node:test');
const assert=require('node:assert/strict');
const {parseProc,calculate}=require('../src/remote-metrics.cjs');

const response=(user,idle,rx,tx)=>`cpu  ${user} 0 20 ${idle} 0 0 0 0 0 0
cpu0 1 0 2 3 0 0 0 0 0 0
MemTotal:        8192000 kB
MemFree:         1000000 kB
MemAvailable:    4096000 kB
Inter-|   Receive | Transmit
 face |bytes packets errs drop fifo frame compressed multicast|bytes packets errs drop fifo colls carrier compressed
    lo: 99 0 0 0 0 0 0 0 99 0 0 0 0 0 0 0
  eth0: ${rx} 5 0 0 0 0 0 0 ${tx} 4 0 0 0 0 0 0
12345.50 123.00
`;

test('parses remote Linux CPU, memory, uptime, and non-loopback traffic',()=>{
  const first=parseProc(response(100,400,1000,2000));
  const next=parseProc(response(130,470,5000,8000));
  assert.equal(first.ram,4096000*1024);
  assert.equal(first.ramTotal,8192000*1024);
  assert.equal(first.uptime,12345.5);
  assert.equal(first.rx,1000);
  assert.equal(first.tx,2000);
  const data=calculate(first,next,2000);
  assert.ok(Math.abs(data.cpu-30)<0.0001);
  assert.equal(data.rxRate,2000);
  assert.equal(data.txRate,3000);
});

test('does not claim remote metrics when proc data is missing',()=>{
  assert.throws(()=>parseProc('not a Linux proc response'));
  assert.equal(calculate(null,parseProc(response(100,400,1000,2000)),1000).cpu,null);
});
