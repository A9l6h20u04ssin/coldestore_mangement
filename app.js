const MN = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
  ],
  TY = ["بنزين", "أكل وشرب", "صيانة", "كهرباء", "أخرى"],
  TB = ["الملخص", "الشركات", "العمال الشهري", "العمالة اليومية", "المصروفات"];

let db = { co: [], wk: [], dl: [], ex: [], pd: {} },
  now = new Date(),
  Y = now.getFullYear(),
  Mo = now.getMonth(),
  ec = null;

// Supabase is the source of truth. Do not save business data to localStorage.
const sv = () => {};
const sb = () => window.AppSupabase && window.AppSupabase.client;
const uid = () => crypto.randomUUID();
const periodDate = (month) => `${month}-01`;

// Keep the contract attachment path in the existing contracts.notes column,
// so no schema.sql migration/new column is required.
const CONTRACT_META_PREFIX = "__APP_CONTRACT_META__";

const readContractNotes = (notes) => {
  if (typeof notes !== "string" || !notes.startsWith(CONTRACT_META_PREFIX))
    return { filePath: "", note: notes || "" };

  try {
    const parsed = JSON.parse(notes.slice(CONTRACT_META_PREFIX.length));
    return { filePath: parsed.filePath || "", note: parsed.note || "" };
  } catch {
    return { filePath: "", note: notes };
  }
};

const writeContractNotes = (filePath, note = "") =>
  CONTRACT_META_PREFIX +
  JSON.stringify({ filePath: filePath || "", note: note || "" });

const dbResult = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

const status = (message) => {
  const el = document.getElementById("connection-status");
  if (el) el.textContent = message;
};

const reportError = (error) => {
  console.error(error);
  alert("حصل خطأ في قاعدة البيانات: " + (error?.message || error));
};

const $ = (id) => document.getElementById(id),
  f = (n) =>
    (+n || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  P = (n) => String(n).padStart(2, "0");

const ym = () => Y + "-" + P(Mo + 1),
  fs = (d) =>
    d.getFullYear() + "-" + P(d.getMonth() + 1) + "-" + P(d.getDate()),
  T0 = () => fs(new Date());

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );

const fut = () => Y * 12 + Mo > now.getFullYear() * 12 + now.getMonth();

const nm = (c) => Math.max(1, Math.round(c.y * 12)),
  mp = (c) => (c.mp !== "" && c.mp != null ? +c.mp : c.t / nm(c));

const en = (c) => {
  const s = new Date(c.s);
  return new Date(s.getFullYear(), s.getMonth() + nm(c), s.getDate() - 1);
};

const act = (c) =>
  new Date(c.s) <= new Date(Y, Mo + 1, 0) &&
  en(c) >= new Date(Y, Mo, 1);

function rem(e) {
  const a = new Date();
  a.setHours(0, 0, 0, 0);

  const b = new Date(e);
  b.setDate(b.getDate() + 1);

  if (b <= a) return "منتهي";

  let y = b.getFullYear() - a.getFullYear(),
    m = b.getMonth() - a.getMonth(),
    d = b.getDate() - a.getDate();

  if (d < 0) {
    m--;
    d += new Date(b.getFullYear(), b.getMonth(), 0).getDate();
  }

  if (m < 0) {
    y--;
    m += 12;
  }

  return y + " سنة و " + m + " شهر و " + d + " يوم";
}

const wd = (w) => db.pd["w" + w.id + ym()] || {},
  net = (w) => w.b + (+wd(w).bo || 0) - (+wd(w).de || 0);

const fl = (k, a, tx, am) => {
  const q = $("q" + k).value.trim(),
    lo = $("a" + k).value,
    hi = $("b" + k).value;

  return a.filter(
    (x) =>
      (!q || tx(x).includes(q)) &&
      (lo === "" || am(x) >= +lo) &&
      (hi === "" || am(x) <= +hi)
  );
};

function mv(d) {
  Mo += d;

  if (Mo < 0) {
    Mo = 11;
    Y--;
  }

  if (Mo > 11) {
    Mo = 0;
    Y++;
  }

  R();
}

