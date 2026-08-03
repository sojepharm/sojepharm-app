const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Sojepharm - لوحة التحكم</title>
            <style>
                body { font-family: system-ui, sans-serif; background-color: #f4f6f8; margin: 0; padding: 40px; text-align: center; }
                .card { background: white; max-width: 600px; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                h1 { color: #2c3e50; margin-bottom: 10px; }
                p { color: #7f8c8d; font-size: 1.1rem; }
                .status { display: inline-block; padding: 8px 16px; background-color: #27ae60; color: white; border-radius: 20px; font-weight: bold; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>مرحباً بك في نظام Sojepharm 🚀</h1>
                <p>تم تشغيل السيرفر بنجاح وهو جاهز لبناء لوحة التحكم وإدارة المنتجات.</p>
                <div class="status">النظام يعمل أونلاين الآن</div>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
