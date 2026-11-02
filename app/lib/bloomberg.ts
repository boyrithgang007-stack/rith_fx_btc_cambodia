export const BLOOMBERG_FEED="https://www.bloomberg.com/feeds/economics/news.rss";
export type NewsHeadline={title:string;url:string;publishedAt:string};
function plainText(value:string){
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(_,entity:string)=>{
    const named:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "};
    if(!entity.startsWith("#"))return named[entity.toLowerCase()]??"";
    const code=entity[1].toLowerCase()==="x"?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
    return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):"";
  }).replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
}
export function parseBloombergHeadlines(xml:string):NewsHeadline[]{
  if(xml.length>2_000_000||!/<rss\b/i.test(xml)||!/<\/rss\s*>/i.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error("Invalid RSS");
  const items:NewsHeadline[]=[],seen=new Set<string>();
  for(const match of [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/gi)].slice(0,100)){
    const field=(name:string)=>plainText(match[1].match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`,"i"))?.[1]??"");
    const title=field("title"),time=Date.parse(field("pubDate"));if(!title||title.length>300||!Number.isFinite(time))continue;
    try{const url=new URL(field("link"));if(url.protocol!=="https:"||!["www.bloomberg.com","bloomberg.com"].includes(url.hostname)||url.username||url.password||url.port)continue;
      url.hash="";if(seen.has(url.href))continue;seen.add(url.href);items.push({title,url:url.href,publishedAt:new Date(time).toISOString()});
    }catch{continue;}
  }
  if(!items.length)throw Error("No valid Bloomberg headlines");
  return items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,6);
}