function tab(i) {
  document
    .querySelectorAll(".sec")
    .forEach((s, j) => s.classList.toggle("on", i == j));

  document
    .querySelectorAll("#tb button")
    .forEach((b, j) => b.classList.toggle("on", i == j));
}

function tm() {
  const r = document.documentElement,
    d = r.dataset.theme
      ? r.dataset.theme == "dark"
      : matchMedia("(prefers-color-scheme:dark)").matches;

  r.dataset.theme = d ? "light" : "dark";

  try {
    localStorage.setItem("ht", r.dataset.theme);
  } catch (e) {}
}

function zoom(s) {
  $("oi").src = s;
  $("ov").style.display = "flex";
}

const cmp = (fl) =>
  new Promise((r) => {
    const i = new Image();

    i.onload = () => {
      const k = Math.min(1, 900 / i.width),
        c = document.createElement("canvas");

      c.width = i.width * k;
      c.height = i.height * k;

      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      r(c.toDataURL("image/jpeg", 0.6));
    };

    i.onerror = () => r("");
    i.src = URL.createObjectURL(fl);
  });

function toggle(cur, set) {
  if (fut()) return alert("مينفعش تسجل شهر لسه ماجاش");

  if (
    !confirm(
      cur ? "استرجاع؟ هيتلغي التسجيل ده" : "تأكيد إنك استلمت/دفعت الفلوس؟"
    )
  )
    return;

  set(cur ? "" : T0());
  sv();
  R();
}

