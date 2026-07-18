# نشر School X كـ Cloudflare Worker (+ Static Assets)

## ليه الهيكل اتغيّر
مشروعك الحالي (`chatxs`) اتعمل من Cloudflare كـ **Worker**، مش Pages classic —
وده بقى الافتراضي عند Cloudflare لمعظم المشاريع الجديدة من 2025. الاتنين مختلفين
في بنية الملفات، فالمشروع ده معدّل ليتوافق مع صيغة Worker:

- `public/index.html` — الموقع الثابت (بيتقدّم تلقائيًا لأي رابط ملوش تطابق API)
- `src/index.js` — سكريبت واحد بيتولى كل مسارات `/api/groq`, `/api/gemini`,
  `/api/openrouter`, `/api/cerebras`, `/api/health`
- `wrangler.jsonc` — ملف الإعداد اللي بيربط الاتنين ببعض، واسم المشروع فيه
  `"chatxs"` نفس اسم مشروعك الموجود، عشان يتحدّث بدل ما يتعمل مشروع جديد

## خطوات الرفع (استبدال المحتوى الحالي)

1. افتح الـ repo بتاعك على GitHub
2. **امسح** الملفات والمجلدات القديمة كلها (`index.html`, `api/`, `functions/`
   لو موجودين في الجذر)
3. ارفع محتوى الملف المضغوط ده بالكامل مكانهم — لازم تفضل نفس البنية
   (`public/`, `src/`, `wrangler.jsonc` في الجذر)
4. Push للـ branch الرئيسي

Cloudflare هيكتشف الـ push تلقائي (لو الربط مفعّل من قبل) ويعمل Deploy جديد،
هتلاقيه ظاهر في تبويب **Deployments** بنفس مشروع `chatxs`.

## تأكد من المفاتيح
روح **Settings → Variables and Secrets** جوه مشروع `chatxs` وتأكد إن الأربعة
متضافين (لو مضافين من قبل هيفضلوا موجودين، الانتقال ده ملوش تأثير عليهم):
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `OPENROUTER_API_KEY`
- `CEREBRAS_API_KEY`

## اختبار بعد النشر
- `https://chatxs.<حسابك>.workers.dev/api/health` — المفروض يرجع
  `{"groqConfigured":true, ...}` للأربعة كلهم
- افتح الرابط الرئيسي وجرب الشات نفسه
