const PHONE = "96170333470";
const CART_KEY = "petUnleashCartV3";
const ROLE_KEY = "petUnleashRoleV3";
const VISITOR_KEY = "petUnleashVisitorV1";
const INVOICE_KEY = "petUnleashInvoiceCounterV1";
// Local test storage: lets us verify the complete order flow before connecting live stock.
const LOCAL_STOCK_KEY = "petUnleashLocalStockV15";
const LOCAL_ORDERS_KEY = "petUnleashLocalOrdersV15";
let products = [];
let cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
let activeCategory = "ALL";
let activeBrand = "ALL";
let activeDepartment = "ALL";
let currentInvoice = null;
let currentRole = "retail";
let supabaseClient = null;
let cartSyncTimer = null;

const departmentCards = {
  "Dog Accessories": [
    ["Dog Beds & Resting Places", "🛏️"], ["Leads, Collars & Harnesses", "🦮"], ["Toys", "🎾"], ["Dog Snacks", "🦴"],
    ["Bowls & Water Bottles", "🥣"], ["At Home", "🏠"], ["Transport & Travel", "🚗"], ["Hygiene & Care", "🧴"]
  ],
  "Cat Accessories": [
    ["Cat Beds & Resting Places", "🛏️"], ["Toys for Cats", "🐭"], ["Cat Snacks", "🦴"], ["Bowls & Water Bottles", "🥣"],
    ["Transport & Travel", "👜"], ["Cat Litter Tray", "🐈"], ["Hygiene & Care", "🧴"], ["At Home", "🏠"]
  ]
};
const categoryImages = {
  "Dog Accessories": {
    "Dog Beds & Resting Places": "dog-bed", "Leads, Collars & Harnesses": "dog-leads", "Toys": "dog-toys", "Dog Snacks": "dog-snacks",
    "Bowls & Water Bottles": "dog-bowls", "At Home": "dog-home", "Transport & Travel": "dog-voyager", "Hygiene & Care": "dog-hygiene"
  },
  "Cat Accessories": {
    "Cat Beds & Resting Places": "cat-bed", "Toys for Cats": "cat-toys", "Cat Snacks": "cat-snacks", "Bowls & Water Bottles": "cat-bowls",
    "Transport & Travel": "cat-voyager", "Cat Litter Tray": "cat-leads", "Hygiene & Care": "cat-hygiene", "At Home": "cat-home"
  }
};

function classifyProduct(item) {
  const text = `${item.name || ""} ${item.description || ""}`.toLowerCase();
  if (/food|adult|puppy|junior|salmon|chicken|beef|lamb/.test(text)) return /cat|kitten/.test(text) ? "Cat Food" : "Dog Food";
  if (/snack|treat|chew|bone/.test(text)) return "Treats";
  if (/lead|leash|collar|harness/.test(text)) return "Leads, Collars & Harnesses";
  if (/toy|ball|rope/.test(text)) return "Toys";
  if (/bed|cushion|blanket/.test(text)) return /cat/.test(text) ? "Cat Beds & Resting Places" : "Dog Beds & Resting Places";
  if (/bowl|bottle|feeder/.test(text)) return "Bowls";
  if (/litter|toilet/.test(text)) return "Cat Litter";
  if (/shampoo|brush|comb|tooth|hygiene|groom/.test(text)) return "Hygiene & Care";
  if (/carrier|transport|voyager|travel|cage/.test(text)) return "Pet Voyager";
  return /cat/.test(text) ? "Cat Accessories" : "Dog Accessories";
}

