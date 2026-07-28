"use strict";exports.id=6593,exports.ids=[6593],exports.modules={58974:(a,b,c)=>{c.d(b,{PROMPT_VERSION:()=>g,translateContent:()=>h});var d=c(3667);let e=d.Ik({title:d.Yj().describe("Translated title"),slug:d.Yj().describe("URL-safe slug in the target language, lowercase, hyphens only, no special chars"),excerpt:d.Yj().describe("Translated excerpt/summary (2-3 sentences)"),body:d.Yj().describe("Translated full body content, preserving HTML structure exactly"),metaTitle:d.Yj().describe("SEO meta title in target language (50-60 chars)"),metaDescription:d.Yj().describe("SEO meta description in target language (150-160 chars)"),focusKeyword:d.Yj().describe("Primary SEO focus keyword in target language"),supportingKeywords:d.YO(d.Yj()).describe("2-5 supporting SEO keywords in target language"),imageAlt:d.Yj().describe("Translated image alt text"),imageTitle:d.Yj().describe("Translated image title attribute"),imageCaption:d.Yj().describe("Translated image caption")}),f={en:"English",de:"German",ru:"Russian",ar:"Arabic"},g="1.0";async function h(a,b){let d=process.env.OPENAI_API_KEY;if(!d)return{ok:!1,reason:"not_configured",message:"OPENAI_API_KEY is not set"};let g=process.env.OPENAI_TRANSLATION_MODEL??"gpt-4o-mini",h=f[b]??b,i=`You are an expert translation engine specializing in luxury transportation and tourism content.
Your task is to translate Turkish content about Istanbul VIP Transfer into ${h}.

CRITICAL RULES — NEVER VIOLATE:
1. Do NOT translate these exact strings (keep them verbatim): "VIP Transfer Istanbul", "Istanbul VIP Transfer", "IST", "SAW", "Mercedes Vito", "Mercedes Sprinter", "+90 532 660 08 47", "WhatsApp", "wa.me/905326600847", "info@istanbulviptransfer.com"
2. Preserve ALL HTML tags exactly — translate only the text nodes inside them
3. Preserve phone numbers, URLs, and email addresses exactly as-is
4. For Arabic (ar): use Modern Standard Arabic appropriate for a luxury service
5. The slug must be URL-safe: lowercase, hyphens instead of spaces, no diacritics or special chars
6. Keep the professional, premium tone matching a luxury transfer service
7. SEO fields should be optimized for the target language market
8. Output ONLY the JSON — no markdown fences, no extra text`,j=`Translate the following Turkish content to ${h}.

Title: ${a.title}
Slug: ${a.slug}
Excerpt: ${a.excerpt??""}
Body (HTML): ${a.body??""}
Meta Title: ${a.metaTitle??a.title}
Meta Description: ${a.metaDescription??a.excerpt??""}
Focus Keyword: ${a.focusKeyword??""}
Supporting Keywords: ${(a.supportingKeywords??[]).join(", ")}
Image Alt: ${a.imageAlt??""}
Image Title: ${a.imageTitle??""}
Image Caption: ${a.imageCaption??""}`;try{let a,{OpenAI:b}=await c.e(4675).then(c.bind(c,64675)),f=new b({apiKey:d}),h=await f.chat.completions.create({model:g,messages:[{role:"system",content:i},{role:"user",content:j}],response_format:{type:"json_object"},temperature:.3}),k=h.choices[0]?.message?.content;if(!k)return{ok:!1,reason:"api_error",message:"No content in response"};try{a=JSON.parse(k)}catch{return{ok:!1,reason:"parse_error",message:"Failed to parse JSON response"}}let l=e.safeParse(a);if(!l.success)return{ok:!1,reason:"parse_error",message:`Schema validation failed: ${l.error.message}`};return{ok:!0,data:l.data,model:g}}catch(b){let a=b instanceof Error?b.message:String(b);if(a.includes("429")||a.toLowerCase().includes("rate limit"))return{ok:!1,reason:"rate_limited",message:a};return{ok:!1,reason:"api_error",message:a}}}}};