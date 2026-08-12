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
    .replace(/&amp;/g,"&").replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").trim();
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

async function main(){
  const cutoff=Date.now()-DAYS*86400000;
  const all=(await Promise.all(Q.map(rss))).flatMap(parse);
  const map=new Map();

  for(const n of all){
    if(Date.parse(n.publishedAt)<cutoff)continue;
    if(!/phillies|philadelphia/i.test(n.title))continue;
    if(!map.has(n.link))map.set(n.link,n);
  }

  let news=[...map.values()]
    .sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));

  await fs.mkdir("data",{recursive:true});

  let old=[];
  try{old=JSON.parse(await fs.readFile(OUT,"utf8"))}catch{}

  const oldJa=new Map(old.map(x=>[x.link,x.titleJa]).filter(x=>x[1]));

  const py=`
import json,sys,argostranslate.package,argostranslate.translate

p=argostranslate.package
p.update_package_index()
a=next(x for x in p.get_available_packages() if x.from_code=="en" and x.to_code=="ja")
p.install_from_path(a.download())

en=next(x for x in argostranslate.translate.get_installed_languages() if x.code=="en")
ja=next(x for x in argostranslate.translate.get_installed_languages() if x.code=="ja")
tr=en.get_translation(ja)

data=json.load(open(sys.argv[1],encoding="utf-8"))
for x in data:
    if not x.get("titleJa"):
        try:x["titleJa"]=tr.translate(x["title"])
        except Exception as e:
            print("TRANSLATE:",x["title"],e)
            x["titleJa"]=x["title"]
json.dump(data,open(sys.argv[1],"w",encoding="utf-8"),ensure_ascii=False,indent=2)
`;

  await fs.writeFile(".translate_news.py",py);

  for(const n of news)n.titleJa=oldJa.get(n.link)||null;

  await fs.writeFile(OUT,JSON.stringify(news,null,2));

  execFileSync("python",[".translate_news.py",OUT],{stdio:"inherit"});

  await fs.unlink(".translate_news.py").catch(()=>{});

  console.log(`Saved ${news.length} news`);
}

main().catch(e=>{
  console.error("UPDATE FAILED:",e);
  process.exit(1);
});
