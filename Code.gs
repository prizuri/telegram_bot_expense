const TRANSACTION_SHEET_NAME = "Transactions";
const BUDGET_SHEET_NAME = "Budget";
const TIMEZONE = "Asia/Jakarta";
const LARGE_TRANSACTION_LIMIT = 1000000;

function getProp(name, fallback = "") {
  return String(PropertiesService.getScriptProperties().getProperty(name) || fallback).trim();
}

function getBotToken() {
  return getProp("BOT_TOKEN");
}

function getAllowedUserIds() {
  const raw = getProp("ALLOWED_USER_IDS");
  return raw.split(",").map(x => x.trim()).filter(Boolean);
}

function getWebhookSecret() {
  return getProp("WEBHOOK_SECRET");
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}

function txSheet() {
  return getOrCreateSheet(TRANSACTION_SHEET_NAME, [
    "ID",
    "Tanggal",
    "Waktu Input",
    "Nama Pengeluaran",
    "Kategori",
    "Subkategori",
    "Alokasi",
    "Nominal",
    "Catatan",
    "User ID",
    "Sumber"
  ]);
}

function budgetSheet() {
  return getOrCreateSheet(BUDGET_SHEET_NAME, [
    "User ID",
    "Bulan",
    "Tahun",
    "Budget"
  ]);
}

function rowsToObjects(sheet) {
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];

  return values.slice(1)
    .filter(row => row.join("") !== "")
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
}

function nowDate() {
  return new Date();
}

function todayYmd() {
  return Utilities.formatDate(nowDate(), TIMEZONE, "yyyy-MM-dd");
}

function currentMonth() {
  return Number(Utilities.formatDate(nowDate(), TIMEZONE, "M"));
}

function currentYear() {
  return Number(Utilities.formatDate(nowDate(), TIMEZONE, "yyyy"));
}

function normalizeYmd(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, TIMEZONE, "yyyy-MM-dd");
  }

  return String(value || "").slice(0, 10);
}

function rupiah(value) {
  const number = Number(value || 0);
  return "Rp" + number.toLocaleString("id-ID");
}

function sendMessage(chatId, text) {
  const token = getBotToken();

  if (!token) {
    Logger.log("BOT_TOKEN kosong.");
    return;
  }

  const url = "https://api.telegram.org/bot" + token + "/sendMessage";
  const message = String(text || "");

  const maxLength = 3500;
  const parts = [];

  for (let i = 0; i < message.length; i += maxLength) {
    parts.push(message.substring(i, i + maxLength));
  }

  parts.forEach(part => {
    const payload = {
      chat_id: chatId,
      text: part
    };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    Logger.log("sendMessage response: " + response.getContentText());
  });
}

