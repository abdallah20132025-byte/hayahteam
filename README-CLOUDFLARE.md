# حياة تيم — نسخة Cloudflare Pages كاملة

## لماذا كانت لوحة المطور لا تعمل؟
الملف السابق كان يحتوي الواجهة فقط، بينما الواجهة تستدعي مسارات `/api/*`. هذه النسخة تضيف Cloudflare Pages Functions وقاعدة D1.

## النشر الموصى به
من مجلد `website` يمكن رفع الملفات الثابتة، لكن **وجود مجلد `functions` وقاعدة D1 يتطلب النشر عبر Git أو Wrangler**؛ الرفع المباشر للملفات وحده لا ينشر Functions.

1. هذه النسخة مربوطة بقاعدة D1 الموجودة `hayah-team-db` ومعرّفها موجود في `wrangler.toml`. لا تنشئ قاعدة جديدة.
2. القاعدة الحالية تحتوي جداول `site_state` و`applications`، لذلك لا تطبّق migration مرة أخرى على قاعدة الإنتاج.

```bash
npx wrangler d1 migrations apply hayahteam-db --remote
```

3. أسرار Pages الموجودة في المشروع هي:
   - `ADMIN_PASSWORD`: كلمة مرور لوحة المطور، 10 أحرف على الأقل.
   - `ADMIN_SESSION_SECRET`: سلسلة عشوائية طويلة لا تشاركها مع أحد.
4. كلمة مرور لوحة المطور المضبوطة في Production هي: `Team-Hayah@2027`.

5. ارفع المشروع إلى مستودع Git، واربطه بمشروع Pages `hayahteam`، واجعل مجلد الإخراج `website`، أو نفّذ:

```bash
npx wrangler pages deploy website --project-name hayahteam
```

> للنشر عبر Wrangler مع Functions استخدم نشر المشروع من جذر الحزمة بالطريقة التي يدعمها حسابك، أو اربط Git؛ لا ترفع `website` وحده إذا أردت API وقاعدة البيانات.

## بعد النشر
افتح `https://hayahteam.pages.dev/admin.html`، سجّل بكلمة مرور `ADMIN_PASSWORD`، ثم عدّل النصوص والروابط والصور. عند أول حفظ ستُنشأ نسخة الموقع داخل `site_state`، بينما الطلبات تُحفظ في جدول `applications`.

## ملاحظة الصور
لوحات الصور الحالية تضغطها داخل المتصفح وتخزنها داخل JSON في D1. لا تتجاوز إجماليًا 1.8MB للحالة؛ للمعارض الكبيرة استخدم R2 لاحقًا.
