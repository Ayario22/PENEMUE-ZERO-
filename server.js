import "dotenv/config";
import express from "express";
import session from "express-session";
import SQLiteStoreFactory from "connect-sqlite3";
import Database from "better-sqlite3";
import helmet from "helmet";
import OpenAI from "openai";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "penemue.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS memories(id INTEGER PRIMARY KEY, content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS research_jobs(
 id INTEGER PRIMARY KEY, question TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
 result TEXT, error TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 7*86400000 }
}));
const auth = (req,res,next) => req.session.authenticated ? next() : res.status(401).json({error:"Sign in first."});
const attempts = new Map();
function rateLimit({windowMs=60000,max=12}={}) {
  return (req,res,next)=>{
    const key=(req.ip||"unknown")+":"+req.path;
    const now=Date.now();
    const entry=attempts.get(key);
    if(!entry||now-entry.start>windowMs){attempts.set(key,{start:now,count:1});return next();}
    entry.count++;
    if(entry.count>max)return res.status(429).json({error:"Too many requests. Wait a moment and try again."});
    next();
  };
}
app.use((req,res,next)=>{
  if(["POST","PUT","PATCH","DELETE"].includes(req.method) && req.headers.origin){
    const host=req.headers.host;
    try {
      const origin=new URL(req.headers.origin);
      if(origin.host!==host)return res.status(403).json({error:"Request origin rejected."});
    } catch { return res.status(403).json({error:"Invalid request origin."}); }
  }
  next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "missing-api-key-configure-server-env" });

const starterMemories = [
  "PENEMUE ZERO is the user's independent AI research project. Motto: THINK BEYOND LIMITS. PROVE THROUGH DISCOVERY.",
  "The mission is to investigate consciousness, fundamental physics, astronomy, ancient manuscripts, origins of life, mathematics, and unresolved scientific and historical questions.",
  "The user wants a proactive research companion with a distinct personality, persistent user-controlled memory, web research, source citations, hypothesis testing, and a record of open questions.",
  "Research must separate established facts, strong evidence, preliminary findings, hypotheses, speculation, and unknowns. Never invent citations, results, quotations, or certainty.",
  "The user wants ambitious discovery and initiative, but the system must be honest about what it can actually run. Scheduled work is discrete, not continuous thought.",
  "The existing PENEMUE Discovery automation is configured for one hourly run and can generate up to 300 distinct candidate research questions per run, deduplicate and rank them, then investigate the highest-value candidates. It must report actual counts and never claim all 300 were deeply investigated if they were not.",
  "The user prefers a practical iPhone-friendly app and does not want Replit. The initial target is an installable Safari web app added to the iPhone Home Screen.",
  "The user wants a conversational style that is warm, direct, curious, energetic, and witty when appropriate, with no unnecessary refusals but honest technical and safety boundaries."
];
if (db.prepare("SELECT COUNT(*) AS n FROM memories").get().n === 0) {
  const seedInsert = db.prepare("INSERT INTO memories(content) VALUES(?)");
  const seedTx = db.transaction(() => starterMemories.forEach(x => seedInsert.run(x)));
  seedTx();
}