const CATEGORY_RULES = [
  {
    category: "Kebutuhan wajib",
    subcategory: "Makanan & Minuman",
    allocation: "Operasional",
    keywords: ["makan", "makanan", "minum", "minuman", "nasi", "kopi", "teh", "sarapan", "ayam", "geprek", "bakso", "mie", "roti", "lauk", "warung"]
  },
  {
    category: "Kebutuhan wajib",
    subcategory: "Belanja Harian",
    allocation: "Operasional",
    keywords: ["belanja harian", "beras", "telur", "sayur", "sabun", "deterjen", "galon", "gas", "minyak goreng", "kebutuhan rumah"]
  },
  {
    category: "Kebutuhan wajib",
    subcategory: "Transportasi",
    allocation: "Operasional",
    keywords: ["bensin", "grab", "gojek", "maxim", "parkir", "tol", "angkot", "bus", "kereta", "ojek", "taksi", "transportasi"]
  },
  {
    category: "Kebutuhan wajib",
    subcategory: "Utilities (internet, pakaian kerja, alat kerja)",
    allocation: "Operasional",
    keywords: ["internet", "wifi", "pulsa", "paket data", "kuota", "pakaian kerja", "alat kerja", "listrik", "air", "pln", "pdam"]
  },
  {
    category: "Kebutuhan wajib",
    subcategory: "Sewa / Kos",
    allocation: "Operasional",
    keywords: ["sewa", "kos", "kost", "kontrakan", "bayar kos", "bayar kost"]
  },

  {
    category: "Gaya hidup",
    subcategory: "Jajanan",
    allocation: "Operasional",
    keywords: ["jajan", "jajanan", "snack", "cemilan", "martabak", "gorengan", "es teh", "boba"]
  },
  {
    category: "Gaya hidup",
    subcategory: "Hiburan & Keperluannya",
    allocation: "Operasional",
    keywords: ["hiburan", "nonton", "bioskop", "film", "game", "netflix", "spotify", "karaoke", "konser"]
  },
  {
    category: "Gaya hidup",
    subcategory: "Nongkrong / Cafe",
    allocation: "Operasional",
    keywords: ["nongkrong", "cafe", "kafe", "starbucks", "kopi kenangan", "janji jiwa", "coffee shop"]
  },
  {
    category: "Gaya hidup",
    subcategory: "Belanja Impulsif",
    allocation: "Operasional",
    keywords: ["impulsif", "checkout", "shopee", "tokopedia", "lazada", "tiktok shop", "beli random", "promo"]
  },

  {
    category: "Pengembangan diri",
    subcategory: "Kursus",
    allocation: "Operasional",
    keywords: ["kursus", "kelas online", "bootcamp", "pelatihan"]
  },
  {
    category: "Pengembangan diri",
    subcategory: "Buku",
    allocation: "Operasional",
    keywords: ["buku", "ebook", "e-book", "novel", "modul"]
  },
  {
    category: "Pengembangan diri",
    subcategory: "Seminar / Workshop",
    allocation: "Operasional",
    keywords: ["seminar", "workshop", "webinar", "konferensi"]
  },
  {
    category: "Pengembangan diri",
    subcategory: "Tools Belajar",
    allocation: "Operasional",
    keywords: ["tools belajar", "software belajar", "aplikasi belajar", "chatgpt", "canva", "notion", "grammarly"]
  },

  {
    category: "Kesehatan & Olahraga",
    subcategory: "Olahraga",
    allocation: "Operasional",
    keywords: ["olahraga", "futsal", "badminton", "renang", "lari", "sepeda"]
  },
  {
    category: "Kesehatan & Olahraga",
    subcategory: "Gym",
    allocation: "Operasional",
    keywords: ["gym", "fitness", "membership gym"]
  },
  {
    category: "Kesehatan & Olahraga",
    subcategory: "Suplemen",
    allocation: "Operasional",
    keywords: ["suplemen", "whey", "protein", "creatine", "vitamin"]
  },
  {
    category: "Kesehatan & Olahraga",
    subcategory: "Kesehatan (dokter, obat)",
    allocation: "Operasional",
    keywords: ["dokter", "obat", "klinik", "rumah sakit", "apotik", "periksa", "kesehatan"]
  },

  {
    category: "Sosial & Spiritual",
    subcategory: "Infaq",
    allocation: "Sosial",
    keywords: ["infaq", "infak"]
  },
  {
    category: "Sosial & Spiritual",
    subcategory: "Sedekah",
    allocation: "Sosial",
    keywords: ["sedekah", "shadaqah"]
  },
  {
    category: "Sosial & Spiritual",
    subcategory: "Zakat",
    allocation: "Sosial",
    keywords: ["zakat"]
  },
  {
    category: "Sosial & Spiritual",
    subcategory: "Fidyah",
    allocation: "Sosial",
    keywords: ["fidyah"]
  },
  {
    category: "Sosial & Spiritual",
    subcategory: "Hadiah untuk Orang Lain",
    allocation: "Sosial",
    keywords: ["hadiah", "kado", "gift", "traktir", "oleh-oleh"]
  },

  {
    category: "Keuangan",
    subcategory: "Hutang (bayar cicilan)",
    allocation: "Operasional",
    keywords: ["hutang", "utang", "cicilan", "angsuran", "paylater", "pinjol"]
  },
  {
    category: "Keuangan",
    subcategory: "Memberi Pinjaman",
    allocation: "Tabungan",
    keywords: ["memberi pinjaman", "pinjamkan", "dipinjam", "kasih pinjam"]
  },
  {
    category: "Keuangan",
    subcategory: "Biaya Admin Bank",
    allocation: "Operasional",
    keywords: ["admin bank", "biaya admin", "admin bca", "admin bri", "admin mandiri", "transfer bank"]
  },

  {
    category: "Penyesuaian",
    subcategory: "Lupa Catat",
    allocation: "Penyesuaian",
    keywords: ["lupa catat", "lupa input"]
  },
  {
    category: "Penyesuaian",
    subcategory: "Koreksi",
    allocation: "Penyesuaian",
    keywords: ["koreksi", "ralat", "ubah catatan"]
  },
  {
    category: "Penyesuaian",
    subcategory: "Selisih",
    allocation: "Penyesuaian",
    keywords: ["selisih", "beda saldo", "selisih saldo"]
  },

  {
    category: "Investasi",
    subcategory: "Beli Saham",
    allocation: "Investasi",
    keywords: ["saham", "beli saham", "stock"]
  },
  {
    category: "Investasi",
    subcategory: "Beli Emas",
    allocation: "Investasi",
    keywords: ["emas", "beli emas", "logam mulia"]
  },
  {
    category: "Investasi",
    subcategory: "Reksadana",
    allocation: "Investasi",
    keywords: ["reksadana", "reksa dana", "rdpu", "rdpt"]
  },

  {
    category: "Dana Darurat",
    subcategory: "Top up Dana Darurat",
    allocation: "Dana Darurat",
    keywords: ["top up dana darurat", "tambah dana darurat", "isi dana darurat"]
  },
  {
    category: "Dana Darurat",
    subcategory: "Tarik Dana Darurat",
    allocation: "Dana Darurat",
    keywords: ["tarik dana darurat", "ambil dana darurat", "pakai dana darurat"]
  }
];

