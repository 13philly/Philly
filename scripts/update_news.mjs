import fs from"node:fs/promises";

const OUT="data/news.json";
const DAYS=7;
const CUTOFF=Date.now()-DAYS*86400000;

const FEEDS=[
  ["Phillies Nation","https://philliesnation.com/feed/"],
  ["ESPN","https://www.espn.com/espn/rss/mlb/news"],
  ["Google News","https://news.google.com/rss/search?q=Philadelphia+Phillies+when%3A7d&hl=en-US&gl=US&ceid=US%3Aen"]
];

async function get(url){
  const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0"}});
  if(!r.ok)throw Error(`${r.status} ${url}`);
  return r.text();
}

function clean(s=""){
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi,"$1")
    .replace(/<[^>]*>/g,"")
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .trim();
}

function tag(x,n){
  return clean(
    x.match(
      new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`,"i")
    )?.[1]||""
  );
}

function parseRSS(xml,source){
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .map(m=>{
      const x=m[1];
      const d=Date.parse(
        tag(x,"pubDate")||
        tag(x,"published")||
        tag(x,"updated")
      );

      return{
        publishedAt:Number.isNaN(d)?null:new Date(d).toISOString(),
        link:tag(x,"link"),
        title:tag(x,"title"),
        source:tag(x,"source")||source
      };
    })
    .filter(x=>x.link&&x.title);
}

function extractJSONDate(html,name){
  const a=html.match(
    new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`,"i")
  );

  if(a){
    const d=Date.parse(a[1]);
    if(!Number.isNaN(d))return new Date(d).toISOString();
  }

  return null;
}

async function articleDate(url){
  try{
    const html=await get(url);

    return(
      extractJSONDate(html,"datePublished")||
      extractJSONDate(html,"dateCreated")||
      extractJSONDate(html,"uploadDate")
    );
  }catch(e){
    console.error("ARTICLE DATE:",url,e.message);
    return null;
  }
}

async function mlb(){
  const html=await get("https://www.mlb.com/phillies/news");
  const out=[];
  const seen=new Set();

  for(const m of html.matchAll(
    /<a[^>]+href="([^"]*\/news\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  )){
    const title=clean(m[2]);

    if(title.length<10)continue;

    const link=m[1].startsWith("http")
      ?m[1]
      :`https://www.mlb.com${m[1]}`;

    if(seen.has(link))continue;
    seen.add(link);

    out.push({
      publishedAt:null,
      link,
      title,
      source:"MLB.com"
    });
  }

  return out;
}

function urlKey(url){
  try{
    const u=new URL(url);
    u.hash="";

    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid"
    ].forEach(x=>u.searchParams.delete(x));

    return u.toString()
      .replace(/\/$/,"")
      .toLowerCase();
  }catch{
    return url
      .toLowerCase()
      .trim()
      .replace(/\/$/,"");
  }
}

function titleKey(title){
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"")
    .replace(/philadelphia|phillies|mlb/g,"");
}

function similarity(a,b){
  const A=new Set(a.match(/.{1,3}/g)||[]);
  const B=new Set(b.match(/.{1,3}/g)||[]);

  let n=0;

  for(const x of A)
    if(B.has(x))n++;

  return n/Math.max(A.size,B.size,1);
}

async function main(){
  const results=[];

  try{
    results.push(...await mlb());
  }catch(e){
    console.error("MLB:",e.message);
  }

  for(const [source,url] of FEEDS){
    try{
      results.push(
        ...parseRSS(
          await get(url),
          source
        )
      );
    }catch(e){
      console.error(`${source}:`,e.message);
    }
  }

  const mlbArticles=results.filter(
    x=>x.source==="MLB.com"&&!x.publishedAt
  );

  for(const x of mlbArticles){
    x.publishedAt=await articleDate(x.link);
  }

  const news=[];
  const urls=new Set();
  const titles=[];


  for(const x of results){
    if(!x.publishedAt)continue;

    const date=Date.parse(x.publishedAt);

    if(Number.isNaN(date)||date<CUTOFF)continue;

    if(!/phillies|philadelphia/i.test(x.title))continue;

    const u=urlKey(x.link);
    const t=titleKey(x.title);

    if(urls.has(u))continue;

    let duplicate=false;

    for(const y of titles){
      if(similarity(t,y.title)>=.92){
        duplicate=true;
        break;
      }
    }

    if(duplicate)continue;

    urls.add(u);
    titles.push({
      title:t,
      source:x.source
    });

    news.push({
      publishedAt:x.publishedAt,
      link:x.link,
      title:x.title,
      source:x.source
    });
  }

  news.sort(
    (a,b)=>
      Date.parse(b.publishedAt)-
      Date.parse(a.publishedAt)
  );

  await fs.mkdir("data",{recursive:true});

  await fs.writeFile(
    OUT,
    JSON.stringify(news,null,2),
    "utf8"
  );

  console.log(
    `Saved ${news.length} unique news`
  );
}

main().catch(e=>{
  console.error("UPDATE FAILED:",e);
  process.exit(1);
});