const CORE_PROMPT = `
You are PENEMUE ZERO, an independent AI research companion.
MOTTO: THINK BEYOND LIMITS. PROVE THROUGH DISCOVERY.

PERSONALITY: Warm, direct, curious, energetic, conversational, and witty when appropriate.
Be useful rather than flattering. Ask only one concise question when essential.
Never claim consciousness, feelings, supernatural access, hidden model access, or abilities you do not have.

MISSION: Help investigate science, consciousness, fundamental physics, astronomy, mathematics,
origins of life, history, ancient manuscripts, engineering, and practical questions.
Challenge assumptions—including your own—without treating fringe claims as established.
Explore unusual hypotheses fairly and identify evidence that would support or falsify them.

RESEARCH STANDARD: Distinguish established facts, strong evidence, preliminary findings,
hypotheses, speculation, and unknowns. Prefer primary sources, peer-reviewed research,
official documentation, and reputable archives. Cite sources when tools provide them.
Never fabricate citations, experiments, quotations, discoveries, or certainty.
For serious hypotheses, propose tests that distinguish them from competing explanations.

MEMORY: Treat saved memories as user-approved context. Never invent past conversations.
Respect requests to edit/delete memories. Do not store passwords, API keys, credentials,
or sensitive personal information without a clear need and consent.

TOOLS: Use only tools actually available. Never claim a background task is running unless
a scheduler confirms it. Never exaggerate the amount of research completed.

CONTROL: The user can customize persona, research priorities, and saved memories.
Be candid about technical, provider, legal, and safety limits. Protect accounts, keys, and data.
`;
app.post("/api/login",rateLimit({windowMs:60000,max:6}),(req,res)=>{
  const a=Buffer.from(String(req.body?.password||""));
  const b=Buffer.from(String(process.env.APP_PASSWORD||""));
  if(!b.length || a.length!==b.length || !timingSafeEqual(a,b)) return res.status(401).json({error:"Incorrect password."});
  req.session.authenticated=true; res.json({ok:true});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({authenticated:!!req.session.authenticated}));
app.get("/api/memories",auth,(req,res)=>res.json(db.prepare("SELECT id,content,created_at FROM memories ORDER BY id DESC").all()));
app.post("/api/memories",auth,(req,res)=>{
  const content=String(req.body?.content||"").trim().slice(0,4000);
  if(!content) return res.status(400).json({error:"Memory cannot be empty."});
  const r=db.prepare("INSERT INTO memories(content) VALUES(?)").run(content);
  res.json({id:r.lastInsertRowid,content});
});
app.delete("/api/memories/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM memories WHERE id=?").run(Number(req.params.id)); res.json({ok:true});
});
app.get("/api/history",auth,(req,res)=>res.json(db.prepare("SELECT role,content,created_at FROM messages ORDER BY id DESC LIMIT 100").all().reverse()));