/* Supabase data loading and mapping */
async function loadData() {
  const client = sb();

  if (!client)
    throw new Error("إعدادات Supabase غير موجودة أو لم يتم تحميلها");

  status("جارٍ تحميل البيانات من Supabase...");

  const [
    companies,
    contracts,
    contractBarns,
    rentPayments,
    workers,
    payroll,
    daily,
    expenses,
  ] = await Promise.all([
    dbResult(
      client.from("companies").select("id,name,archived_at,created_at")
    ),
    dbResult(
      client
        .from("contracts")
        .select(
          "id,company_id,start_date,end_date,duration_months,total_price,monthly_rent,status,notes"
        )
    ),
    dbResult(
      client.from("contract_barns").select("contract_id,barn_id")
    ),
    dbResult(
      client
        .from("rent_payments")
        .select("id,contract_id,period_month,amount,paid_at")
    ),
    dbResult(
      client.from("workers").select("id,name,base_salary,archived_at")
    ),
    dbResult(
      client
        .from("payroll_entries")
        .select("id,worker_id,period_month,base_salary,bonus,deduction,paid_at")
    ),
    dbResult(
      client
        .from("daily_labor_entries")
        .select("id,worker_name_snapshot,work_date,daily_rate,days,paid_at,notes")
    ),
    dbResult(
      client
        .from("expenses")
        .select("id,expense_date,category,custom_category,amount,notes")
    ),
  ]);

  const barnMap = {};
  contractBarns.forEach(
    (x) => (barnMap[x.contract_id] ||= []).push(x.barn_id)
  );

  const companyById = new Map(companies.map((x) => [x.id, x]));
  const latestContract = new Map();

  contracts.forEach((x) => {
    const old = latestContract.get(x.company_id);

    if (!old || x.start_date > old.start_date)
      latestContract.set(x.company_id, x);
  });

  db.co = companies
    .filter((x) => !x.archived_at)
    .map((x) => {
      const ct = latestContract.get(x.id);
      const notes = readContractNotes(ct?.notes);

      return {
        id: x.id,
        n: x.name,
        cid: ct?.id || null,
        w: ct ? barnMap[ct.id] || [] : [],
        s: ct?.start_date || T0(),
        y: ct ? ct.duration_months / 12 : 1,
        t: Number(ct?.total_price || 0),
        mp: ct?.monthly_rent == null ? "" : String(ct.monthly_rent),
        imgPath: notes.filePath,
        contractNotes: notes.note,
        img: "",
      };
    });

  for (const c of db.co) {
    if (c.imgPath) {
      const { data, error } = await client.storage
        .from("contract-files")
        .createSignedUrl(c.imgPath, 3600);

      if (!error) c.img = data?.signedUrl || "";
    }
  }

  db.wk = workers
    .filter((x) => !x.archived_at)
    .map((x) => ({
      id: x.id,
      n: x.name,
      b: Number(x.base_salary || 0),
    }));

  db.pd = {};

  payroll.forEach((x) => {
    const month = String(x.period_month).slice(0, 7);

    db.pd[`w${x.worker_id}${month}`] = {
      bo: Number(x.bonus || 0),
      de: Number(x.deduction || 0),
      p: x.paid_at || "",
      payrollId: x.id,
    };
  });

  const contractCompany = new Map();

  latestContract.forEach((ct, companyId) =>
    contractCompany.set(ct.id, companyId)
  );

  rentPayments.forEach((x) => {
    const companyId = contractCompany.get(x.contract_id);

    if (companyId)
      db.pd[`r${companyId}${String(x.period_month).slice(0, 7)}`] =
        x.paid_at || T0();
  });

  db.dl = daily.map((x) => ({
    id: x.id,
    n: x.worker_name_snapshot,
    r: Number(x.daily_rate),
    d: Number(x.days),
    ym: String(x.work_date).slice(0, 7),
    p: x.paid_at || "",
    date: x.work_date,
    notes: x.notes || "",
  }));

  db.ex = expenses.map((x) => ({
    id: x.id,
    ym: String(x.expense_date).slice(0, 7),
    t: x.category,
    o: x.custom_category || "",
    a: Number(x.amount),
    n: x.notes || "",
    d: x.expense_date,
  }));

  status("متصل بقاعدة بيانات Supabase — البيانات محفوظة على السحابة");
  R();
}
async function saveCompany(c, file) {
  const client = sb();
  const companyRow = { name: c.n };

  if (c.id) {
    await dbResult(
      client.from("companies").update(companyRow).eq("id", c.id).select().single()
    );
  } else {
    const row = await dbResult(
      client.from("companies").insert(companyRow).select("id").single()
    );
    c.id = row.id;
  }

  const contractRow = {
    company_id: c.id,
    start_date: c.s,
    end_date: fs(en(c)),
    duration_months: nm(c),
    total_price: c.t,
    monthly_rent: c.mp !== "" && c.mp != null ? Number(c.mp) : null,
    status: "active",
    notes: writeContractNotes(c.imgPath, c.contractNotes || ""),
  };

  if (c.cid) {
    await dbResult(
      client.from("contracts").update(contractRow).eq("id", c.cid).select("id").single()
    );
  } else {
    const row = await dbResult(
      client.from("contracts").insert(contractRow).select("id").single()
    );
    c.cid = row.id;
  }

  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${c.id}/${c.cid}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await client.storage
      .from("contract-files")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    c.imgPath = path;

    await dbResult(
      client
        .from("contracts")
        .update({
          notes: writeContractNotes(path, c.contractNotes || ""),
        })
        .eq("id", c.cid)
        .select("id")
        .single()
    );

    const { data } = await client.storage
      .from("contract-files")
      .createSignedUrl(path, 3600);

    c.img = data?.signedUrl || "";
  }

  await dbResult(
    client.from("contract_barns").delete().eq("contract_id", c.cid)
  );

  if (c.w.length) {
    await dbResult(
      client
        .from("contract_barns")
        .insert(c.w.map((barn_id) => ({ contract_id: c.cid, barn_id })))
    );
  }
}

/* companies */
function rstC() {
  ec = null;
  ["cn", "cs", "cy", "ct2", "cm", "ci"].forEach((i) => ($(i).value = ""));
  document.querySelectorAll(".wb").forEach((x) => (x.checked = false));
  $("ct").textContent = "شركة جديدة";
}