function detectCategoryInfo(text) {
  const lower = String(text || "").toLowerCase().trim();

  for (const rule of CATEGORY_RULES) {
    if (lower.startsWith(rule.subcategory.toLowerCase() + ":")) {
      return rule;
    }
  }

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        return rule;
      }
    }
  }

  return {
    category: "Penyesuaian",
    subcategory: "Lupa Catat",
    allocation: "Penyesuaian",
    keywords: []
  };
}

function parseAmount(text) {
  let s = String(text || "").toLowerCase();
  s = s.replace(/rp/g, "").replace(/rupiah/g, "");

  let m = s.match(/(\d+(?:[,.]\d+)?)\s*juta/);
  if (m) {
    return Math.round(Number(m[1].replace(",", ".")) * 1000000);
  }

  m = s.match(/(\d+(?:[,.]\d+)?)\s*(rb|ribu|k)\b/);
  if (m) {
    return Math.round(Number(m[1].replace(",", ".")) * 1000);
  }

  m = s.match(/\b\d[\d.]*\b/);
  if (m) {
    return Number(m[0].replace(/\./g, ""));
  }

  return null;
}

function parseDate(text) {
  const s = String(text || "").toLowerCase();
  const now = nowDate();

  if (s.includes("kemarin")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd");
  }

  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    const year = Number(slash[3]);
    return Utilities.formatDate(new Date(year, month, day), TIMEZONE, "yyyy-MM-dd");
  }

  const months = {
    "januari": 0,
    "februari": 1,
    "maret": 2,
    "april": 3,
    "mei": 4,
    "juni": 5,
    "juli": 6,
    "agustus": 7,
    "september": 8,
    "oktober": 9,
    "november": 10,
    "desember": 11
  };

  const word = s.match(/\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+(\d{4})\b/);
  if (word) {
    const day = Number(word[1]);
    const month = months[word[2]];
    const year = Number(word[3]);
    return Utilities.formatDate(new Date(year, month, day), TIMEZONE, "yyyy-MM-dd");
  }

  return todayYmd();
}

function cleanName(text) {
  let s = String(text || "");

  for (const rule of CATEGORY_RULES) {
    if (s.toLowerCase().startsWith(rule.subcategory.toLowerCase() + ":")) {
      s = s.slice(rule.subcategory.length + 1).trim();
    }
  }

  s = s.replace(/rp\s*\d[\d.]*/gi, "");
  s = s.replace(/\d+(?:[,.]\d+)?\s*juta/gi, "");
  s = s.replace(/\d+(?:[,.]\d+)?\s*(rb|ribu|k)\b/gi, "");
  s = s.replace(/\b\d[\d.]*\b/g, "");
  s = s.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, "");

  const removeWords = [
    "hari ini", "kemarin", "tadi pagi", "tadi sore", "tadi malam",
    "keluar", "untuk", "bayar", "saya", "beli"
  ];

  removeWords.forEach(word => {
    s = s.replace(new RegExp(word, "gi"), "");
  });

  s = s.replace(/\s+/g, " ").trim();

  return s || "Pengeluaran";
}

