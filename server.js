const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let products = [
    { id: 1, name: "منتج تجريبي للكلاب والقطط", priceA: 10, priceB: 12, priceC: 15, stock: 50, category: "أدوية بيطرية" }
];

let users = [
    { username: "admin", password: "123", role: "admin" },
    { username: "traderA", password: "123", role: "A" },
    { username: "traderB", password: "123", role: "B" }
];

app.get('/', (req, res) => {
    let role = req.query.role || 'C';
    let productHTML = products.map(p => {
        let price = p.priceC;
        if (role === 'admin' || role === 'A') price = p.priceA;
        else if (role === 'B') price = p.priceB;

        return `
            <div style="background:white; padding:15px; margin:10px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1); display:inline-block; width:250px; text-align:right;">
                <h3>${p.name}</h3>
                <p><b>التصنيف:</b> ${p.category}</p>
                <p><b>السعر:</b> <span style="color:green; font-size:18px;">$${price}</span></p>
                <p><b>المخزون:</b> ${p.stock}</p>
            </div>
        `;
    }).join('');

    res.send(`
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>Sojepharm - المتجر</title>
            <style>
                body { font-family: Tahoma, sans-serif; background: #f4f4f9; margin: 0; padding: 20px; text-align: center; }
                nav { background: #2c3e50; padding: 10px; color: white; border-radius: 5px; margin-bottom: 20px; }
                nav a { color: white; margin: 0 15px; text-decoration: none; font-weight: bold; }
            </style>
        </head>
        <body>
            <nav>
                <span>🐾 Sojepharm Store</span>
                <a href="/?role=C">تسعير مفرق (C)</a>
                <a href="/?role=B">تسعير فئة (B)</a>
                <a href="/?role=A">تسعير جملة (A)</a>
                <a href="/admin" style="background:#e74c3c; padding:5px 10px; border-radius:4px;">لوحة الإدارة</a>
            </nav>
            <h1>قائمة المنتجات (حسب الصلاحية الحالية: ${role})</h1>
            <div>${productHTML}</div>
        </body>
        </html>
    `);
});

app.get('/admin', (req, res) => {
    let rows = products.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>$${p.priceA}</td>
            <td>$${p.priceB}</td>
            <td>$${p.priceC}</td>
            <td>${p.stock}</td>
        </tr>
    `).join('');

    res.send(`
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>لوحة التحكم - Sojepharm</title>
            <style>
                body { font-family: Tahoma, sans-serif; background: #f4f4f9; padding: 20px; direction: rtl; }
                table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
                th { background: #2c3e50; color: white; }
                form { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-top: 20px; }
                input, button { padding: 8px; margin: 5px; width: calc(20% - 20px); }
                button { background: #27ae60; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>🛠️ لوحة تحكم الإدارة - إضافة وتعديل المنتجات</h1>
            <a href="/" style="display:inline-block; margin-bottom:15px; text-decoration:none; background:#3498db; color:white; padding:8px 15px; border-radius:4px;">الذهاب إلى المتجر</a>
            
            <form action="/add-product" method="POST">
                <h3>إضافة منتج جديد فوراً دون أكواد</h3>
                <input type="text" name="name" placeholder="اسم المنتج" required>
                <input type="number" name="priceA" placeholder="سعر A (جملة كبرى)" required>
                <input type="number" name="priceB" placeholder="سعر B (جملة)" required>
                <input type="number" name="priceC" placeholder="سعر C (مفرق)" required>
                <input type="number" name="stock" placeholder="الكمية بالمخزون" required>
                <input type="text" name="category" placeholder="التصنيف" required>
                <button type="submit">حفظ وإضافة المنتج</button>
            </form>

            <h2>المنتجات الحالية في النظام</h2>
            <table>
                <tr>
                    <th>اسم المنتج</th>
                    <th>سعر A</th>
                    <th>سعر B</th>
                    <th>سعر C</th>
                    <th>المخزون</th>
                </tr>
                ${rows}
            </table>
        </body>
        </html>
    `);
});

app.post('/add-product', (req, res) => {
    const { name, priceA, priceB, priceC, stock, category } = req.body;
    products.push({
        id: products.length + 1,
        name,
        priceA: Number(priceA),
        priceB: Number(priceB),
        priceC: Number(priceC),
        stock: Number(stock),
        category
    });
    res.redirect('/admin');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