async function addCo() {
  const n = $("cn").value.trim(),
    w = [...document.querySelectorAll(".wb:checked")].map((x) => +x.value),
    s = $("cs").value,
    y = parseFloat($("cy").value),
    t = parseFloat($("ct2").value);

  if (!n || !w.length || !s || !(y > 0) || isNaN(t))
    return alert("كمّل الاسم والعنابر والتاريخ والسنين والسعر");

  if (
    w.some((barn) =>
      db.co.some((c) => c.id !== ec && c.w.includes(barn) && act(c))
    )
  ) {
    return alert(
      "فيه شركة تانية مستأجرة عنبر من العنابر المختارة خلال نفس الفترة."
    );
  }

  const old = ec ? db.co.find((c) => c.id == ec) : null;

  const c = {
    id: old?.id || null,
    cid: old?.cid || null,
    n,
    w,
    s,
    y,
    t,
    mp: $("cm").value,
    img: old?.img || "",
    imgPath: old?.imgPath || "",
    contractNotes: old?.contractNotes || "",
  };

  try {
    status("جارٍ حفظ الشركة والعقد...");
    await saveCompany(c, $("ci").files[0]);

    if (old) Object.assign(old, c);
    else db.co.push(c);

    rstC();
    R();
    status("تم حفظ الشركة والعقد على Supabase");
  } catch (e) {
    reportError(e);
    status("تعذّر حفظ الشركة");
  }
}

function edC(id) {
  const c = db.co.find((x) => x.id == id);
  if (!c) return;

  ec = id;
  $("cn").value = c.n;
  $("cs").value = c.s;
  $("cy").value = c.y;
  $("ct2").value = c.t;
  $("cm").value = c.mp;

  document.querySelectorAll(".wb").forEach((x) => {
    x.checked = c.w.includes(+x.value);
  });

  $("ct").textContent = "تعديل: " + c.n;
  scrollTo(0, 0);
}

async function payR(id) {
  if (fut()) return alert("مينفعش تسجل شهر لسه ماجاش");

  const c = db.co.find((x) => x.id == id);
  if (!c?.cid) return alert("العقد غير موجود");

  const k = `r${id}${ym()}`,
    current = db.pd[k];

  if (
    !confirm(
      current
        ? "استرجاع؟ هيتلغي تسجيل القبض ده"
        : "تأكيد إنك استلمت إيجار الشهر؟"
    )
  )
    return;

  try {
    const client = sb();

    if (current) {
      await dbResult(
        client
          .from("rent_payments")
          .delete()
          .eq("contract_id", c.cid)
          .eq("period_month", periodDate(ym()))
      );
    } else {
      await dbResult(
        client.from("rent_payments").upsert(
          {
            contract_id: c.cid,
            period_month: periodDate(ym()),
            amount: mp(c),
            paid_at: new Date().toISOString(),
          },
          { onConflict: "contract_id,period_month" }
        )
      );
    }

    if (current) delete db.pd[k];
    else db.pd[k] = T0();

    R();
  } catch (e) {
    reportError(e);
  }
}

async function delC(id) {
  const c = db.co.find((x) => x.id == id);
  if (!c || !confirm("حذف الشركة والعقد والمدفوعات المرتبطة؟")) return;

  try {
    const client = sb();

    if (c.cid) {
      await dbResult(
        client.from("rent_payments").delete().eq("contract_id", c.cid)
      );

      await dbResult(
        client.from("contract_barns").delete().eq("contract_id", c.cid)
      );

      await dbResult(client.from("contracts").delete().eq("id", c.cid));
    }

    await dbResult(client.from("companies").delete().eq("id", c.id));

    if (c.imgPath)
      await client.storage.from("contract-files").remove([c.imgPath]);

    db.co = db.co.filter((x) => x.id != id);

    Object.keys(db.pd)
      .filter((k) => k.startsWith("r" + id))
      .forEach((k) => delete db.pd[k]);

    R();
  } catch (e) {
    reportError(e);
  }
}

/* monthly workers */
async function addW() {
  const n = $("wn").value.trim(),
    b = parseFloat($("wa").value);

  if (!n || isNaN(b) || b < 0)
    return alert("اكتب الاسم والمرتب بشكل صحيح");

  try {
    const row = await dbResult(
      sb()
        .from("workers")
        .insert({ name: n, base_salary: b })
        .select("id,name,base_salary")
        .single()
    );

    db.wk.push({
      id: row.id,
      n: row.name,
      b: Number(row.base_salary),
    });

    $("wn").value = $("wa").value = "";
    R();
  } catch (e) {
    reportError(e);
  }
}

