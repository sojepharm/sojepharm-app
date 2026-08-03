const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// إعدادات قراءة البيانات
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// قاعدة بيانات مؤقتة بالذاكرة (لتخزين المنتجات والتجار مبدئياً حتى نربط قاعدة بيانات دائمة)
let products = [
    { id: 1, name: "منتج تجريبي للكلاب", priceA: 10, priceB: 12, priceC: 15, stock: 50, category: "كلاب" }
];

let users = [
    { username: "admin", password: "123", role: "admin" },
    { username: "traderA", password: "123", role: "A" },
    { username: "traderB", password: "123", role: "B" }
];

// الصفحة الرئيسية للسيرفر
app.get('/', (req, res) => {
    res.send(`
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>Sojepharm - نظام إدارة الجملة والمفرق</title>
            <style>
                body { font-family: Tahoma, sans-serif; background: #f4f4f9; text-align: center; padding: 50px; }
                h1 { color: #2c3e50; }
                p { color: #555; font-size: 18px; }
                .box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>🐾 مرحباً بك في نظام Sojepharm 🐾</h1>
            <div class="box">
                <p>السيرفر يعمل بنجاح وجاهز لاستقبال بيانات المتجر!</p>
                <p>عدد المنتجات الحالية: <b>${products.length}</b></p>
            </div>
        </body>
        </html>
    `);
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`Sojepharm server is running on port ${PORT}`);
});
