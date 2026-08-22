function getAdminExportProducts(filtered = false) {
  const q = filtered ? (window.adminSearch?.value || "").trim().toLowerCase() : "";
  const list = !q
    ? [...products]
    : products.filter(p => `${p.id} ${p.barcode} ${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q));

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

async function exportProducts(filtered = false) {
  if (!window.ExcelJS) {
    alert("Excel export is still loading. Please try again in a moment.");
    return;
  }

  const list = getAdminExportProducts(filtered);
  if (!list.length) {
    alert("No products to export.");
    return;
  }

  const buttonId = filtered ? "exportFilteredBtn" : "exportAllBtn";
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

    const sheet = workbook.addWorksheet("Price List", {
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
    const suffix = filtered && (window.adminSearch?.value || "").trim() ? "-Filtered" : "";
    const filename = `Sojepharm-Price-List${suffix}-${date}.xlsx`;
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
}
