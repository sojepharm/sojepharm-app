const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

let products = [
    { id: 1, name: "Sample Product for Dogs and Cats", category: "Veterinary Medicine", price: 15, stock: 50 }
];

let users = [
    { username: "admin", password: "123", role: "admin" }
];

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Sojepharm Store</title>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; text-align: center; padding: 50px; }
                .container { background: white; padding: 20px; border-radius: 8px; display: inline-block; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                h1 { color: #333; }
                .product { margin-top: 20px; font-size: 18px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Current Expiry Product List</h1>
                <div class="product">
                    <p><strong>Name:</strong> Sample Product for Dogs and Cats</p>
                    <p><strong>Category:</strong> Veterinary Medicine</p>
                    <p><strong>Price:</strong> 15$</p>
                    <p><strong>Stock:</strong> 50</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