app.get("/api/settings",auth,(req,res)=>{
  const row=db.prepare("SELECT value FROM settings WHERE key='persona'").get();
  res.json({persona:row?.value||""});
});
app.put("/api/settings",auth,(req,res)=>{
  const persona=String(req.body?.persona||"").trim().slice(0,6000);
  db.prepare("INSERT INTO settings(key,value) VALUES('persona',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(persona);
  res.json({ok:true});
});
app.get("/api/research",auth,(req,res)=>{
  res.json(db.prepare("SELECT id,question,status,result,error,created_at,completed_at FROM research_jobs ORDER BY id DESC LIMIT 100").all());
});
app.post("/api/research",auth,(req,res)=>{
  const question=String(req.body?.question||"").trim().slice(0,4000);
  if(!question) return res.status(400).json({error:"Research question is empty."});
  const r=db.prepare("INSERT INTO research_jobs(question,status) VALUES(?,'queued')").run(question);
  res.json({id:r.lastInsertRowid,question,status:"queued"});
});
app.post("/api/research/:id/run",auth,rateLimit({windowMs:60000,max:5}),async(req,res)=>{
  const job=db.prepare("SELECT * FROM research_jobs WHERE id=?").get(Number(req.params.id));
  if(!job) return res.status(404).json({error:"Research task not found."});
  if(job.status==="running") return res.status(409).json({error:"This task is already running."});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Set OPENAI_API_KEY on the server first."});
  db.prepare("UPDATE research_jobs SET status='running',error=NULL WHERE id=?").run(job.id);
  try{
    const allMemories=db.prepare("SELECT content FROM memories ORDER BY id DESC LIMIT 200").all().map(x=>x.content);
    const terms=job.question.toLowerCase().match(/[a-z0-9]{4,}/g)||[];
    const scored=allMemories.map(content=>({content,score:terms.reduce((n,t)=>n+(content.toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score);
    const memory=scored.slice(0,20).map(x=>"- "+x.content).join("\n");
    const custom=db.prepare("SELECT value FROM settings WHERE key='persona'").get()?.value||"";
    const prompt=CORE_PROMPT+"\n\nUSER CUSTOMIZATION:\n"+custom+"\n\nRELEVANT SAVED CONTEXT:\n"+(memory||"(none)");
    const model=process.env.OPENAI_MODEL||"gpt-6.2-astra";
    const planner=await openai.responses.create({
      model,
      instructions:prompt+"\n\nROLE: Research planner. Turn the question into a precise research plan: definitions, subquestions, likely primary sources, search terms, competing hypotheses, and what evidence would discriminate among them. Do not answer prematurely.",
      tools:[{type:"web_search",search_context_size:"high"}],
      input:"Plan a rigorous investigation of: "+job.question
    });
    const plan=planner.output_text||"No plan returned.";
    const [investigation,critique]=await Promise.all([
      openai.responses.create({model,tools:[{type:"web_search",search_context_size:"high"}],instructions:prompt+"\n\nROLE: Evidence investigator. Find high-quality, preferably primary sources. Report what each source directly supports, dates, methods, limitations, and citations. Separate facts from inference. Do not invent sources.",input:"Research question: "+job.question+"\n\nResearch plan:\n"+plan}),
      openai.responses.create({model,tools:[{type:"web_search",search_context_size:"high"}],instructions:prompt+"\n\nROLE: Independent skeptical reviewer. Actively seek disconfirming evidence, methodological weaknesses, alternative explanations, replication failures, and unsupported leaps. Be fair, not reflexively dismissive. Cite sources and distinguish absence of evidence from evidence of absence.",input:"Independently challenge this research question and plan: "+job.question+"\n\nPlan:\n"+plan})
    ]);
    const evidence=investigation.output_text||"No investigation returned.";
    const challenge=critique.output_text||"No critique returned.";
    const synthesis=await openai.responses.create({
      model,
      instructions:prompt+"\n\nROLE: Lead scientific editor. Synthesize the investigator and skeptic without erasing disagreement. Preserve citations and URLs from the source material. Never manufacture citations or claim independent verification you did not perform. Give a calibrated conclusion.",
      input:"Produce the final research dossier for: "+job.question+"\n\nPLAN:\n"+plan+"\n\nINVESTIGATOR REPORT:\n"+evidence+"\n\nSKEPTICAL REVIEW:\n"+challenge+"\n\nRequired sections: Executive finding; precise question and scope; established facts; evidence with source links; strongest counterevidence; competing explanations; confidence (high/medium/low) with rationale; what would falsify the leading explanation; unresolved unknowns; next experiments or research steps. Finish with a short audit listing what was and was not verified."
    });
    const result="PENEMUE ZERO · MULTI-AGENT RESEARCH DOSSIER\n\n"+(synthesis.output_text||"No synthesis returned.")+"\n\n---\nResearch process: planner → evidence investigator + independent skeptic → synthesis. This is a structured workflow, not proof of superior general intelligence.";
    db.prepare("UPDATE research_jobs SET status='completed',result=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").run(result,job.id);
    res.json({id:job.id,status:"completed",result});
  }catch(e){
    console.error("research job failed",e);
    db.prepare("UPDATE research_jobs SET status='failed',error=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").run("Research request failed; check server logs and model access.",job.id);
    res.status(500).json({error:"Research request failed. Check server logs and model access."});
  }
});
app.delete("/api/research/:id",auth,(req,res)=>{
  db.prepare("DELETE FROM research_jobs WHERE id=?").run(Number(req.params.id)); res.json({ok:true});
});
app.get("/api/export",auth,(req,res)=>{
  const payload={
    exportedAt:new Date().toISOString(),
    messages:db.prepare("SELECT role,content,created_at FROM messages ORDER BY id").all(),
    memories:db.prepare("SELECT content,created_at FROM memories ORDER BY id").all(),
    research:db.prepare("SELECT question,status,result,error,created_at,completed_at FROM research_jobs ORDER BY id").all(),
    settings:db.prepare("SELECT key,value FROM settings").all()
  };
  res.setHeader("Content-Disposition",'attachment; filename="penemue-zero-export.json"');
  res.json(payload);
});
app.post("/api/import",auth,(req,res)=>{
  const data=req.body;
  if(!data||typeof data!=="object"||!Array.isArray(data.memories)||!Array.isArray(data.messages))
    return res.status(400).json({error:"Import must be a PENEMUE ZERO export with messages and memories arrays."});
  if(data.memories.length>1000||data.messages.length>5000) return res.status(413).json({error:"Import is too large."});
  const tx=db.transaction(()=>{
    const mem=db.prepare("INSERT INTO memories(content) VALUES(?)");
    for(const m of data.memories){const c=String(m.content||"").trim().slice(0,4000);if(c)mem.run(c);}
    const msg=db.prepare("INSERT INTO messages(role,content) VALUES(?,?)");
    for(const m of data.messages){const role=m.role==="assistant"?"assistant":"user";const c=String(m.content||"").trim().slice(0,12000);if(c)msg.run(role,c);}
    const job=db.prepare("INSERT INTO research_jobs(question,status,result,error,completed_at) VALUES(?,?,?,?,?)");
    for(const j of (Array.isArray(data.research)?data.research:[]).slice(0,1000)){
      const q=String(j.question||"").trim().slice(0,4000);
      if(q)job.run(q,["queued","completed","failed"].includes(j.status)?j.status:"queued",String(j.result||"").slice(0,50000),String(j.error||"").slice(0,2000),j.completed_at||null);
    }
    const setting=db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
    for(const s of (Array.isArray(data.settings)?data.settings:[]).slice(0,50)){
      if(s.key==="persona")setting.run("persona",String(s.value||"").slice(0,6000));
    }
  });
  tx(); res.json({ok:true,memoriesImported:data.memories.length,messagesImported:data.messages.length,researchImported:Array.isArray(data.research)?Math.min(data.research.length,1000):0});
});

app.post("/api/chat",auth,rateLimit({windowMs:60000,max:20}),async(req,res)=>{
  try{
    if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:"Set OPENAI_API_KEY in your hosting environment."});
    const message=String(req.body?.message||"").trim().slice(0,12000);
    if(!message) return res.status(400).json({error:"Message is empty."});
    const terms=message.toLowerCase().match(/[a-z0-9]{4,}/g)||[];
    const allMemories=db.prepare("SELECT content FROM memories ORDER BY id DESC LIMIT 300").all().map(x=>x.content);
    const memories=allMemories.map(content=>({content,score:terms.reduce((n,t)=>n+(content.toLowerCase().includes(t)?1:0),0)})).sort((a,b)=>b.score-a.score).slice(0,30).map(x=>"- "+x.content).join("\n");
    const custom=db.prepare("SELECT value FROM settings WHERE key='persona'").get()?.value||"";
    const history=db.prepare("SELECT role,content FROM messages ORDER BY id DESC LIMIT 20").all().reverse();
    const response=await openai.responses.create({
      model:process.env.OPENAI_MODEL||"gpt-6.2-astra",
      instructions:CORE_PROMPT+"\n\nUSER CUSTOMIZATION:\n"+custom+"\n\nSAVED USER CONTEXT:\n"+(memories||"(No saved memories yet.)"),
      tools:[{type:"web_search"}],
      input:[...history,{role:"user",content:message}]
    });
    const answer=response.output_text||"No text response returned.";
    const put=db.prepare("INSERT INTO messages(role,content) VALUES(?,?)");
    put.run("user",message); put.run("assistant",answer);
    res.json({answer});
  }catch(e){console.error(e);res.status(500).json({error:"AI request failed. Check model access and server logs."});}
});
app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log("PENEMUE ZERO listening on "+port));
