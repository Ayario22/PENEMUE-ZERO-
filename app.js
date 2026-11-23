const $=s=>document.querySelector(s);
const login=$("#login"),app=$("#app"),logout=$("#logout");
function bubble(role,text){const el=document.createElement("div");el.className="bubble "+role;el.textContent=text;$("#messages").append(el);el.scrollIntoView({behavior:"smooth",block:"end"});}
async function api(url,opts={}){const r=await fetch(url,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Request failed");return d;}
async function boot(){try{const d=await api("/api/me");if(d.authenticated)showApp();else login.classList.remove("hidden");}catch{login.classList.remove("hidden");}}
function showApp(){login.classList.add("hidden");app.classList.remove("hidden");logout.classList.remove("hidden");loadMemories();loadHistory();}
$("#loginForm").onsubmit=async e=>{e.preventDefault();$("#loginError").textContent="";try{await api("/api/login",{method:"POST",body:JSON.stringify({password:$("#password").value})});showApp();}catch(err){$("#loginError").textContent=err.message;}};
logout.onclick=async()=>{await api("/api/logout",{method:"POST"});location.reload();};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".view").forEach(x=>x.classList.toggle("hidden",x.id!==b.dataset.tab));if(b.dataset.tab==="memory")loadMemories();if(b.dataset.tab==="research")loadResearch();if(b.dataset.tab==="settings")loadSettings();});
async function loadHistory(){try{const rows=await api("/api/history");if(rows.length){$("#messages").replaceChildren();rows.forEach(m=>bubble(m.role==="user"?"user":"ai",m.content));}}catch{}}
$("#chatForm").onsubmit=async e=>{e.preventDefault();const message=$("#prompt").value.trim();if(!message)return;$("#prompt").value="";bubble("user",message);const btn=$("#send");btn.disabled=true;btn.textContent="Thinking…";try{const d=await api("/api/chat",{method:"POST",body:JSON.stringify({message})});bubble("ai",d.answer);}catch(err){bubble("ai","Error: "+err.message);}finally{btn.disabled=false;btn.textContent="Send ↗";}};
async function loadMemories(){try{const rows=await api("/api/memories");$("#memoryList").replaceChildren();rows.forEach(m=>{const row=document.createElement("div");row.className="memory";const span=document.createElement("span");span.textContent=m.content;const del=document.createElement("button");del.textContent="Delete";del.onclick=async()=>{await api("/api/memories/"+m.id,{method:"DELETE"});loadMemories();};row.append(span,del);$("#memoryList").append(row);});}catch{}}
$("#memoryForm").onsubmit=async e=>{e.preventDefault();const content=$("#memoryText").value.trim();if(!content)return;try{await api("/api/memories",{method:"POST",body:JSON.stringify({content})});$("#memoryText").value="";loadMemories();}catch(err){alert(err.message);}};
boot();
async function loadResearch(){
 try{
  const jobs=await api("/api/research");const host=$("#researchList");host.replaceChildren();
  jobs.forEach(j=>{
   const card=document.createElement("article");card.className="research-card";
   const title=document.createElement("b");title.textContent=j.question;
   const status=document.createElement("p");status.className="muted";status.textContent="Status: "+j.status+" · "+j.created_at;
   card.append(title,status);
   if(j.result){const result=document.createElement("pre");result.className="result";result.textContent=j.result;card.append(result);}
   if(j.error){const err=document.createElement("p");err.className="muted";err.textContent=j.error;card.append(err);}
   const actions=document.createElement("div");actions.className="actions";
   const run=document.createElement("button");run.textContent=j.status==="completed"?"Run again":"Run research";run.onclick=async()=>{run.disabled=true;run.textContent="Researching…";try{await api("/api/research/"+j.id+"/run",{method:"POST"});loadResearch();}catch(e){alert(e.message);run.disabled=false;run.textContent="Run research";}};
   const del=document.createElement("button");del.className="danger";del.textContent="Delete";del.onclick=async()=>{await api("/api/research/"+j.id,{method:"DELETE"});loadResearch();};
   actions.append(run,del);card.append(actions);host.append(card);
  });
 }catch(e){$("#researchList").textContent=e.message;}
}
$("#researchForm").onsubmit=async e=>{e.preventDefault();const question=$("#researchQuestion").value.trim();if(!question)return;try{await api("/api/research",{method:"POST",body:JSON.stringify({question})});$("#researchQuestion").value="";loadResearch();}catch(err){alert(err.message);}};
async function loadSettings(){try{const d=await api("/api/settings");$("#persona").value=d.persona||"";}catch(e){}}
$("#settingsForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/settings",{method:"PUT",body:JSON.stringify({persona:$("#persona").value})});$("#settingsStatus").textContent="Customization saved.";}catch(err){$("#settingsStatus").textContent=err.message;}};
$("#exportBtn").onclick=()=>{location.href="/api/export";};
$("#importFile").onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const result=await api("/api/import",{method:"POST",body:JSON.stringify(data)});$("#settingsStatus").textContent=`Imported ${result.memoriesImported} memories and ${result.messagesImported} messages.`;}catch(err){$("#settingsStatus").textContent="Import failed: "+err.message;}e.target.value="";};
