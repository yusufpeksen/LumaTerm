// Linux /proc counters are sampled through a separate SSH exec channel.
// The terminal stream and its current command line are never modified.
function parseProc(text){
  if(typeof text!=='string')throw new Error('Invalid remote metrics response.');
  const cpuLine=text.match(/^cpu[ \t]+([\d \t]+)$/m)?.[1];
  const total=Number(text.match(/^MemTotal:\s+(\d+)\s+kB$/m)?.[1]);
  const available=Number(text.match(/^MemAvailable:\s+(\d+)\s+kB$/m)?.[1]);
  const uptime=Number(text.match(/^(\d+(?:\.\d+)?)\s+\d+(?:\.\d+)?\s*$/m)?.[1]);
  if(!cpuLine||!Number.isFinite(total)||!Number.isFinite(available)||!Number.isFinite(uptime)||total<=0)throw new Error('Linux /proc metrics are unavailable.');
  const times=cpuLine.trim().split(/\s+/).map(Number);
  if(times.length<4||times.some(n=>!Number.isFinite(n)))throw new Error('Invalid CPU counters.');
  let rx=0,tx=0;
  for(const line of text.split(/\r?\n/)){
    const match=line.match(/^\s*([^\s:]+):\s*(\d+)\s+(?:\d+\s+){7}(\d+)\s/);
    if(match&&match[1]!=='lo'){rx+=Number(match[2]);tx+=Number(match[3]);}
  }
  return {cpuTotal:times.reduce((a,b)=>a+b,0),cpuIdle:times[3]+(times[4]||0),ram:(total-available)*1024,ramTotal:total*1024,uptime,rx,tx};
}
function calculate(previous,current,intervalMs){
  const total=current.cpuTotal-(previous?.cpuTotal??current.cpuTotal);
  const idle=current.cpuIdle-(previous?.cpuIdle??current.cpuIdle);
  const cpu=total>0?Math.max(0,Math.min(100,100*(1-idle/total))):null;
  const seconds=Math.max(0.001,intervalMs/1000);
  return {cpu,ram:current.ram,ramTotal:current.ramTotal,uptime:current.uptime,rxRate:previous?Math.max(0,(current.rx-previous.rx)/seconds):0,txRate:previous?Math.max(0,(current.tx-previous.tx)/seconds):0};
}
module.exports={parseProc,calculate};