const role = () => currentRole;
const money = value => `${Number(value || 0).toFixed(2)} USD`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const isConfigured = () => window.PET_UNLEASH_SUPABASE_ANON_KEY && !window.PET_UNLEASH_SUPABASE_ANON_KEY.startsWith("PASTE_");
function db() {
  if (!isConfigured() || !window.supabase) return null;
  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(
      window.PET_UNLEASH_SUPABASE_URL,
      window.PET_UNLEASH_SUPABASE_ANON_KEY,
      {
        auth: {
          storage: window.sessionStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      }
    );
  }
  return supabaseClient;
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function applyLocalStock(productsList) {
  const savedStock = readJson(LOCAL_STOCK_KEY, {});
  return productsList.map(product => ({
    ...product,
    stock: Object.prototype.hasOwnProperty.call(savedStock, product.id) ? Number(savedStock[product.id]) : product.stock
  }));
}

function normalizeProduct(item) {
  const itemCode = String(item.item_code ?? item.id ?? "");
  const brand = item.brand || "TRIXIE";
  // The database is the source of truth. Do not infer a product type from its item-code prefix:
  // TRIXIE uses overlapping number ranges for toys, care products and snacks.
  const category = item.category || classifyProduct(item);
  const subcategory = item.subcategory || "";
  return {
    id: itemCode,
    barcode: item.barcode || "",
    brand,
    name: item.name || "",
    category,
    subcategory,
    description: item.description || "",
    wholesale: item.wholesale == null ? null : Number(item.wholesale),
    retail: Number(item.retail || 0),
    stock: Number(item.stock || 0),
    image: item.image_url || item.image || "",
    active: item.active !== false,
  };
}

async function getProducts() {
  const client = db();
  if (client) {
    const source = role() === "wholesale" ? "wholesale_storefront_products" : "retail_storefront_products";
    const { data, error } = await client.from(source).select("item_code,barcode,name,brand,category,subcategory,description,wholesale,retail,stock,image_url,active").order("name");
    if (!error) return applyLocalStock(data.map(normalizeProduct));
    console.warn("Could not load storefront products from Supabase", error.message);
  }
  if (Array.isArray(window.PET_UNLEASH_LOCAL_PRODUCTS)) return applyLocalStock(window.PET_UNLEASH_LOCAL_PRODUCTS.map(normalizeProduct));
  const base = await fetch("data.json").then(response => response.json());
  return applyLocalStock(base.map(normalizeProduct));
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
  scheduleCartSync();
}
function visitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}
function scheduleCartSync() {
  clearTimeout(cartSyncTimer);
  cartSyncTimer = setTimeout(() => syncLiveCart("draft"), 700);
}
async function syncLiveCart(status = "draft") {
  if (!cart.length && !localStorage.getItem(VISITOR_KEY)) return;
  const client = db();
  if (!client) return;
  const items = cart.map(line => {
    const product = products.find(item => item.id === line.id);
    return product ? {
      item_code: product.id,
      product_name: product.name,
      quantity: line.qty,
      unit_price: currentPrice(product)
    } : null;
  }).filter(Boolean);
  const { error } = await client.functions.invoke("storefront-services", {
    body: {
      action: "sync_cart",
      visitor_id: visitorId(),
      items,
      customer_name: document.querySelector("#customerName")?.value || "",
      customer_phone: document.querySelector("#customerPhone")?.value || "",
      customer_address: document.querySelector("#customerAddress")?.value || "",
      customer_type: role(),
      status
    }
  });
  if (error) console.warn("Could not sync live cart", error.message);
}
function updateCartCount() {
  document.querySelectorAll("[data-cart-count]").forEach(element => element.textContent = cart.reduce((total, line) => total + line.qty, 0));
}
function currentPrice(product) {
  // Retail must always use the public retail price. Wholesale is only available
  // after the current tab has an authorized wholesale session.
  return role() === "wholesale"
    ? Number(product.wholesale ?? product.retail ?? 0)
    : Number(product.retail ?? 0);
}
const brandCategoryOrder = [
  "Treats", "Dog Food", "Cat Food", "Dog Snacks", "Cat Snacks",
  "Hygiene & Care", "Bowls", "Toys", "Leads, Collars & Harnesses",
  "Dog Beds & Resting Places", "Cat Beds & Resting Places",
  "Pet Voyager", "At Home", "Cat Litter", "Dog Accessories",
  "Cat Accessories", "Dog", "Cat", "Both"
];
function brandGroup(product) {
  const curated = String(product.subcategory || "").toLowerCase();
  if (/snack|treat/.test(curated)) return "Treats";
  if (/hygiene|care|clean/.test(curated)) return "Hygiene & Care";
  if (/bowl|water bottle/.test(curated)) return "Bowls";
  if (/toy/.test(curated)) return "Toys";
  if (/bed|cushion/.test(curated)) return productAudience(product) === "cat" ? "Cat Beds & Resting Places" : "Dog Beds & Resting Places";
  if (/transport|voyager|travel/.test(curated)) return "Pet Voyager";
  if (/lead|collar|harness/.test(curated)) return "Leads, Collars & Harnesses";
  if (/litter|scratching|home/.test(curated)) return "At Home";
  // Never guess a storefront section from product names. Imported names can
  // contain words such as ball, bone or cat even when the curated section is different.
  return product.category || "Other";
}
function brandProductOrder(a, b) {
  if (activeBrand === "ALL") return 0;
  const aGroup = brandGroup(a);
  const bGroup = brandGroup(b);
  const aRank = brandCategoryOrder.indexOf(aGroup);
  const bRank = brandCategoryOrder.indexOf(bGroup);
  const categoryDifference = (aRank < 0 ? 999 : aRank) - (bRank < 0 ? 999 : bRank);
  if (categoryDifference) return categoryDifference;
  const categoryNameDifference = String(aGroup).localeCompare(String(bGroup));
  if (categoryNameDifference) return categoryNameDifference;
  return String(a.name).localeCompare(String(b.name), undefined, { numeric: true });
}
function filtered() {
  const query = (document.querySelector("#search")?.value || "").toLowerCase().trim();
  const foodType = document.querySelector("#foodType")?.value || "ALL";
  const category = activeCategory;
  return products.filter(product => product.active !== false)
    .filter(product => activeBrand === "ALL" || String(product.brand).toUpperCase() === activeBrand)
    .filter(product => foodType === "ALL" || product.category === foodType)
    .filter(product => category === "ALL" || categoryMatches(product, category))
    .filter(product => `${product.id} ${product.barcode} ${product.name} ${product.brand}`.toLowerCase().includes(query))
    .sort(brandProductOrder);
}
function productAudience(product) {
  const category = String(product.category || "").toLowerCase();
  if (category.includes("cat")) return "cat";
  if (category.includes("dog")) return "dog";
  return "both";
}
function categoryMatches(product, selectedCategory) {
  const productCategory = String(product.category || "").toLowerCase();
  const subcategory = String(product.subcategory || "").toLowerCase();
  const audience = productAudience(product);
  const wantedAudience = activeDepartment === "Cats" ? "cat" : activeDepartment === "Dogs" ? "dog" : "both";
  const audienceMatches = wantedAudience === "both" || audience === wantedAudience || audience === "both";
  if (!audienceMatches) return false;
  const isDog = audience === "dog";
  const isCat = audience === "cat";
  const isBoth = audience === "both";
  const inSection = (...names) => names.includes(subcategory);

  if (selectedCategory === "Dog Snacks") return isDog && inSection("dog snacks", "treats");
  if (selectedCategory === "Cat Snacks") return isCat && inSection("cat snacks", "treats");
  if (selectedCategory === "Toys") return isDog && inSection("toys");
  if (selectedCategory === "Toys for Cats") return isCat && inSection("toys");
  if (selectedCategory === "Leads, Collars & Harnesses") return isDog && inSection("leads, collars & harnesses");
  if (selectedCategory === "Dog Beds & Resting Places") return isDog && inSection("beds & cushions", "cushion");
  if (selectedCategory === "Cat Beds & Resting Places") return isCat && inSection("beds & cushions", "cushion");
  if (selectedCategory === "Bowls & Water Bottles") return (isDog || isCat || isBoth) && inSection("bowls", "bowls & water bottles");
  if (selectedCategory === "Transport & Travel") return (isDog || isCat || isBoth) && inSection("pet voyager", "transport & travel");
  if (selectedCategory === "Hygiene & Care") return (isDog || isCat || isBoth) && inSection("hygiene", "hygiene & care");
  if (selectedCategory === "At Home") return (isDog || isCat) && inSection("at home", "scratching");
  if (selectedCategory === "Cat Litter Tray") {
    const text = `${product.name || ""} ${product.description || ""}`.toLowerCase();
    return isCat && inSection("hygiene", "hygiene & care") && /litter|toilet/.test(text);
  }
  if (selectedCategory === "Dogs") return isDog;
  if (selectedCategory === "Cats") return isCat;
  return productCategory === String(selectedCategory || "").toLowerCase();
}
function renderProducts() {
  const grid = document.querySelector("#products");
  if (!grid) return;
  const list = filtered();
  if (!list.length) {
    grid.innerHTML = `<p class="empty-products">No products found in this selection.</p>`;
    return;
  }
  let previousGroup = "";
  grid.innerHTML = list.map(product => {
    const group = activeBrand === "ALL" ? "" : brandGroup(product);
    const groupHeading = group && group !== previousGroup
      ? `<div class="product-group-heading"><p>${escapeHtml(activeBrand)}</p><h3>${escapeHtml(group)}</h3></div>`
      : "";
    previousGroup = group;
    return `${groupHeading}
    <article class="card">
      <div class="image-wrap">${product.image ? `<img src="${product.image}" alt="${product.name}">` : "🐾"}</div>
      <div class="card-body">
        <div class="brand">${product.brand}</div><h3>${product.name}</h3>
        <div class="meta">Item: ${product.id}${product.barcode ? `<br>Barcode: ${product.barcode}` : ""}</div>
        <div class="price-row"><div><small>${role() === "wholesale" ? "Wholesale" : "Retail"} price</small><div class="price">${money(currentPrice(product))}</div>${role() === "wholesale" ? `<div class="wholesale-price">Retail ${money(product.retail)}</div>` : ""}</div><div class="stock ${product.stock <= 0 ? "out" : ""}">${product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</div></div>
        <div class="card-actions"><input id="qty-${product.id}" class="qty-input" type="number" min="1" max="${Math.max(1, product.stock)}" value="1"><button class="btn btn-primary" style="flex:1" ${product.stock <= 0 ? "disabled" : ""} onclick="addToCart('${product.id}')">Add to Cart</button></div>
      </div>
    </article>`;
  }).join("");
  document.querySelectorAll("[data-role-label]").forEach(element => element.textContent = role() === "wholesale" ? "Wholesale" : "Retail");
}
function addToCart(id) {
  const product = products.find(item => item.id === id);
  const quantity = Math.max(1, Number(document.querySelector(`#qty-${CSS.escape(id)}`)?.value || 1));
  if (!product || product.stock <= 0) return;
  const line = cart.find(item => item.id === id);
  const existing = line ? line.qty : 0;
  const allowed = Math.min(quantity, product.stock - existing);
  if (allowed <= 0) return alert("Maximum stock already in cart.");
  if (line) line.qty += allowed; else cart.push({ id, qty: allowed });
  saveCart();
}
function openCart() { renderCart(); document.querySelector("#cartModal").classList.add("open"); }
function closeCart() { document.querySelector("#cartModal").classList.remove("open"); }
function renderCart() {
  const container = document.querySelector("#cartLines"); let total = 0;
  if (!cart.length) { container.innerHTML = "<p>Your cart is empty.</p>"; document.querySelector("#cartTotal").textContent = money(0); return; }
  container.innerHTML = cart.map(line => { const product = products.find(item => item.id === line.id); if (!product) return ""; const subtotal = currentPrice(product) * line.qty; total += subtotal; return `<div class="cart-line"><div><b>${product.name}</b><br><small>${product.id}</small></div><input type="number" min="1" max="${product.stock}" value="${line.qty}" onchange="changeQty('${product.id}',this.value)"><div><b>${money(subtotal)}</b></div><button class="icon-btn" onclick="removeLine('${product.id}')">×</button></div>`; }).join("");
  document.querySelector("#cartTotal").textContent = money(total);
}
function changeQty(id, value) { const product = products.find(item => item.id === id); const line = cart.find(item => item.id === id); if (!product || !line) return; line.qty = Math.max(1, Math.min(Number(value) || 1, product.stock)); saveCart(); renderCart(); }
function removeLine(id) { cart = cart.filter(line => line.id !== id); saveCart(); renderCart(); }
function confirmOrder() {
  if (!cart.length) return alert("Your cart is empty.");
  const name = document.querySelector("#customerName").value.trim(); const phone = document.querySelector("#customerPhone").value.trim(); const address = document.querySelector("#customerAddress").value.trim();
  if (!name || !phone) return alert("Enter customer name and phone.");
  const items = cart.map(line => { const product = products.find(item => item.id === line.id); return { product, qty: line.qty, subtotal: currentPrice(product) * line.qty }; });
  const total = items.reduce((sum, item) => sum + item.subtotal, 0);
  currentInvoice = { number: nextInvoiceNumber(), date: new Date().toLocaleString(), customer: { name, phone, address }, customerType: role(), items, total };
  closeCart();
  renderInvoice();
  document.querySelector("#invoiceModal").classList.add("open");
}
function nextInvoiceNumber() {
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const saved = JSON.parse(localStorage.getItem(INVOICE_KEY) || "{}");
  const count = saved.day === today ? Number(saved.count || 0) + 1 : 1;
  localStorage.setItem(INVOICE_KEY, JSON.stringify({ day: today, count }));
  return `PU-${today}-${String(count).padStart(4, "0")}`;
}
function closeInvoice() { document.querySelector("#invoiceModal").classList.remove("open"); }
function renderInvoice() {
  if (!currentInvoice) return;
  const invoice = currentInvoice;
  document.querySelector("#invoiceContent").innerHTML = `
    <div class="invoice-brand"><div><b>PET <i>UNLEASH</i></b><span>Freedom and care for all your companions</span></div><div class="invoice-business"><strong>Invoice</strong><span>No. ${invoice.number}</span><span>Phone: +961 70 333 470</span><span>${invoice.date}</span></div></div>
    <div class="invoice-customer"><div><small>DELIVER TO</small><b>${escapeHtml(invoice.customer.name)}</b><span>${escapeHtml(invoice.customer.phone)}</span><span>${escapeHtml(invoice.customer.address || "Address not provided")}</span></div><div><small>CUSTOMER TYPE</small><b>${escapeHtml(invoice.customerType)}</b></div></div>
    <table class="invoice-table"><thead><tr><th>Product</th><th>Item code</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${invoice.items.map(item => `<tr><td>${escapeHtml(item.product.name)}</td><td>${escapeHtml(item.product.id)}</td><td>${item.qty}</td><td>${money(currentPrice(item.product))}</td><td>${money(item.subtotal)}</td></tr>`).join("")}</tbody></table>
    <div class="invoice-grand-total"><span>Grand total</span><b>${money(invoice.total)}</b></div>`;
}
function saveLocalOrderAndDeductStock(invoice) {
  if (invoice.stockCommitted) return true;
  const unavailable = invoice.items.find(item => {
    const product = products.find(entry => entry.id === item.product.id);
    return !product || Number(product.stock) < Number(item.qty);
  });
  if (unavailable) {
    alert(`Not enough stock for ${unavailable.product.name}. Please adjust the cart.`);
    return false;
  }
  const savedStock = readJson(LOCAL_STOCK_KEY, {});
  invoice.items.forEach(item => {
    const product = products.find(entry => entry.id === item.product.id);
    const remaining = Math.max(0, Number(product.stock) - Number(item.qty));
    product.stock = remaining;
    item.product.stock = remaining;
    savedStock[product.id] = remaining;
  });
  localStorage.setItem(LOCAL_STOCK_KEY, JSON.stringify(savedStock));
  const orders = readJson(LOCAL_ORDERS_KEY, []);
  orders.push({
    number: invoice.number,
    date: invoice.date,
    customer: invoice.customer,
    customerType: invoice.customerType,
    total: invoice.total,
    items: invoice.items.map(item => ({ id: item.product.id, name: item.product.name, qty: item.qty, subtotal: item.subtotal }))
  });
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  invoice.stockCommitted = true;
  renderProducts();
  return true;
}
async function sendInvoiceWhatsApp() {
  if (!currentInvoice) return;
  const invoice = currentInvoice;
  if (!saveLocalOrderAndDeductStock(invoice)) return;
  await syncLiveCart("submitted");
  const message = ["PET UNLEASH INVOICE", `Invoice No: ${invoice.number}`, `Date: ${invoice.date}`, `Customer type: ${invoice.customerType}`, `Deliver to: ${invoice.customer.name}`, `Phone: ${invoice.customer.phone}`, invoice.customer.address ? `Address: ${invoice.customer.address}` : "", "", ...invoice.items.map(item => `${item.product.name} (${item.product.id}) x${item.qty} = ${money(item.subtotal)}`), "", `TOTAL: ${money(invoice.total)}`].filter(Boolean).join("\n");
  cart = [];
  saveCart();
  closeInvoice();
  window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`, "_blank");
}
function setCategory(category) {
  activeBrand = "ALL";
  activeCategory = category;
  document.querySelector("#shop").hidden = false;
  document.querySelector("#productHeading").textContent = category === "ALL" ? "Featured Products" : category;
  renderProducts();
}
function openDepartment(department) {
  activeDepartment = department;
  const cardDepartment = department === "Dogs" ? "Dog Accessories" : department === "Cats" ? "Cat Accessories" : department;
  const cards = departmentCards[cardDepartment];
  if (!cards) { setCategory(department); document.querySelector("#shop").scrollIntoView({behavior:"smooth"}); return; }
  document.querySelector("#breadcrumb").textContent = `Pet Unleash / ${department}`;
  document.querySelector("#departmentTitle").textContent = department;
  const grid = document.querySelector("#subcategoryGrid");
  grid.innerHTML = cards.map(([name]) => {
    const image = categoryImages[cardDepartment][name];
    return `<button class="subcategory" style="background-image:url('assets/categories/${image}.png')" onclick="openSubcategory('${name}')"><b>${name}</b></button>`;
  }).join("");
  document.querySelector("#subcategories").hidden = false;
  document.querySelector("#subcategories").scrollIntoView({behavior:"smooth",block:"start"});
}
function openSubcategory(category) { setCategory(category); document.querySelector("#shop").scrollIntoView({behavior:"smooth"}); }
function showAllProducts() { activeDepartment = "ALL"; document.querySelector("#subcategories").hidden = true; setCategory("ALL"); document.querySelector("#shop").scrollIntoView({behavior:"smooth"}); }
function showBrandProducts(brand) {
  activeDepartment = "ALL";
  activeCategory = "ALL";
  activeBrand = String(brand || "").toUpperCase();
  document.querySelector("#subcategories").hidden = true;
  document.querySelector("#foodType").value = "ALL";
  document.querySelector("#search").value = "";
  document.querySelector("#shop").hidden = false;
  document.querySelector("#productHeading").textContent = `${brand} Products`;
  renderProducts();
  document.querySelector("#shop").scrollIntoView({behavior:"smooth"});
}
function showHome() { document.querySelector("#subcategories").hidden = true; document.querySelector("#shop").hidden = true; activeCategory = "ALL"; activeBrand = "ALL"; activeDepartment = "ALL"; document.querySelector("#top").scrollIntoView({behavior:"smooth"}); }
function openWholesaleLogin() { document.querySelector("#wholesaleModal").classList.add("open"); }
function closeWholesaleLogin() { document.querySelector("#wholesaleModal").classList.remove("open"); }
function normalizeLebanonPhone(value) {
  const raw = String(value || "").trim().replace(/[\s().-]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return `+${raw.slice(2)}`;
  if (raw.startsWith("961")) return `+${raw}`;
  if (raw.startsWith("0")) return `+961${raw.slice(1)}`;
  return `+961${raw}`;
}
function phoneLoginEmail(phone) {
  return `${phone.replace(/\D/g, "")}@phone.petunleash.invalid`;
}
function openWholesaleRegistration() {
  closeWholesaleLogin();
  document.querySelector("#wholesaleRegisterModal").classList.add("open");
}
function closeWholesaleRegistration() {
  document.querySelector("#wholesaleRegisterModal").classList.remove("open");
}
function openWholesaleVerification(phone = "") {
  closeWholesaleRegistration();
  document.querySelector("#verifyPhone").value = phone;
  document.querySelector("#wholesaleVerifyModal").classList.add("open");
}
function closeWholesaleVerification() {
  document.querySelector("#wholesaleVerifyModal").classList.remove("open");
}
async function registerWholesale(event) {
  event?.preventDefault();
  const client = db();
  const phone = normalizeLebanonPhone(document.querySelector("#regPhone").value);
  const password = document.querySelector("#regPassword").value;
  const confirmPassword = document.querySelector("#regPasswordConfirm").value;
  if (password !== confirmPassword) return alert("Passwords do not match.");
  const button = document.querySelector("#registerWholesaleBtn");
  button.disabled = true;
  button.textContent = "Creating account…";
  const { data, error } = await client.functions.invoke("storefront-services", {
    body: {
      action: "register",
      customer_name: document.querySelector("#regName").value,
      shop_name: document.querySelector("#regShop").value,
      phone,
      address: document.querySelector("#regAddress").value,
      password
    }
  });
  button.disabled = false;
  button.textContent = "Create Account";
  if (error || data?.error) return alert(data?.error || "Could not create the account.");
  document.querySelector("#regPassword").value = "";
  document.querySelector("#regPasswordConfirm").value = "";
  alert(data.message || "Account created. Wait for your WhatsApp code.");
  openWholesaleVerification(phone);
}
async function verifyWholesaleCode(event) {
  event?.preventDefault();
  const client = db();
  const phone = normalizeLebanonPhone(document.querySelector("#verifyPhone").value);
  const code = document.querySelector("#verifyCode").value.trim();
  const { data, error } = await client.functions.invoke("storefront-services", {
    body: { action: "verify", phone, code }
  });
  if (error || data?.error) return alert(data?.error || "Could not verify the code.");
  closeWholesaleVerification();
  document.querySelector("#whUser").value = phone;
  document.querySelector("#verifyCode").value = "";
  openWholesaleLogin();
  alert("Wholesale account activated. Enter your password to login.");
}
function clearWholesaleFields() {
  document.querySelector("#whUser").value = "";
  document.querySelector("#whPass").value = "";
}
async function isWholesaleAuthorized(client) {
  const { data, error } = await client.rpc("is_wholesale_customer");
  return !error && data === true;
}
async function refreshStorefront() {
  products = await getProducts();
  renderProducts();
  renderCart();
}
async function initializeWholesaleSession() {
  const client = db();
  if (!client) return;
  const { data } = await client.auth.getSession();
  if (data.session && await isWholesaleAuthorized(client)) currentRole = "wholesale";
  else if (data.session) await client.auth.signOut({ scope: "local" });
}
async function wholesaleLogin(event) {
  event?.preventDefault();
  const client = db();
  const phone = normalizeLebanonPhone(document.querySelector("#whUser").value);
  const password = document.querySelector("#whPass").value;
  if (!client) return alert("Login service is temporarily unavailable.");
  if (!phone || !password) return alert("Enter phone number and password.");
  const { error } = await client.auth.signInWithPassword({ email: phoneLoginEmail(phone), password });
  if (error || !await isWholesaleAuthorized(client)) {
    await client.auth.signOut({ scope: "local" });
    currentRole = "retail";
    document.querySelector("#whPass").value = "";
    return alert("Phone number or password is incorrect, or this wholesale account is inactive.");
  }
  currentRole = "wholesale";
  clearWholesaleFields();
  await refreshStorefront();
  closeWholesaleLogin();
  alert("Wholesale prices activated until this tab is closed.");
}
async function logoutWholesale() {
  const client = db();
  if (client) await client.auth.signOut({ scope: "local" });
  currentRole = "retail";
  clearWholesaleFields();
  await refreshStorefront();
}
document.addEventListener("input", event => { if (event.target.matches("#search,#foodType")) renderProducts(); });
document.addEventListener("change", event => { if (event.target.matches("#foodType")) renderProducts(); });
document.addEventListener("input", event => {
  if (event.target.matches("#customerName,#customerPhone,#customerAddress")) scheduleCartSync();
});
document.addEventListener("DOMContentLoaded", async () => {
  localStorage.removeItem(ROLE_KEY);
  await initializeWholesaleSession();
  products = await getProducts();
  renderProducts();
  updateCartCount();
});
