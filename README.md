This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment

רשימת משתני הסביבה שבשימוש (ב־Vercel / `.env`):

| משתנה | שימוש |
|--------|--------|
| **DATABASE_URL** | חיבור ל־DB (Prisma). |
| **DIRECT_URL** | חיבור ישיר ל־DB (מיגרציות). |
| **AUTH_SECRET** | חתימת sessions / cookies. `openssl rand -base64 32`. |
| **R2_ACCOUNT_ID** | Cloudflare R2 – מזהה חשבון. |
| **R2_ACCESS_KEY_ID** | R2 – מפתח גישה. |
| **R2_SECRET_ACCESS_KEY** | R2 – סוד גישה. |
| **R2_BUCKET** | R2 – שם ה־bucket לאחסון קבצים. |
| **GEMINI_API_KEY** | (מומלץ) מפתח Gemini לזיהוי ספק/סכום/מע״מ מתוך קבלות שהועלו. |
| **CRON_SECRET** | סוד לאימות קריאות ל־`/api/cron/backup`. |
| **PASSKEY_RP_NAME** | (אופציונלי) שם התצוגה ל־Passkeys, ברירת מחדל "Finance". |

Copy `config/env.example` to `.env` and fill in the values (if the file exists).

### Database

1. Set `DATABASE_URL` in `.env`
2. Generate client: `npm run db:generate`
3. Run migrations: `npm run db:migrate`

### Deploy (GitHub + Vercel – project: finance-ocr)

**חיבור חד-פעמי:** הרץ פעם אחת מתוך תיקיית הפרויקט:
```bash
npm run link
```
בחר את ה-Account ואז **Link to existing project** → **finance-ocr**.

**לאחר כל שינוי – דחיפה ל-GitHub ודיפלוי ל-Vercel:**
```bash
npm run ship -- "תיאור השינוי"
```
(מחליף את "תיאור השינוי" בהודעת הקומיט. אם אין שינויים, רק ידפלס ל-Vercel.)

### כניסה למערכת (Passkey בלבד)

המערכת מיועדת למשתמש יחיד ומתחברת אך ורק דרך Passkey (Face ID / Touch ID), בלי אימייל וסיסמה.

1. Start dev server: `npm run dev`
2. Go to `/setup` בפעם הראשונה בלבד (אם אין עדיין משתמש ב-DB) — מזין אימייל ואז נרשם Passkey למכשיר.
3. בכל כניסה נוספת: `/login` ולחיצה על "התחבר עם Face ID / Touch ID".
4. להוספת מכשיר נוסף (טלפון/מחשב חדש): כשמחוברים כבר, `/passkeys` → "הוסף מכשיר".

### גיבויים, רישום עסקי ורגולציה (ישראל)

**גיבויים (Supabase) – תכלס**
**למה גיבוי חיצוני:** ב־Supabase Free Plan אין גיבויים אוטומטיים של ה־Database. לכן יש במערכת גיבוי משלנו שרץ דרך Cron Job: הנתיב `GET /api/cron/backup` מייצא snapshot של הנתונים (תנועות, תקציב, מסמכים, משתמשים וכו') לקובץ JSON ומעלה אותו ל־Cloudflare R2 בתיקייה `backups/`, כדי שלא תהיה תלויים רק ב־Supabase.

1. **אם יש לך Supabase בתשלום:** הפעל גם גיבוי ב־[Dashboard](https://supabase.com/dashboard) → **Project Settings** → **Database** → **Backups** (PITR או Daily). **תרגול שחזור:** פעם בכמה חודשים שחזר לפרויקט זמני.
2. **גיבוי ל־R2 (חובה ב־Free):** תזמן קריאה יומית ל־`GET /api/cron/backup` (אימות: `CRON_SECRET` ב־query `?secret=<CRON_SECRET>` או header `Authorization: Bearer <CRON_SECRET>`). למשל [cron-job.org](https://cron-job.org): GET `https://<הדומיין>/api/cron/backup?secret=<CRON_SECRET>` פעם ביום. הקבצים נשמרים כ־`backups/db-snapshot-YYYYMMDDHHmmss.json` (תאריך+שעה כדי לא לדרוס גיבויים קודמים).
3. **תיקון 307 redirect ל־/login (חובה אם ה־cron לא עובד):** ה־307 מגיע מ־**Vercel Deployment Protection**, לא מהקוד. עשה את זה ב־Vercel:
   - היכנס ל־[https://vercel.com](https://vercel.com) → בחר את הפרויקט **finance-ocr-tan**.
   - תפריט צד: **Settings** → גלול ל־**Deployment Protection**.
   - **אם מופיע "Vercel Authentication" או "Password Protection"** עם מתג (toggle) ל־Production: **כבה** את המתג ל־Production (השאר Only Preview אם אתה רוצה להגן רק על דפי preview).
   - **או** השאר הגנה והפעל **Protection Bypass for Automation**: צור סוד (או העתק את הקיים), ובהופעת ה־cron הוסף ל־URL: `&x-vercel-protection-bypass=<הסוד>` (בנוסף ל־`?secret=<CRON_SECRET>`).
   - שמור, ואז הרץ שוב: `curl "https://finance-ocr-tan.vercel.app/api/cron/backup?secret=<CRON_SECRET>"` – אמור לקבל 200 ו־JSON עם `ok: true`.
4. **ניטור:** וודא שאתה מקבל התראה במייל אם ה־cron נכשל (ב־cron-job.org: "Failure notification" לכתובת המייל שלך).

**Cloudflare R2 (אחסון קבלות) – תכלס**
1. הפעל **Object versioning:** [Cloudflare R2](https://dash.cloudflare.com/) → ה־bucket → **Settings** → **Object versioning** → Enable. כך מחיקה או דריסה לא מוחקות את הגרסה הקודמת ואפשר להחזיר תוך דקות.
2. **בדיקת סנכרון (רק בסביבת פיתוח):** מחק קובץ אחד ב־R2 (או דרך האפליקציה – מסמך בדב) ובדוק ב־Dashboard שב־"Object versioning" מופיעה גרסה קודמת ושאפשר לשחזר.

**עוסק פטור / מורשה**
אם יש לך עוסק פטור (או מורשה): וודא שכל לקוח שמשלם חותם (דיגיטלית או פיזית) על תנאי השימוש הכוללים את סעיף הגבלת האחריות, ושהתשלומים נכנסים לחשבון בנק עסקי (או חשבון שמוגדר עבור העוסק) – כך מונעים "הרמת מסך" ותביעה אישית נגדך במקום נגד העסק.

**רשם מאגרי מידע**
חובת רישום רלוונטית כשהמאגר מכיל מידע על רבים (סדר גודל אלפי רשומות / עשרות אלפי) או מידע רגיש (פיננסי, בריאות וכו'). מערכת זו מיועדת למשתמש יחיד, כך שהחובה הזו כרגע לא רלוונטית.

---

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Finance-ocr
