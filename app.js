let report=null;
const statuses=['通过','失败','未检测','无法判定','检测异常'];
const probeLabels={basic:'基础连接',web:'网页',download:'下载'};
const reasons={'measurement-incomplete':'检测时间用尽或尚未执行','byte-budget':'测速流量预算用尽','insufficient-valid-samples':'有效测速样本不足'};
function latestProbes(node){return [...new Map([...node.probes].filter(p=>!p.probeId.startsWith('ai.')).sort((a,b)=>Date.parse(a.checkedAt)-Date.parse(b.checkedAt)).map(p=>[p.probeId,p])).values()];}
function probeText(p){
  let reason=reasons[p.reasonCode]||p.reasonCode;
  if(p.probeId==='download'&&p.status===3){const samples=p.metrics?.samples||[];const short=samples.filter(s=>!s.Valid&&['complete','sample-too-short'].includes(s.TerminationReason)).length;
    const failed=samples.filter(s=>!s.Valid&&['request-failed','request-timeout','unexpected-status','disconnected'].includes(s.TerminationReason)).length;
    const otherReasons={'short-response':'正文提前结束','byte-budget':'流量预算用尽','window':'测量窗口结束','measurement-cancelled':'检测被取消'};
    const other=Object.entries(otherReasons).map(([key,label])=>{const count=samples.filter(s=>!s.Valid&&s.TerminationReason===key).length;return count?count+' 次'+label:'';}).filter(Boolean);
    reason=(reason?reason+'；':'')+'有效样本 '+(p.metrics?.validSampleCount||0)+'/'+samples.length+(short?'，'+short+' 次传输过短':'')+(failed?'，'+failed+' 次请求失败':'')+(other.length?'，'+other.join('，'):'');}
  return (probeLabels[p.probeId]||p.probeId)+': '+(statuses[p.status]??p.status)+(reason?'（'+reason+'）':'');
}
const element=id=>document.getElementById(id);
function uriAvailable(node){return node.uriAvailable??!(report.issues||[]).some(i=>i.format==='uri'&&(i.node?.value||i.node)===node.id);}
async function load(location){
  element('shadowrocket').href=location+'/v2ray.txt';
  element('uri').href=location+'/v2ray.txt';element('clash').href=location+'/clash.yaml';
  for(const view of ['web','download'])element(view).href=location+'/v2ray-'+view+'.txt';
  try{
    const response=await fetch(location+'/report.json',{cache:'no-store'});if(!response.ok)throw Error('未发布');
    report=await response.json();
    const structured=report.shadowrocketFormat==='clash-proxies-json-v1';
    if(structured){element('shadowrocket').href=location+'/shadowrocket.yaml';for(const view of ['web','download'])element(view).href=location+'/shadowrocket-'+view+'.yaml';}
    const counts=structured?'小火箭 '+report.shadowrocketCount+' / URI '+report.uriCount+' / Clash '+report.clashCount:'小火箭链接 '+report.uriCount+' / Clash '+report.clashCount;
    element('status').textContent=(location==='mainland'?'大陆':'云端')+' · 检测开始 '+new Date(report.measuredAt).toLocaleString()+' · '+(Date.now()>Date.parse(report.expiresAt)?'结果已过期':'结果有效至 '+new Date(report.expiresAt).toLocaleString())+' · '+counts+' 个节点';
    const clashOnly=report.nodes.filter(n=>!uriAvailable(n)).length;
    element('format-coverage').textContent=structured?'小火箭使用结构化节点订阅，保留 HTTPS 等节点的完整参数；URI 通用订阅单独提供。数量表示文件中的节点数，客户端实际导入还取决于版本支持。':'下方列出全部 Clash 节点；'+(clashOnly?clashOnly+' 个仅 Clash，未包含在 URI 订阅中。':'全部已生成 URI 链接。')+'小火箭链接数是文件中的节点数，客户端实际导入数量还取决于协议与格式兼容。';
    element('coverage').textContent='去重候选（含历史收录）'+report.coverage.candidates+' 个 · 基础已测 '+report.coverage.basicTested+' 个（'+(report.coverage.candidates?100*report.coverage.basicTested/report.coverage.candidates:0).toFixed(1)+'%）· 未完成基础检测 '+report.coverage.notRun+' 个 · 复检后合格 '+report.coverage.qualified+' 个';
    if(report.pipeline)element('coverage').textContent+=' · 基础通过 '+report.pipeline.basicPassed+' / 测速达标 '+report.pipeline.downloadPassed+' / 最终收录 '+report.pipeline.finalPassed+' / 未完成 '+report.pipeline.downloadIncomplete;
    const coverage=report.probeCoverage||Object.values(report.nodes.reduce((acc,n)=>{for(const p of latestProbes(n)){const c=acc[p.probeId]??={probeId:p.probeId,passed:0,failed:0,notRun:0,indeterminate:0,error:0};c[['passed','failed','notRun','indeterminate','error'][p.status]]++;}return acc;},{}));
    element('probe-coverage').textContent='已发布节点专项覆盖：'+coverage.filter(c=>c.probeId!=='basic'&&!c.probeId.startsWith('ai.')).map(c=>(probeLabels[c.probeId]||c.probeId)+' 通过 '+c.passed+' / 失败 '+c.failed+' / 未测 '+c.notRun+' / 无法判定 '+c.indeterminate+(c.error?' / 异常 '+c.error:'')).join(' · ');
    element('sources').replaceChildren();for(const source of report.sourceCoverage||[]){const row=document.createElement('p');row.className='details';row.textContent=(source.id==='previous-published'?'上一轮最终收录':source.id)+' · '+({fetched:'下载成功',cached:'使用缓存',retained:'并入本轮复测',failed:'下载失败',timeout:'下载超时'}[source.status]||source.status)+' · 候选 '+source.parsedNodes+' 个 · 解析问题 '+source.issues+' 项';element('sources').append(row);}
    if(!report.sourceCoverage)element('sources').textContent='此旧版报告未记录逐来源统计。';
    element('country').replaceChildren(new Option('全部',''));
    [...new Set(report.nodes.map(n=>n.country||'未知'))].sort().forEach(c=>element('country').add(new Option(c,c)));render();
  }catch{report=null;element('status').textContent='该地点尚无订阅结果';for(const id of ['coverage','probe-coverage','format-coverage','sources','nodes'])element(id).replaceChildren();}
}
function render(){
  if(!report)return;
  let nodes=report.nodes.filter(n=>!element('country').value||(n.country||'未知')===element('country').value);
  if(element('sort').value==='speed')nodes.sort((a,b)=>(b.medianBytesPerSecond||0)-(a.medianBytesPerSecond||0));
  if(element('sort').value==='latency')nodes.sort((a,b)=>(a.medianLatencyMs??Infinity)-(b.medianLatencyMs??Infinity));
  element('nodes').replaceChildren();
  for(const node of nodes){const card=document.createElement('div');card.className='node';const name=document.createElement('strong');name.textContent=node.name;card.append(name);
    const formats=report.shadowrocketFormat==='clash-proxies-json-v1'?(uriAvailable(node)?'小火箭 / URI / Clash':'小火箭 / Clash（未包含在 URI 订阅）'):(uriAvailable(node)?'URI / Clash':'仅 Clash（未包含在 URI 订阅）');
    const details=document.createElement('div');details.className='details';details.textContent=[formats,...latestProbes(node).map(probeText)].join(' · ');card.append(details);element('nodes').append(card);}
}
document.querySelectorAll('[data-location]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.location)));
element('sort').addEventListener('change',render);element('country').addEventListener('change',render);load('mainland');
