const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 402, height: 874 }, acceptDownloads: true, colorScheme: 'dark' })
  const p = await ctx.newPage()
  await p.addInitScript(() => {
    const levels = [['l1','Ужасно','#E3263A'],['l2','Очень плохо','#9A3E9C'],['l3','Плохо','#3559D6'],['l4','Так себе','#8E8AA8'],['l5','Нормально','#14A090'],['l6','Хорошо','#8FD14F'],['l7','Отлично','#FFC53D']].map(([id,name,color])=>({id,name,color}))
    const entries = {}; let s=3; const r=()=>(s=(s*16807)%2147483647)/2147483647; let m=4
    const p2=n=>String(n).padStart(2,'0')
    for (let d=new Date(2026,0,1); d<new Date(2026,10,4); d.setDate(d.getDate()+1)) { m+= (r()-.5)*2.6+(4-m)*.2; const k=`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`; entries[k]={level:levels[Math.max(0,Math.min(6,Math.round(m)))].id,at:1} }
    localStorage.setItem('ottenki:data:v1', JSON.stringify({version:1,levels,tags:[],entries,settings:{theme:'system',weekStart:0,showDetails:true,yearLayout:'months'},palette:'spectrum',onboarded:true,createdAt:1}))
  })
  await p.goto('http://localhost:4173/mood-calendar/#year')
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.pill-btn:has-text("Картинка")')])
  await dl.saveAs('shots/poster.png'); await b.close()
})()
