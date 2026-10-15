let report=null;
const statuses=['通过','失败','未检测','无法判定','检测异常'];
const probeLabels={basic:'基础连接',web:'网页',download:'下载','ai.gpt':'GPT','ai.claude':'Claude','ai.gemini':'Gemini'};
const element=id=>document.getElementById(id);
async function load(location){
  element('uri').href=location+'/v2ray.txt';element('clash').href=location+'/clash.yaml';
  for(const view of ['web','ai','download'])element(view).href=location+'/v2ray-'+view+'.txt';
  try{
    const response=await fetch(location+'/report.json',{cache:'no-store'});if(!response.ok)throw Error('未发布');
    report=await response.json();
    element('status').textContent=(location==='mainland'?'大陆':'云端')+' · 检测开始 '+new Date(report.measuredAt).toLocaleString()+' · '+(Date.now()>Date.parse(report.expiresAt)?'已过期':'检测窗口内')+' · '+report.clashCount+' 个节点 · 基础覆盖 '+report.coverage.basicTested+'/'+report.coverage.candidates;
    element('country').replaceChildren(new Option('全部',''));
    [...new Set(report.nodes.map(n=>n.country||'未知'))].sort().forEach(c=>element('country').add(new Option(c,c)));render();
  }catch{report=null;element('status').textContent='该地点尚无订阅结果';element('nodes').replaceChildren();}
}
function render(){
  if(!report)return;
  let nodes=report.nodes.filter(n=>!element('country').value||(n.country||'未知')===element('country').value);
  if(element('sort').value==='speed')nodes.sort((a,b)=>(b.medianBytesPerSecond||0)-(a.medianBytesPerSecond||0));
  if(element('sort').value==='latency')nodes.sort((a,b)=>(a.medianLatencyMs??Infinity)-(b.medianLatencyMs??Infinity));
  element('nodes').replaceChildren();
  for(const node of nodes){const card=document.createElement('div');card.className='node';const name=document.createElement('strong');name.textContent=node.name;card.append(name);
    const details=document.createElement('div');details.className='details';details.textContent=node.probes.map(p=>(probeLabels[p.probeId]||p.probeId)+': '+(statuses[p.status]||p.status)).join(' · ');card.append(details);element('nodes').append(card);}
}
document.querySelectorAll('[data-location]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.location)));
element('sort').addEventListener('change',render);element('country').addEventListener('change',render);load('mainland');
