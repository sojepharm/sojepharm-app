import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "https://petunleash.com",
  "https://www.petunleash.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://petunleash.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function normalizePhone(value: unknown) {
  const raw = String(value ?? "").trim().replace(/[\s().-]/g, "");
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return `+${raw.slice(2)}`;
  if (raw.startsWith("961")) return `+${raw}`;
  if (raw.startsWith("0")) return `+961${raw.slice(1)}`;
  return `+961${raw}`;
}

function loginEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.petunleash.invalid`;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requestUser(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.startsWith("sb_")) return null;
  const { data } = await admin.auth.getUser(token);
  return data.user ?? null;
}

async function register(req: Request, body: Record<string, unknown>) {
  const customerName = String(body.customer_name ?? "").trim().slice(0, 120);
  const shopName = String(body.shop_name ?? "").trim().slice(0, 120);
  const address = String(body.address ?? "").trim().slice(0, 300);
  const phone = normalizePhone(body.phone);
  const password = String(body.password ?? "");

  if (customerName.length < 2 || shopName.length < 2 || !/^\+\d{8,15}$/.test(phone)) {
    return json(req, { error: "Enter a valid name, shop name and phone number." }, 400);
  }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return json(req, { error: "Password must be at least 10 characters and include letters and numbers." }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "unknown").split(",")[0].trim();
  const ipHash = await sha256(ip);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("wholesale_registrations")
    .select("id", { count: "exact", head: true })
    .eq("request_ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) return json(req, { error: "Too many registration attempts. Try again later." }, 429);

  const { data: existing } = await admin.from("wholesale_registrations")
    .select("verified_at,expires_at")
    .eq("phone", phone)
    .maybeSingle();
  if (existing?.verified_at) return json(req, { error: "This phone already has a wholesale account. Use Login." }, 409);
  if (existing) return json(req, { ok: true, pending: true, message: "Your request is already waiting for WhatsApp verification." });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: loginEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { customer_name: customerName, shop_name: shopName, phone },
  });
  if (createError || !created.user) {
    const message = createError?.message?.toLowerCase().includes("already") ?
      "This phone already has an account. Use Login or contact Pet Unleash." :
      "Could not create the account. Please try again.";
    return json(req, { error: message }, 400);
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await admin.from("wholesale_registrations").insert({
    user_id: created.user.id,
    customer_name: customerName,
    shop_name: shopName,
    phone,
    address,
    verification_code: code,
    request_ip_hash: ipHash,
    expires_at: expiresAt,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json(req, { error: "Could not save the registration. Please try again." }, 500);
  }
  return json(req, { ok: true, pending: true, message: "Account created. Wait for your WhatsApp verification code." });
}

async function verify(req: Request, body: Record<string, unknown>) {
  const phone = normalizePhone(body.phone);
  const code = String(body.code ?? "").trim();
  if (!/^\+\d{8,15}$/.test(phone) || !/^\d{6}$/.test(code)) {
    return json(req, { error: "Enter your phone number and the 6-digit code." }, 400);
  }

  const { data: registration } = await admin.from("wholesale_registrations")
    .select("id,user_id,customer_name,verification_code,expires_at,attempts,verified_at")
    .eq("phone", phone)
    .maybeSingle();
  if (!registration) return json(req, { error: "Registration not found." }, 404);
  if (registration.verified_at) return json(req, { ok: true, verified: true });
  if (registration.attempts >= 5) return json(req, { error: "Too many wrong codes. Contact Pet Unleash." }, 429);
  if (new Date(registration.expires_at).getTime() < Date.now()) return json(req, { error: "This code expired. Contact Pet Unleash." }, 410);
  if (registration.verification_code !== code) {
    await admin.from("wholesale_registrations").update({ attempts: registration.attempts + 1, updated_at: new Date().toISOString() }).eq("id", registration.id);
    return json(req, { error: "Wrong verification code." }, 400);
  }

  const { error: accountError } = await admin.from("wholesale_accounts").upsert({
    user_id: registration.user_id,
    customer_name: registration.customer_name,
    active: true,
    updated_at: new Date().toISOString(),
  });
  if (accountError) return json(req, { error: "Could not activate the account." }, 500);
  await admin.from("wholesale_registrations").update({
    verified_at: new Date().toISOString(),
    verification_code: "USED",
    updated_at: new Date().toISOString(),
  }).eq("id", registration.id);
  return json(req, { ok: true, verified: true });
}

async function syncCart(req: Request, body: Record<string, unknown>) {
  const visitorId = String(body.visitor_id ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
    return json(req, { error: "Invalid visitor." }, 400);
  }
  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  const items = rawItems.map((item: Record<string, unknown>) => ({
    item_code: String(item.item_code ?? "").slice(0, 80),
    product_name: String(item.product_name ?? "").slice(0, 200),
    quantity: Math.max(1, Math.min(999, Number(item.quantity) || 1)),
    unit_price: Math.max(0, Number(item.unit_price) || 0),
  })).filter((item) => item.item_code && item.product_name);

  const user = await requestUser(req);
  const status = body.status === "submitted" ? "submitted" : "draft";
  const customerType = body.customer_type === "wholesale" && user ? "wholesale" : "retail";
  const cartRecord = {
    visitor_id: visitorId,
    user_id: user?.id ?? null,
    customer_name: String(body.customer_name ?? "").trim().slice(0, 120) || null,
    customer_phone: normalizePhone(body.customer_phone) || null,
    customer_address: String(body.customer_address ?? "").trim().slice(0, 300) || null,
    customer_type: customerType,
    status,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error: cartError } = await admin.from("live_carts")
    .upsert(cartRecord, { onConflict: "visitor_id" })
    .select("id")
    .single();
  if (cartError || !saved) return json(req, { error: "Could not sync cart." }, 500);

  await admin.from("live_cart_items").delete().eq("cart_id", saved.id);
  if (items.length) {
    const { error: itemError } = await admin.from("live_cart_items").insert(items.map((item) => ({ ...item, cart_id: saved.id })));
    if (itemError) return json(req, { error: "Could not sync cart items." }, 500);
  }
  return json(req, { ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  try {
    const body = await req.json();
    const action = String(body?.action ?? "");
    if (action === "register") return await register(req, body);
    if (action === "verify") return await verify(req, body);
    if (action === "sync_cart") return await syncCart(req, body);
    return json(req, { error: "Unknown action." }, 400);
  } catch {
    return json(req, { error: "Invalid request." }, 400);
  }
});
