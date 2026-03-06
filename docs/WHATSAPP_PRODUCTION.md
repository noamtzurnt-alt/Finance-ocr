# WhatsApp ב-Production – מספר משלך ולקוחות יכולים לשלוח

במצב **Sandbox** של Twilio רק מי ששלח `join xxx` יכול לשלוח הודעות, והחיבור פג אחרי 72 שעות.  
ב-**Production** יש לך **מספר WhatsApp Business משלך**, ולקוחות יכולים לשלוח אליו בלי להצטרף לשום דבר.

## מה צריך

1. **חשבון Meta Business** (עסק מאומת ב-Facebook/Meta)  
2. **WhatsApp Business Account (WABA)** – מחובר ל-Meta Business  
3. **מספר טלפון** למספר ה-WhatsApp העסקי (מספר ייעודי או נייד)  
4. **Twilio** כמספק שירות (BSP – Business Solution Provider) שמחבר את המספר ל-API ומעביר את ההודעות ל-Webhook של האפליקציה  

## צעדים (בגדול)

### 1. Meta Business ו-WhatsApp Business

- היכנס ל־[business.facebook.com](https://business.facebook.com) וצור/התחבר ל-**Meta Business Account**.
- אם העסק לא מאומת – תהליך אימות (מסמכים, דומיין וכו').
- ב-**Meta Business Suite** → **חיבור חשבונות** → הוסף **WhatsApp** → צור **WhatsApp Business Account (WABA)**.

### 2. מספר טלפון ל-WhatsApp

- צריך **מספר טלפון ייעודי** ל-WhatsApp Business (לא WhatsApp רגיל על אותו מספר).
- אפשר:
  - **מספר חדש** (סים או וירטואלי) שלא היה רשום ב-WhatsApp.
  - או **העברה** של מספר קיים מ-WhatsApp Business App ל-API (יש תהליך ב-Meta).

### 3. Twilio + WhatsApp Business API

- ב-[Twilio Console](https://console.twilio.com) → **Messaging** → **Try it out** → **Send a WhatsApp message** יש Sandbox.
- למעבר ל-**Production**:
  - **Messaging** → **WhatsApp** → **Senders** (או **WhatsApp enabled numbers**).
  - הזמנת/חיבור מספר ל-WhatsApp דרך Twilio – Twilio מנחה לחבר את ה-**WABA** ואת המספר ל-**WhatsApp Business API**.
  - Meta ידרוש אישור עסק (אם עדיין לא אומת) ואישור תבניות הודעות אם משתמשים בהן.

### 4. Webhook באפליקציה

- ב-Twilio: בהגדרות ה-WhatsApp number → **Webhook URL** = הכתובת של האפליקציה, למשל:  
  `https://your-domain.com/api/webhooks/incoming`
- כשהכל מוגדר, Twilio שולח כל הודעה נכנסת ל-URL הזה (כבר ממומש אצלך).

### 5. הגדרות באתר

- בהגדרות העסקיות באתר: בשדה **"מספר WhatsApp לקבלת קבלות"** להזין את **המספר של Twilio** (ה-WhatsApp העסקי) בפורמט בינלאומי, למשל `972501234567`.
- לקוחות שישלחו למספר הזה יגיעו ל-Webhook, והאפליקציה תשייך את ההודעות לפי המספר (וכן לפי משתמש אם יש יותר ממספר אחד).

## סיכום

| שלב | איפה | מה עושים |
|-----|------|----------|
| 1 | Meta Business | חשבון עסקי מאומת + WABA |
| 2 | מספר | מספר ייעודי ל-WhatsApp Business |
| 3 | Twilio | חיבור המספר ל-WhatsApp דרך Twilio (Production) |
| 4 | Twilio | Webhook = `https://your-domain.com/api/webhooks/incoming` |
| 5 | האתר | הגדרות → "מספר WhatsApp לקבלת קבלות" = המספר של Twilio |

אחרי שזה מוגדר, **אין צורך ב-join** – כל לקוח ששולח למספר העסקי יגיע ל-Webhook והמערכת תטפל בהודעה כמו שמתוכנן.