function parseExpense(text) {
  const info = detectCategoryInfo(text);

  return {
    transaction_date: parseDate(text),
    expense_name: cleanName(text),
    category: info.category,
    subcategory: info.subcategory,
    allocation: info.allocation,
    amount: parseAmount(text),
    note: "-"
  };
}

function appendTransaction(data) {
  const sheet = txSheet();
  const records = rowsToObjects(sheet);
  const id = records.length + 1;
  const time = Utilities.formatDate(nowDate(), TIMEZONE, "HH:mm:ss");

  sheet.appendRow([
    id,
    data.transaction_date,
    time,
    data.expense_name,
    data.category,
    data.subcategory,
    data.allocation,
    Number(data.amount),
    data.note || "-",
    data.user_id,
    "Telegram"
  ]);

  return {
    id: id,
    transaction_date: data.transaction_date,
    expense_name: data.expense_name,
    category: data.category,
    subcategory: data.subcategory,
    allocation: data.allocation,
    amount: Number(data.amount),
    note: data.note || "-",
    user_id: data.user_id
  };
}

function getAllTransactions() {
  return rowsToObjects(txSheet());
}

function getUserTransactions(userId) {
  return getAllTransactions().filter(row => String(row["User ID"]) === String(userId));
}

function updateLastTransactionAmount(userId, amount) {
  const sheet = txSheet();

  for (let row = sheet.getLastRow(); row >= 2; row--) {
    const rowUserId = String(sheet.getRange(row, 10).getValue());

    if (rowUserId === String(userId)) {
      sheet.getRange(row, 8).setValue(Number(amount));
      return true;
    }
  }

  return false;
}

function deleteLastTransaction(userId) {
  const sheet = txSheet();

  for (let row = sheet.getLastRow(); row >= 2; row--) {
    const rowUserId = String(sheet.getRange(row, 10).getValue());

    if (rowUserId === String(userId)) {
      sheet.deleteRow(row);
      return true;
    }
  }

  return false;
}

function setBudget(userId, month, year, amount) {
  const sheet = budgetSheet();

  for (let row = 2; row <= sheet.getLastRow(); row++) {
    const rowUserId = String(sheet.getRange(row, 1).getValue());
    const rowMonth = Number(sheet.getRange(row, 2).getValue());
    const rowYear = Number(sheet.getRange(row, 3).getValue());

    if (
      rowUserId === String(userId) &&
      rowMonth === Number(month) &&
      rowYear === Number(year)
    ) {
      sheet.getRange(row, 4).setValue(Number(amount));
      return true;
    }
  }

  sheet.appendRow([
    userId,
    Number(month),
    Number(year),
    Number(amount)
  ]);

  return true;
}

function getBudget(userId, month, year) {
  const sheet = budgetSheet();

  for (let row = 2; row <= sheet.getLastRow(); row++) {
    const rowUserId = String(sheet.getRange(row, 1).getValue());
    const rowMonth = Number(sheet.getRange(row, 2).getValue());
    const rowYear = Number(sheet.getRange(row, 3).getValue());

    if (
      rowUserId === String(userId) &&
      rowMonth === Number(month) &&
      rowYear === Number(year)
    ) {
      return Number(sheet.getRange(row, 4).getValue());
    }
  }

  return 0;
}

function isThisMonth(dateText) {
  const ymd = normalizeYmd(dateText);
  const parts = ymd.split("-");

  if (parts.length < 3) {
    return false;
  }

  return Number(parts[0]) === currentYear() && Number(parts[1]) === currentMonth();
}

function totalToday(userId) {
  const today = todayYmd();
  return getUserTransactions(userId)
    .filter(row => normalizeYmd(row["Tanggal"]) === today)
    .reduce((sum, row) => sum + Number(row["Nominal"] || 0), 0);
}

function totalThisMonth(userId) {
  return getUserTransactions(userId)
    .filter(row => isThisMonth(row["Tanggal"]))
    .reduce((sum, row) => sum + Number(row["Nominal"] || 0), 0);
}

function totalThisWeek(userId) {
  const now = nowDate();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  return getUserTransactions(userId).reduce((sum, row) => {
    const ymd = normalizeYmd(row["Tanggal"]);
    const d = new Date(ymd + "T00:00:00");

    if (d >= start) {
      return sum + Number(row["Nominal"] || 0);
    }

    return sum;
  }, 0);
}