async function savePayroll(w) {
  const x = wd(w);

  const row = {
    worker_id: w.id,
    period_month: periodDate(ym()),
    base_salary: Number(w.b) || 0,
    bonus: Number(x.bo) || 0,
    deduction: Number(x.de) || 0,
    paid_at: x.p || null,
  };

  const saved = await dbResult(
    sb()
      .from("payroll_entries")
      .upsert(row, { onConflict: "worker_id,period_month" })
      .select("id")
      .single()
  );

  x.payrollId = saved.id;
}

async function setW(id, k, v) {
  const w = db.wk.find((x) => x.id == id);
  if (!w) return;

  const value = parseFloat(v) || 0;
  if (value < 0) return alert("القيمة لا يمكن أن تكون سالبة");

  const x = (db.pd[`w${id}${ym()}`] ||= {});

  if (x.p)
    return alert("لا يمكن تعديل المرتب بعد تسجيل صرفه؛ ألغِ الصرف أولًا.");

  try {
    if (k === "b") {
      await dbResult(
        sb().from("workers").update({ base_salary: value }).eq("id", id)
      );

      w.b = value;
    } else {
      x[k] = value;
      await savePayroll(w);
    }

    R();
  } catch (e) {
    reportError(e);
  }
}

async function payW(id) {
  if (fut()) return alert("مينفعش تسجل شهر لسه ماجاش");

  const w = db.wk.find((x) => x.id == id);
  if (!w) return;

  const x = (db.pd[`w${id}${ym()}`] ||= {});

  if (
    !confirm(
      x.p
        ? "استرجاع؟ هيتلغي تسجيل صرف المرتب"
        : "تأكيد إن العامل استلم المرتب؟"
    )
  )
    return;

  try {
    x.p = x.p ? "" : T0();
    await savePayroll(w);
    R();
  } catch (e) {
    reportError(e);
  }
}

async function delW(id) {
  if (!confirm("حذف العامل وسجلات مرتباته؟")) return;

  try {
    await dbResult(
      sb().from("payroll_entries").delete().eq("worker_id", id)
    );

    await dbResult(sb().from("workers").delete().eq("id", id));

    db.wk = db.wk.filter((w) => w.id != id);

    Object.keys(db.pd)
      .filter((k) => k.startsWith("w" + id))
      .forEach((k) => delete db.pd[k]);

    R();
  } catch (e) {
    reportError(e);
  }
}

/* daily labor */
async function addD() {
  const n = $("dn").value.trim(),
    r = parseFloat($("dr").value),
    d = parseFloat($("dd").value) || 0;

  if (!n || isNaN(r) || r < 0 || d < 0)
    return alert("اكتب الاسم واليومية وعدد الأيام بشكل صحيح");

  try {
    const row = await dbResult(
      sb()
        .from("daily_labor_entries")
        .insert({
          worker_name_snapshot: n,
          work_date: T0(),
          daily_rate: r,
          days: d,
        })
        .select("id,work_date")
        .single()
    );

    db.dl.push({
      id: row.id,
      n,
      r,
      d,
      ym: String(row.work_date).slice(0, 7),
      p: "",
      date: row.work_date,
    });

    $("dn").value = $("dr").value = $("dd").value = "";
    R();
  } catch (e) {
    reportError(e);
  }
}

async function setD(id, v) {
  const x = db.dl.find((z) => z.id == id);
  if (!x) return;

  const days = parseFloat(v) || 0;
  if (days < 0) return alert("عدد الأيام لا يمكن أن يكون سالبًا");
  if (x.p) return alert("ألغِ تسجيل الصرف قبل تعديل عدد الأيام");

  try {
    await dbResult(
      sb().from("daily_labor_entries").update({ days }).eq("id", id)
    );

    x.d = days;
    R();
  } catch (e) {
    reportError(e);
  }
}

async function payD(id) {
  if (fut()) return alert("مينفعش تسجل شهر لسه ماجاش");

  const x = db.dl.find((z) => z.id == id);
  if (!x) return;

  if (
    !confirm(
      x.p ? "استرجاع؟ هيتلغي تسجيل الصرف" : "تأكيد إن العامل أخد الفلوس؟"
    )
  )
    return;

  try {
    const paid_at = x.p ? null : new Date().toISOString();

    await dbResult(
      sb().from("daily_labor_entries").update({ paid_at }).eq("id", id)
    );

    x.p = paid_at || "";
    R();
  } catch (e) {
    reportError(e);
  }
}

