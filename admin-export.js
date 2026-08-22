let activeAdminBrandFilter = "";

function normalizeAdminBrand(value) {
  return String(value || "").trim().toUpperCase();
}

function getAdminVisibleProducts() {
  const q = (window.adminSearch?.value || "").trim().toLowerCase();
  const brand = normalizeAdminBrand(activeAdminBrandFilter);
  return products.filter(p => {
    const brandMatch = !brand || normalizeAdminBrand(p.brand) === brand;
    const searchMatch = !q || `${p.id} ${p.barcode} ${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q);
    return brandMatch && searchMatch;
  });
}

function setAdminBrandFilter(brand = "") {
  activeAdminBrandFilter = normalizeAdminBrand(brand);
  document.querySelectorAll("#brandQuickFilters button[data-brand]").forEach(button => {
    const selected = normalizeAdminBrand(button.dataset.brand) === activeAdminBrandFilter;
    button.classList.toggle("btn-primary", selected);
    button.classList.toggle("btn-soft", !selected);
  });
  window.render();
}

function updateAdminBrandCounts() {
  const counts = products.reduce((acc, product) => {
    const brand = normalizeAdminBrand(product.brand) || "OTHER";
    acc[brand] = (acc[brand] || 0) + 1;
    return acc;
  }, {});
  const allButton = document.querySelector('#brandQuickFilters button[data-brand=""]');
  const trixieButton = document.querySelector('#brandQuickFilters button[data-brand="TRIXIE"]');
  const bioformButton = document.querySelector('#brandQuickFilters button[data-brand="BIOFORM"]');
  if (allButton) allButton.textContent = `All (${products.length})`;
  if (trixieButton) trixieButton.textContent = `TRIXIE (${counts.TRIXIE || 0})`;
  if (bioformButton) bioformButton.textContent = `BIOFORM (${counts.BIOFORM || 0})`;
}

function installAdminBrandTools() {
  const search = document.getElementById("adminSearch");
  const exportActions = document.querySelector(".export-actions");
  const headRow = document.querySelector(".table-wrap thead tr");

  if (headRow) {
    headRow.innerHTML = '<th>Image</th><th>Item Code</th><th>Product</th><th>Brand</th><th>Retail</th><th>Wholesale</th><th>Stock</th><th></th>';
  }

  if (search && !document.getElementById("brandQuickFilters")) {
    const filters = document.createElement("div");
    filters.id = "brandQuickFilters";
    filters.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px";
    filters.innerHTML = `
      <strong style="margin-right:2px">Brand:</strong>
      <button type="button" class="btn btn-primary" data-brand="" onclick="setAdminBrandFilter('')">All</button>
      <button type="button" class="btn btn-soft" data-brand="TRIXIE" onclick="setAdminBrandFilter('TRIXIE')">TRIXIE</button>
      <button type="button" class="btn btn-soft" data-brand="BIOFORM" onclick="setAdminBrandFilter('BIOFORM')">BIOFORM</button>
    `;
    search.insertAdjacentElement("afterend", filters);
  }

  if (exportActions && !document.getElementById("exportTrixieBtn")) {
    exportActions.insertAdjacentHTML("beforeend", `
      <button id="exportTrixieBtn" class="btn btn-soft" onclick="exportProducts(false,'TRIXIE')">📦 Export TRIXIE Excel</button>
      <button id="exportBioformBtn" class="btn btn-soft" onclick="exportProducts(false,'BIOFORM')">🐾 Export BIOFORM Excel</button>
    `);
  }

  updateAdminBrandCounts();
}

window.render = function renderAdminProducts() {
  statProducts.textContent = products.length;
  statLow.textContent = products.filter(p => p.stock <= 5).length;
  statStock.textContent = products.reduce((a, p) => a + p.stock, 0);

  const list = getAdminVisibleProducts();
  rows.innerHTML = list.map(p => `<tr>
    <td>${p.image ? `<img class="thumb" src="${p.image}" loading="lazy" onerror="this.replaceWith(document.createTextNode('🐾'))">` : "🐾"}</td>
    <td>${p.id}</td>
    <td><b>${p.name}</b><br><small>${p.category}</small></td>
    <td><b>${p.brand || ""}</b></td>
    <td>${p.retail.toFixed(2)}</td>
    <td>${p.wholesale.toFixed(2)}</td>
    <td>${p.stock}</td>
    <td><button class="btn btn-soft" onclick="openEditor('${p.id}')">Edit</button> <button class="btn btn-soft" onclick="removeProduct('${p.id}')">Delete</button></td>
  </tr>`).join("");
  updateAdminBrandCounts();
};

function getAdminExportProducts(filtered = false, brandOverride = "") {
  const q = filtered ? (window.adminSearch?.value || "").trim().toLowerCase() : "";
  const brand = normalizeAdminBrand(brandOverride || (filtered ? activeAdminBrandFilter : ""));

  const list = products.filter(p => {
    const brandMatch = !brand || normalizeAdminBrand(p.brand) === brand;
    const searchMatch = !q || `${p.id} ${p.barcode} ${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q);
    return brandMatch && searchMatch;
  });

  return list.sort((a, b) => String(a.id || "").localeCompare(String(b.id || ""), "en", { numeric: false, sensitivity: "base" }));
}