function summaryByCategory(userId) {
  const summary = {};

  getUserTransactions(userId)
    .filter(row => isThisMonth(row["Tanggal"]))
    .forEach(row => {
      const category = row["Kategori"] || "Lainnya";
      summary[category] = (summary[category] || 0) + Number(row["Nominal"] || 0);
    });

  return summary;
}
function summaryByField(userId, fieldName) {
  const summary = {};

  getUserTransactions(userId)
    .filter(row => isThisMonth(row["Tanggal"]))
    .forEach(row => {
      const key = row[fieldName] || "Tidak diketahui";
      summary[key] = (summary[key] || 0) + Number(row["Nominal"] || 0);
    });

  return summary;
}

function formatSummary(title, summary) {
  const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return "Belum ada data pengeluaran bulan ini.";
  }

  return title + "\n" +
    entries.map(([k, v]) => "- " + k + ": " + rupiah(v)).join("\n");
}

function lastTransactions(userId, limit) {
  const records = getUserTransactions(userId);
  return records.slice(-limit);
}

function biggestTransaction(userId) {
  const records = getUserTransactions(userId);

  if (!records.length) {
    return null;
  }

  return records.reduce((best, row) => {
    return Number(row["Nominal"] || 0) > Number(best["Nominal"] || 0) ? row : best;
  }, records[0]);
}

function formatSaved(saved) {
  return (
    "Pengeluaran berhasil dicatat:\n" +
    "Tanggal: " + saved.transaction_date + "\n" +
    "Nama: " + saved.expense_name + "\n" +
    "Kategori: " + saved.category + "\n" +
    "Subkategori: " + saved.subcategory + "\n" +
    "Alokasi: " + saved.allocation + "\n" +
    "Nominal: " + rupiah(saved.amount)
  );
}

function helpMessage() {
  return (
    "Panduan singkat bot:\n\n" +
    "Catat pengeluaran:\n" +
    "makan siang 25000\n" +
    "bensin 50000\n" +
    "kopi 18k tadi sore\n\n" +

    "Input manual subkategori:\n" +
    "Jajanan: bakso 10000\n" +
    "Transportasi: bensin 50000\n" +
    "Infaq: masjid 50000\n\n" +

    "Perintah utama:\n" +
    "/hariini\n" +
    "/mingguini\n" +
    "/bulanini\n" +
    "/rekap\n" +
    "/kategori\n" +
    "/subkategori\n" +
    "/alokasi\n" +
    "/terakhir\n" +
    "/hapus_terakhir\n" +
    "/ubah_terakhir 30000\n" +
    "/budget 3000000\n" +
    "/cek_budget\n" +
    "/insight\n" +
    "/export\n" +
    "/batal\n\n" +

    "Jika bot menunggu nominal atau konfirmasi, ketik /batal."
  );
}

