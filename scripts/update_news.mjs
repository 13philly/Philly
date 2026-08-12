import fs from"node:fs/promises";
import {execFileSync} from"node:child_process";

const OUT="data/news.json",DAYS=7;
const Q=['"Philadelphia Phillies" when:7d','Phillies MLB when:7d'];

async function rss(q){
  const p=new URLSearchParams({q,hl:"en-US",gl:"US",ceid:"US:en"});
  const r=await fetch(`https://news.google.com/rss/search?${p}`,{
    headers:{"User-Agent":"Mozilla/5.0"}
  });
  if(!r.ok)throw Error(`RSS ${r.status}`);
  return r.text();
}

function get(x,n){
  return x.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`,"i"))?.[1]??"";
}

function clean(x){
  return x.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,"$1")
    .replace(/<[^>]*>/g,"")
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .trim();
}

function parse(xml){
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>{
    const x=m[1],d=Date.parse(get(x,"pubDate"));
    return{
      publishedAt:Number.isNaN(d)?null:new Date(d).toISOString(),
      link:clean(get(x,"link")),
      title:clean(get(x,"title")),
      source:clean(get(x,"source"))
    };
  }).filter(x=>x.publishedAt&&x.link&&x.title&&x.source);
}

function normTitle(s){
  return s
    .toLowerCase()
    .replace(/<[^>]*>/g,"")
    .replace(/\s+/g,"")
    .replace(/[“”"'‘’.,!?;:()[\]{}\-–—]/g,"")
    .replace(/[^a-z0-9]/g,"");
}

function normSource(s){
  return s.toLowerCase()
    .replace(/[^a-z0-9]/g,"");
}

function normUrl(u){
  try{
    const x=new URL(u);
    x.hash="";
    [
      "utm_source","utm_medium","utm_campaign",
      "utm_term","utm_content","gclid","fbclid"
    ].forEach(k=>x.searchParams.delete(k));
    return x.toString().replace(/\/$/,"");
  }catch{
    return u.trim().replace(/\/$/,"");
  }
}

function duplicateKey(x){
  return `${normSource(x.source)}|${normTitle(x.title)}`;
}

async function main(){
  const cutoff=Date.now()-DAYS*86400000;

  const all=(await Promise.all(Q.map(rss)))
    .flatMap(parse)
    .filter(x=>Date.parse(x.publishedAt)>=cutoff)
    .filter(x=>/phillies|philadelphia/i.test(x.title));

  const unique=new Map();

  for(const x of all){
    const urlKey=`url:${normUrl(x.link)}`;
    const titleKey=`title:${duplicateKey(x)}`;

    if(unique.has(urlKey)||unique.has(titleKey))continue;

    unique.set(urlKey,x);
    unique.set(titleKey,x);
  }

  let news=[...new Set(unique.values())]
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));

  let old=[];
  try{
    old=JSON.parse(await fs.readFile(OUT,"utf8"));
  }catch{}

  const oldJa=new Map(
    old
      .filter(x=>x.link&&x.titleJa)
      .map(x=>[`${normSource(x.source)}|${normTitle(x.title)}`,x.titleJa])
  );

  for(const x of news){
    x.titleJa=oldJa.get(duplicateKey(x))||null;
  }

  await fs.mkdir("data",{recursive:true});
  await fs.writeFile(OUT,JSON.stringify(news,null,2));

  const py=`
import json,sys
import argostranslate.package
import argostranslate.translate

p=argostranslate.package
p.update_package_index()
pkg=next(x for x in p.get_available_packages() if x.from_code=="en" and x.to_code=="ja")
p.install_from_path(pkg.download())

langs=argostranslate.translate.get_installed_languages()
en=next(x for x in langs if x.code=="en")
ja=next(x for x in langs if x.code=="ja")
tr=en.get_translation(ja)

with open(sys.argv[1],encoding="utf-8") as f:
    data=json.load(f)

for x in data:
    if not x.get("titleJa"):
        try:
            x["titleJa"]=tr.translate(x["title"])
        except:
            x["titleJa"]=x["title"]

with open(sys.argv[1],"w",encoding="utf-8") as f:
    json.dump(data,f,ensure_ascii=False,indent=2)
`;

  await fs.writeFile(".translate_news.py",py);
  execFileSync("python",[".translate_news.py",OUT],{stdio:"inherit"});
  await fs.unlink(".translate_news.py").catch(()=>{});

  console.log(`Saved ${news.length} unique news`);
}

main().catch(e=>{
  console.error("UPDATE FAILED:",e);
  process.exit(1);
});