async function imageUrlToPngDataUrl(url) {
  if (!url) return null;

  const response = await fetch(url, { mode: "cors", cache: "force-cache" });
  if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image could not be decoded"));
      img.src = objectUrl;
    });

    const size = 120;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);

    const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const x = Math.round((size - width) / 2);
    const y = Math.round((size - height) / 2);
    ctx.drawImage(image, x, y, width, height);

    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function downloadWorkbookBlob(buffer, filename) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.exportProducts = async function exportProducts(filtered = false, brandOverride = "") {
  if (!window.ExcelJS) {
    alert("Excel export is still loading. Please try again in a moment.");
    return;
  }

  const list = getAdminExportProducts(filtered, brandOverride);
  if (!list.length) {
    alert("No products to export.");
    return;
  }

  const brand = normalizeAdminBrand(brandOverride || (filtered ? activeAdminBrandFilter : ""));
  const buttonId = brandOverride === "TRIXIE"
    ? "exportTrixieBtn"
    : brandOverride === "BIOFORM"
      ? "exportBioformBtn"
      : filtered ? "exportFilteredBtn" : "exportAllBtn";
  const button = document.getElementById(buttonId);
  const originalText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Preparing Excel…";
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sojepharm Admin";
    workbook.created = new Date();

    const sheetName = brand ? `${brand} Price List`.slice(0, 31) : "Price List";
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 1 }]
    });

    sheet.columns = [
      { header: "Image", key: "image", width: 16 },
      { header: "Item Code", key: "item_code", width: 18 },
      { header: "Barcode", key: "barcode", width: 20 },
      { header: "Product", key: "product", width: 42 },
      { header: "Brand", key: "brand", width: 18 },
      { header: "Category", key: "category", width: 28 },
      { header: "Wholesale", key: "wholesale", width: 14 },
      { header: "Retail", key: "retail", width: 14 },
      { header: "Stock", key: "stock", width: 11 },
      { header: "Active", key: "active", width: 11 }
    ];

    const header = sheet.getRow(1);
    header.font = { bold: true };
    header.alignment = { vertical: "middle", horizontal: "center" };
    header.height = 24;
    sheet.autoFilter = { from: "A1", to: "J1" };

    let embeddedImages = 0;
    let skippedImages = 0;

    for (let index = 0; index < list.length; index++) {
      const p = list[index];
      const row = sheet.addRow({
        image: "",
        item_code: String(p.id || ""),
        barcode: String(p.barcode || ""),
        product: p.name || "",
        brand: p.brand || "",
        category: p.category || "",
        wholesale: Number(p.wholesale || 0),
        retail: Number(p.retail || 0),
        stock: Number(p.stock || 0),
        active: p.active === false ? "No" : "Yes"
      });

      row.height = 74;
      row.alignment = { vertical: "middle", wrapText: true };
      row.getCell(2).numFmt = "@";
      row.getCell(3).numFmt = "@";
      row.getCell(7).numFmt = "0.00";
      row.getCell(8).numFmt = "0.00";
      row.getCell(9).numFmt = "0";

      if (p.image) {
        try {
          const dataUrl = await imageUrlToPngDataUrl(p.image);
          if (dataUrl) {
            const imageId = workbook.addImage({ base64: dataUrl, extension: "png" });
            sheet.addImage(imageId, {
              tl: { col: 0.15, row: row.number - 0.9 },
              ext: { width: 82, height: 82 },
              editAs: "oneCell"
            });
            embeddedImages++;
          }
        } catch (error) {
          skippedImages++;
          console.warn("Excel export skipped image", p.id, error);
        }
      }

      if (button && (index % 10 === 0 || index === list.length - 1)) {
        button.textContent = `Preparing ${index + 1}/${list.length}…`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    sheet.getColumn(4).alignment = { vertical: "middle", wrapText: true };
    sheet.getColumn(5).alignment = { vertical: "middle", wrapText: true };
    sheet.getColumn(6).alignment = { vertical: "middle", wrapText: true };
    sheet.getColumn(7).alignment = { vertical: "middle", horizontal: "right" };
    sheet.getColumn(8).alignment = { vertical: "middle", horizontal: "right" };
    sheet.getColumn(9).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getColumn(10).alignment = { vertical: "middle", horizontal: "center" };

    const date = new Date().toISOString().slice(0, 10);
    const brandSuffix = brand ? `-${brand}` : "";
    const filterSuffix = filtered && (window.adminSearch?.value || "").trim() ? "-Filtered" : "";
    const filename = `Sojepharm${brandSuffix}-Price-List${filterSuffix}-${date}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbookBlob(buffer, filename);

    const imageNote = skippedImages
      ? ` ${embeddedImages} images were embedded; ${skippedImages} image(s) could not be downloaded.`
      : ` ${embeddedImages} images were embedded.`;
    alert(`Excel exported: ${list.length} products.${imageNote}`);
  } catch (error) {
    console.error("Excel export failed", error);
    alert("Could not create the Excel file. Please try again.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
};

window.setAdminBrandFilter = setAdminBrandFilter;

document.addEventListener("DOMContentLoaded", installAdminBrandTools);