function getCommand(text) {
  const firstWord = String(text || "").trim().toLowerCase().split(/\s+/)[0] || "";
  return firstWord.split("@")[0];
}
function processCommand(userId, text) {
  const lower = String(text || "").toLowerCase().trim();
  const command = getCommand(text);

  if (command === "/start" || lower === "start") {
    return (
      "Halo. Bot pencatat pengeluaran aktif.\n\n" +
      "Contoh:\n" +
      "makan siang 25000\n" +
      "bensin 50000\n\n" +
      "Ketik /menu untuk melihat perintah."
    );
  }

  if (command === "/help" || command === "/panduan" || lower === "help") {
    return helpMessage();
  }

  if (command === "/hariini") {
    return "Total pengeluaran hari ini: " + rupiah(totalToday(userId));
  }

  if (command === "/mingguini") {
    return "Total pengeluaran minggu ini: " + rupiah(totalThisWeek(userId));
  }

  if (command=== "/bulanini") {
    return "Total pengeluaran bulan ini: " + rupiah(totalThisMonth(userId));
  }

  if (command=== "/rekap" || lower === "/kategori") {
  return formatSummary(
    "Rekap pengeluaran berdasarkan kategori:",
    summaryByField(userId, "Kategori")
  );
}

if (command=== "/subkategori") {
  return formatSummary(
    "Rekap pengeluaran berdasarkan subkategori:",
    summaryByField(userId, "Subkategori")
  );
}

if (command=== "/alokasi") {
  return formatSummary(
    "Rekap pengeluaran berdasarkan alokasi:",
    summaryByField(userId, "Alokasi")
  );
}

  if (command === "/terbesar") {
    const row = biggestTransaction(userId);

    if (!row) {
      return "Belum ada data transaksi.";
    }

    return (
      "Pengeluaran terbesar:\n" +
      "Tanggal: " + normalizeYmd(row["Tanggal"]) + "\n" +
      "Nama: " + row["Nama Pengeluaran"] + "\n" +
      "Kategori: " + row["Kategori"] + "\n" +
      "Nominal: " + rupiah(row["Nominal"])
    );
  }

  if (command=== "/terakhir") {
    const rows = lastTransactions(userId, 5);

    if (!rows.length) {
      return "Belum ada transaksi terakhir.";
    }

    return "5 transaksi terakhir:\n" +
      rows.map(row =>
        "- " + normalizeYmd(row["Tanggal"]) +
        " | " + row["Nama Pengeluaran"] +
        " | " + rupiah(row["Nominal"])
      ).join("\n");
  }

  if (command=== "/hapus_terakhir" || lower === "hapus terakhir") {
    return deleteLastTransaction(userId)
      ? "Transaksi terakhir berhasil dihapus."
      : "Tidak ada transaksi yang dapat dihapus.";
  }

  if (command === "/ubah_terakhir" || lower.startsWith("ubah terakhir")) {
    const amount = parseAmount(text);

    if (!amount) {
      return "Format belum benar. Contoh: /ubah_terakhir 30000";
    }

    return updateLastTransactionAmount(userId, amount)
      ? "Nominal transaksi terakhir berhasil diubah menjadi " + rupiah(amount) + "."
      : "Tidak ada transaksi yang dapat diubah.";
  }

  if (command === "/budget") {
    const amount = parseAmount(text);

    if (!amount) {
      return "Format belum benar. Contoh: /budget 3000000";
    }

    setBudget(userId, currentMonth(), currentYear(), amount);
    return "Budget bulanan berhasil diatur sebesar " + rupiah(amount) + ".";
  }

  if (lower === "/cek_budget") {
    const budget = getBudget(userId, currentMonth(), currentYear());
    const total = totalThisMonth(userId);

    if (budget <= 0) {
      return "Budget bulan ini belum diatur. Gunakan: /budget 3000000";
    }

    const remaining = budget - total;
    const percent = total / budget * 100;

    return (
      "Budget bulan ini: " + rupiah(budget) + "\n" +
      "Pengeluaran saat ini: " + rupiah(total) + "\n" +
      "Sisa budget: " + rupiah(remaining) + "\n" +
      "Persentase terpakai: " + percent.toFixed(1) + "%"
    );
  }

  if (lower === "/insight") {
    const total = totalThisMonth(userId);
    const summary = summaryByCategory(userId);
    const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);

    const biggest = entries.length ? entries[0] : ["-", 0];
    const day = Number(Utilities.formatDate(nowDate(), TIMEZONE, "d"));
    const average = total / Math.max(day, 1);

    const budget = getBudget(userId, currentMonth(), currentYear());
    const budgetText = budget > 0
      ? "\nBudget terpakai: " + (total / budget * 100).toFixed(1) + "%"
      : "";

    return (
      "Insight pengeluaran bulan ini:\n" +
      "Total pengeluaran: " + rupiah(total) + "\n" +
      "Kategori terbesar: " + biggest[0] + " sebesar " + rupiah(biggest[1]) + "\n" +
      "Rata-rata harian: " + rupiah(average) +
      budgetText +
      "\n\nCatatan:\nPantau pengeluaran harian secara rutin agar budget lebih terkendali."
    );
  }

  if (lower === "/export") {
    return SpreadsheetApp.getActiveSpreadsheet().getUrl();
  }

  return "";
}

function getCacheKey(type, userId) {
  return type + "_" + userId;
}