async function delD(id) {
  if (!confirm("حذف سجل اليومية؟")) return;

  try {
    await dbResult(
      sb().from("daily_labor_entries").delete().eq("id", id)
    );

    db.dl = db.dl.filter((x) => x.id != id);
    R();
  } catch (e) {
    reportError(e);
  }
}

/* expenses */
async function addE() {
  const t = $("et").value,
    o = $("eo").value.trim(),
    a = parseFloat($("ea").value);

  if (isNaN(a) || a < 0) return alert("اكتب مبلغًا صحيحًا");
  if (t === "أخرى" && !o) return alert("اكتب نوع المصروف");

  try {
    const row = await dbResult(
      sb()
        .from("expenses")
        .insert({
          expense_date: T0(),
          category: t,
          custom_category: t === "أخرى" ? o : null,
          amount: a,
          notes: $("en").value.trim() || null,
        })
        .select("id,expense_date")
        .single()
    );

    db.ex.push({
      id: row.id,
      ym: String(row.expense_date).slice(0, 7),
      t,
      o,
      a,
      n: $("en").value.trim(),
      d: row.expense_date,
    });

    $("ea").value = $("en").value = $("eo").value = "";
    R();
  } catch (e) {
    reportError(e);
  }
}

async function delE(id) {
  if (!confirm("حذف المصروف؟")) return;

  try {
    await dbResult(sb().from("expenses").delete().eq("id", id));

    db.ex = db.ex.filter((x) => x.id != id);
    R();
  } catch (e) {
    reportError(e);
  }
}

/* backup */
function bk() {
  $("bx").value = JSON.stringify(db);
  $("bx").select();

  try {
    navigator.clipboard.writeText($("bx").value);
  } catch (e) {}
}

