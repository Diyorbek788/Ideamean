# NetLog Brief

[English](README.md) · MIT

**Ikki tarmoq yozuvini brauzerning o‘zida solishtiring.** Bir xil sahifa yoki amal bir sharoitda ishlasa-yu boshqasida ishlamasa, yozuvlarni A va B qilib oching. Qaysi tarmoq xatolari qayd etilganini, brauzer HTTP javobi olgan-olmaganini va ayrim amallar qancha vaqt olganini ko‘rasiz.

## Ishlatish

1. [index.html](index.html) faylini yuklab olib, Chrome yoki Edge’da oching. Dastlab ikki sun’iy misol ko‘rinadi.
2. Haqiqiy yozuv uchun Chrome’da `chrome://net-export` yoki Edge’da `edge://net-export` sahifasini oching. Odatiy maxfiylik rejimini qoldiring.
3. **Start Logging to Disk** tugmasini bosing. Boshqa oynada muammoni qaytaring, so‘ng **Stop Logging** tugmasi bilan yozishni tugating.
4. Birinchi JSON faylni A uchun tanlang. Ikkinchi sharoitda xuddi shu amalni takrorlab, yangi faylni B uchun oching. Bitta fayl bilan ham hisobot olasiz.
5. **Markdown saqlash** tugmasi GitHub issue yoki IT mutaxassisiga yuborish uchun hisobot beradi. Mashinada o‘qiladigan shakl uchun **JSON saqlash** tugmasidan foydalaning.

Dastur yozuvlarni brauzerning o‘zida o‘qiydi. Hisobotda URL, IP, cookie, fayl nomi va yozuvning to‘liq matni chiqmaydi. Barcha hodisalar bitta yozuv bo‘yicha sanaladi. Bir uzilish bir nechta xato qaydini berishi mumkin, shuning uchun hisobotda qaydlar soni ko‘rsatiladi. Har fayl uchun chegara 32 MiB va 250 000 hodisa.

## Terminaldan

Node.js 22 yoki yangirog‘i bilan repozitoriy ichida ishlating.

```sh
node bin/netlog-brief.mjs compare examples/demo-a.json examples/demo-b.json --lang uz
node bin/netlog-brief.mjs summarize examples/demo-a.json --format json
npm test
```

Loyiha kodi MIT litsenziyasida. Moslik muammosi topsangiz, qisqa sun’iy misol yoki dastur chiqargan hisobot bilan GitHub issue oching.