function saveExpense(userId, text) {
  const data = parseExpense(text);

  if (!data.amount) {
    return (
      "Format belum lengkap atau nominal belum terbaca.\n\n" +
      "Contoh:\n" +
      "makan malam 10000\n" +
      "bensin 50000\n" +
      "kopi 18k tadi sore\n\n" +
      "Ketik /menu untuk melihat panduan."
    );
  }

  data.user_id = userId;

  const saved = appendTransaction(data);

  if (Number(data.amount) >= LARGE_TRANSACTION_LIMIT) {
    return (
      "Peringatan: nominal yang dicatat cukup besar.\n\n" +
      formatSaved(saved)
    );
  }

  return formatSaved(saved);
}

function handleLine(userId, text) {
  const cleanText = String(text || "").trim();
  const lower = cleanText.toLowerCase();
  const command = getCommand(cleanText);

  if (!cleanText) {
    return "";
  }

  if (command === "/batal" || lower === "batal") {
    clearUserState(userId);
    return "Input yang tertunda sudah dibatalkan.";
  }

  if (cleanText.startsWith("/")) {
    const commandResponse = processCommand(userId, cleanText);

    if (commandResponse) {
      return commandResponse;
    }

    return "Perintah tidak dikenal. Ketik /menu untuk melihat panduan.";
  }

  return saveExpense(userId, cleanText);
}

function clearUserState(userId) {
  const cache = CacheService.getScriptCache();
  cache.remove(getCacheKey("pending", userId));
  cache.remove(getCacheKey("confirm", userId));
  Logger.log("State dibersihkan untuk user: " + userId);
}

function menuMessage() {
  return (
    "MENU BOT PENGELUARAN\n\n" +
    "Catat pengeluaran:\n" +
    "makan siang 25000\n" +
    "bensin 50000\n" +
    "kopi 18k tadi sore\n\n" +

    "Subkategori manual:\n" +
    "Jajanan: bakso 10000\n" +
    "Transportasi: bensin 50000\n" +
    "Infaq: masjid 50000\n\n" +

    "Perintah:\n" +
    "/hariini\n" +
    "/mingguini\n" +
    "/bulanini\n" +
    "/rekap\n" +
    "/subkategori\n" +
    "/alokasi\n" +
    "/terakhir\n" +
    "/budget 3000000\n" +
    "/cek_budget\n" +
    "/insight\n" +
    "/batal\n\n" +

    "Catatan: jika bot tidak sesuai alur, ketik /batal."
  );
}
function handleTelegramMessage(message) {
  const userId = String(message.from && message.from.id ? message.from.id : "");
  const chatId = message.chat && message.chat.id;
  const text = String(message.text || "").trim();

  Logger.log("=== handleTelegramMessage ===");
  Logger.log("userId: " + userId);
  Logger.log("chatId: " + chatId);
  Logger.log("text: " + text);

  if (!userId || !chatId || !text) {
    Logger.log("Pesan kosong atau bukan text.");
    return;
  }

  const allowed = getAllowedUserIds();

  if (!allowed.includes(userId)) {
    Logger.log("User tidak diizinkan: " + userId);
    return;
  }

  try {
    const command = getCommand(text);
    Logger.log("command: " + command);

    if (command === "/batal" || text.toLowerCase() === "batal") {
      clearUserState(userId);
      sendMessage(chatId, "Input yang tertunda sudah dibatalkan.");
      return;
    }

    if (command === "/help") {
      clearUserState(userId);
      sendMessage(
        chatId,
        "Bot aktif.\n\n" +
        "Gunakan /menu untuk melihat panduan.\n" +
        "Gunakan /batal untuk membersihkan input tertunda."
      );
      return;
    }

    if (command === "/menu" || command === "/panduan") {
      clearUserState(userId);
      sendMessage(chatId, menuMessage());
      return;
    }

    if (command === "/start") {
      clearUserState(userId);
      sendMessage(
        chatId,
        "Halo. Bot pencatat pengeluaran aktif.\n\n" +
        "Contoh:\n" +
        "makan siang 25000\n" +
        "bensin 50000\n\n" +
        "Ketik /menu untuk melihat panduan."
      );
      return;
    }

    const lines = text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean);

    const replies = [];

    lines.forEach(line => {
      try {
        const reply = handleLine(userId, line);
        if (reply) {
          replies.push(reply);
        }
      } catch (lineErr) {
        Logger.log("Error handleLine: " + lineErr.toString());
        replies.push(
          "Terjadi error saat memproses:\n" +
          line + "\n\n" +
          "Detail: " + lineErr.toString()
        );
      }
    });

    if (replies.length) {
      sendMessage(chatId, replies.join("\n\n---\n\n"));
    } else {
      sendMessage(chatId, "Pesan diterima, tetapi tidak ada aksi yang diproses.");
    }

  } catch (err) {
    Logger.log("handleTelegramMessage error: " + err.toString());
    sendMessage(chatId, "Terjadi error pada bot:\n" + err.toString());
  }
}