function rs() {
  alert(
    "استرجاع النسخة من النص غير مفعّل في نسخة Supabase الحالية؛ لا يتم استبدال بيانات السحابة تلقائيًا. احتفظ بالنسخة الاحتياطية لحين تجهيز أداة الاستيراد."
  );
}
/* render */
function R() {
  const m = ym();
  $("ml").textContent = MN[Mo] + " " + Y;

  const ac = db.co.filter(act),
    late = fut() ? [] : ac.filter((c) => !db.pd["r" + c.id + m]);

  const al = late.length
    ? `<div class="al">⚠️ لسه ماخدتش فلوس الإيجار من: ${late
        .map(
          (c) => esc(c.n) + " (عنبر " + c.w.join("، ") + " — " + f(mp(c)) + ")"
        )
        .join(" | ")}</div>`
    : "";

  $("al").innerHTML = $("al2").innerHTML = al;

  let lg = [],
    exp = 0,
    col = 0,
    sal = 0,
    dly = 0,
    exs = 0;

  ac.forEach((c) => {
    exp += mp(c);
    const p = db.pd["r" + c.id + m];

    if (p) {
      col += mp(c);
      lg.push([p, "إيجار " + c.n, mp(c)]);
    }
  });

  db.wk.forEach((w) => {
    const p = wd(w).p;

    if (p) {
      sal += net(w);
      lg.push([p, "مرتب " + w.n, -net(w)]);
    }
  });

  db.dl
    .filter((x) => x.ym == m && x.p)
    .forEach((x) => {
      dly += x.r * x.d;
      lg.push([x.p, "يومية " + x.n, -x.r * x.d]);
    });

  db.ex
    .filter((x) => x.ym == m)
    .forEach((x) => {
      exs += x.a;
      lg.push([x.d || m, "مصروف: " + (x.t == "أخرى" ? x.o : x.t), -x.a]);
    });

  const ld = new Date(Y, Mo + 1, 0).getDate();

  $("rg").textContent =
    `الشهر من 1 ${MN[Mo]} إلى ${ld} ${MN[Mo]} (حسب عدد أيام الشهر الفعلي)`;

  const cd = (k, v, c) =>
    `<div class="card"><div class="k">${k}</div><div class="v ${c || ""}">${f(
      v
    )}</div></div>`;

  $("cd").innerHTML =
    cd("إيراد الإيجارات المتوقع", exp) +
    cd("إيراد محصّل", col, "ok") +
    cd("مرتبات مصروفة", sal) +
    cd("عمالة يومية مصروفة", dly) +
    cd("مصروفات", exs) +
    cd(
      "الصافي",
      col - sal - dly - exs,
      col - sal - dly - exs < 0 ? "no" : "ok"
    );

  let wt =
    "<tr><th>العنبر</th><th>الشركة</th><th>الحالة</th><th>الإيجار</th></tr>";

  for (let n = 1; n <= 7; n++) {
    const c = ac.find((c) => c.w.includes(n));

    wt += `<tr><td>${n}</td><td>${c ? esc(c.n) : "—"}</td><td class="${
      c ? "ok" : "no"
    }">${c ? "مأجّر" : "فاضي"}</td><td>${
      c ? (db.pd["r" + c.id + m] ? "اتقبض" : "لسه") : "—"
    }</td></tr>`;
  }

  $("wt").innerHTML = wt;

  lg.sort((a, b) => (a[0] < b[0] ? -1 : 1));

  $("lg").innerHTML = lg.length
    ? lg
        .map(
          (l) =>
            `<tr><td>${l[0]}</td><td>${esc(l[1])}</td><td class="${
              l[2] < 0 ? "no" : "ok"
            }">${f(l[2])}</td></tr>`
        )
        .join("")
    : '<tr><td class="sm">مفيش حركات</td></tr>';

  /* companies list */
  $("l1").innerHTML =
    fl(1, db.co, (c) => c.n, mp)
      .map((c) => {
        const e = en(c),
          a = act(c),
          p = db.pd["r" + c.id + m];

        return `<div class="row"><b>${esc(c.n)}</b> — عنبر ${c.w.join(
          "، "
        )}<div class="sm">بداية: ${c.s} | نهاية: ${fs(e)} | متبقي: ${rem(
          e
        )}</div><div>الكلي: ${f(c.t)} | شهري: ${f(mp(c))}</div>${
          c.img
            ? `<img class="th" src="${c.img}" onclick="zoom(this.src)">`
            : ""
        }
<div class="acts">${
          a
            ? `<button class="${p ? "" : "g"}" ${
                fut() ? "disabled" : ""
              } onclick="payR('${c.id}')">${
                p ? "استرجاع القبض (" + p + ")" : "تم قبض إيجار الشهر"
              }</button>`
            : '<span class="sm">غير ساري في الشهر ده</span>'
        }<button onclick="edC('${c.id}')">تعديل</button><button class="d" onclick="delC('${c.id}')">حذف</button></div></div>`;
      })
      .join("") || '<div class="sm">لا يوجد</div>';

  /* workers */
  const ws = fl(2, db.wk, (w) => w.n, net),
    tot = ws.reduce((s, w) => s + net(w), 0),
    paid = ws.filter((w) => wd(w).p).reduce((s, w) => s + net(w), 0);

  $("t2").innerHTML = `إجمالي القبض الشهري: <b>${f(
    tot
  )}</b> | اتصرف: <b class="ok">${f(paid)}</b> | متبقي: <b class="no">${f(
    tot - paid
  )}</b>`;

  $("l2").innerHTML =
    ws
      .map((w) => {
        const x = wd(w),
          p = !!x.p,
          dis = p ? "disabled" : "";

        return `<div class="row"><b>${esc(
          w.n
        )}</b><div class="fm"><label class="sm">الأساسي<input type="number" step="any" value="${
          w.b
        }" ${dis} onchange="setW('${w.id}','b',this.value)"></label><label class="sm">مكافأة<input type="number" step="any" value="${
          x.bo || 0
        }" ${dis} onchange="setW('${w.id}','bo',this.value)"></label><label class="sm">خصم/سلفة<input type="number" step="any" value="${
          x.de || 0
        }" ${dis} onchange="setW('${w.id}','de',this.value)"></label></div><div>الصافي: <b>${f(net(w))}</b> ${
          p ? '<span class="ok">— اتصرف ' + x.p + "</span>" : ""
        }</div>
<div class="acts"><button class="${p ? "" : "g"}" ${
          fut() ? "disabled" : ""
        } onclick="payW('${w.id}')">${
          p ? "استرجاع" : "استلم المرتب"
        }</button><button class="d" onclick="delW('${w.id}')">حذف</button></div></div>`;
      })
      .join("") || '<div class="sm">لا يوجد</div>';

  /* daily */
  const ds = fl(
    3,
    db.dl.filter((x) => x.ym == m),
    (x) => x.n,
    (x) => x.r * x.d
  );

  $("t3").innerHTML = `إجمالي اليوميات: <b>${f(
    ds.reduce((s, x) => s + x.r * x.d, 0)
  )}</b> | اتصرف: <b class="ok">${f(
    ds.filter((x) => x.p).reduce((s, x) => s + x.r * x.d, 0)
  )}</b>`;

  $("l3").innerHTML =
    ds
      .map(
        (x) =>
          `<div class="row"><b>${esc(x.n)}</b> — اليومية ${f(
            x.r
          )}<div class="fm"><label class="sm">عدد الأيام<input type="number" step="any" value="${
            x.d
          }" ${x.p ? "disabled" : ""} onchange="setD('${x.id}',this.value)"></label></div><div>الإجمالي: <b>${f(x.r * x.d)}</b> ${
            x.p ? '<span class="ok">— اتصرف ' + x.p + "</span>" : ""
          }</div><div class="acts"><button class="${
            x.p ? "" : "g"
          }" onclick="payD('${x.id}')">${
            x.p ? "استرجاع" : "خلاص أخد الفلوس"
          }</button><button class="d" onclick="delD('${x.id}')">حذف</button></div></div>`
      )
      .join("") || '<div class="sm">لا يوجد</div>';

  /* expenses */
  const lab = (x) => (x.t == "أخرى" ? "أخرى: " + x.o : x.t),
    ef = $("ef").value,
    es = fl(
      4,
      db.ex.filter((x) => x.ym == m && (!ef || x.t == ef)),
      (x) => x.n + x.o,
      (x) => x.a
    );

  $("t4").innerHTML = TY.map(
    (t) =>
      `${t}: <b>${f(
        db.ex.filter((x) => x.ym == m && x.t == t).reduce((s, x) => s + x.a, 0)
      )}</b>`
  ).join(" | ");

  $("l4").innerHTML =
    es
      .map(
        (x) =>
          `<div class="row"><b>${esc(lab(x))}</b> — ${f(
            x.a
          )} <span class="sm">${x.d || ""} ${esc(
            x.n
          )}</span><div class="acts"><button class="d" onclick="delE('${x.id}')">حذف</button></div></div>`
      )
      .join("") || '<div class="sm">لا يوجد</div>';
}

/* init */
$("tb").innerHTML = TB.map(
  (t, i) => `<button onclick="tab(${i})">${t}</button>`
).join("");

$("wb").innerHTML = [1, 2, 3, 4, 5, 6, 7]
  .map(
    (n) =>
      `<label><input type="checkbox" class="wb" value="${n}"> عنبر ${n}</label>`
  )
  .join(" ");

$("et").innerHTML = TY.map((t) => `<option>${t}</option>`).join("");

$("ef").innerHTML =
  '<option value="">كل الأنواع</option>' +
  TY.map((t) => `<option>${t}</option>`).join("");

try {
  const h = localStorage.getItem("ht");
  if (h) document.documentElement.dataset.theme = h;
} catch (e) {}

tab(0);
R();

(async function initCloudApp() {
  try {
    if (!window.AppSupabase || !window.AppSupabase.client)
      throw new Error(
        "ملف js/supabase.js غير جاهز أو إعداداته ناقصة"
      );

    if (typeof window.AppSupabase.refreshAuthUI === "function")
      await window.AppSupabase.refreshAuthUI();

    const { data: sessionData, error: sessionError } =
      await sb().auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
      status("سجّل الدخول أولًا");
      return;
    }

    const isOwner = await window.AppSupabase.ownerOnly();

    if (isOwner === false) {
      status("الحساب ليس لديه صلاحية المالك");
      return;
    }

    await loadData();

    const shell = $("app-shell");
    if (shell) shell.style.display = "";
  } catch (e) {
    status("تعذّر الاتصال بقاعدة البيانات");
    reportError(e);
  }
})();