function doGet(e) {
  return jsonResponse({
    ok: true,
    message: "Expense Telegram Bot Apps Script is running"
  });
}

function doPost(e) {
  try {
    if (!e || !e.parameter || !e.postData || !e.postData.contents) {
      Logger.log("doPost dipanggil tanpa payload Telegram.");
      return jsonResponse({
        ok: false,
        error: "No Telegram payload"
      });
    }

    const incomingSecret = String(e.parameter.secret || "").trim();
    const storedSecret = getWebhookSecret();

    if (!storedSecret || incomingSecret !== storedSecret) {
      Logger.log("Unauthorized webhook request.");
      return jsonResponse({
        ok: false,
        error: "Unauthorized"
      });
    }

    const update = JSON.parse(e.postData.contents);
    Logger.log("Telegram update: " + JSON.stringify(update));

    const message = update.message || update.edited_message;

    if (message) {
      handleTelegramMessage(message);
    } else {
      Logger.log("Tidak ada message dalam update.");
    }

    return jsonResponse({
      ok: true
    });

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    Logger.log(err.stack || "");

    return jsonResponse({
      ok: false,
      error: err.toString()
    });
  }
}

function deleteTelegramWebhook() {
  const token = getBotToken();

  if (!token) {
    throw new Error("BOT_TOKEN belum diisi di Script Properties.");
  }

  const apiUrl = "https://api.telegram.org/bot" + token + "/deleteWebhook";

  const response = UrlFetchApp.fetch(apiUrl, {
    method: "post",
    muteHttpExceptions: true
  });

  Logger.log(response.getContentText());
}
function setTelegramWebhook() {
  const token = getBotToken();
  const webAppUrl = getProp("WEB_APP_URL");
  const secret = getWebhookSecret();

  if (!token) {
    throw new Error("BOT_TOKEN belum diisi di Script Properties.");
  }

  if (!webAppUrl) {
    throw new Error("WEB_APP_URL belum diisi di Script Properties.");
  }

  if (!secret) {
    throw new Error("WEBHOOK_SECRET belum diisi di Script Properties.");
  }

  const webhookUrl = webAppUrl + "?secret=" + encodeURIComponent(secret);
  const apiUrl = "https://api.telegram.org/bot" + token + "/setWebhook";

  Logger.log("WEBHOOK URL:");
  Logger.log(webhookUrl);

  const response = UrlFetchApp.fetch(apiUrl, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
  url: webhookUrl,
  drop_pending_updates: true,
  allowed_updates: ["message", "edited_message"]
}),
    muteHttpExceptions: true
  });

  Logger.log("TELEGRAM RESPONSE:");
  Logger.log(response.getContentText());

  return response.getContentText();
}


function getTelegramWebhookInfo() {
  const token = getBotToken();

  if (!token) {
    throw new Error("BOT_TOKEN belum diisi di Script Properties.");
  }

  const apiUrl = "https://api.telegram.org/bot" + token + "/getWebhookInfo";

  const response = UrlFetchApp.fetch(apiUrl, {
    method: "get",
    muteHttpExceptions: true
  });

  Logger.log(response.getContentText());
}
function clearMyState() {
  const userId = getAllowedUserIds()[0];
  const cache = CacheService.getScriptCache();

  cache.remove(getCacheKey("pending", userId));
  cache.remove(getCacheKey("confirm", userId));

  Logger.log("Pending dan confirm cache sudah dibersihkan untuk user: " + userId);
}
// function testSaveExpense() {
//   const userId = getAllowedUserIds()[0];

//   const data = {
//     transaction_date: todayYmd(),
//     expense_name: "Tes dari Apps Script",
//     category: "Kebutuhan wajib",
//     subcategory: "Makanan & Minuman",
//     allocation: "Operasional",
//     amount: 12345,
//     note: "-",
//     user_id: userId
//   };

//   const saved = appendTransaction(data);

//   Logger.log(JSON.stringify(saved));
// }