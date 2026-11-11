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
  TY = ["بنزين", "أكل وشرب", "صيانة", "كهرباء", "أخرى"];

// تعريف التبويبات الأساسية للنظام
const ALL_TABS = [
  "الملخص",           // 0
  "الشركات",          // 1
  "أذونات العنابر",    // 2
  "العمال الشهري",    // 3
  "العمالة اليومية",  // 4
  "المصروفات" 
          // 5
];

let db = { co: [], wk: [], dl: [], ex: [], pd: {} },
  now = new Date(),
  Y = now.getFullYear(),
  Mo = now.getMonth(),
  ec = null,
  currentUserRole = 'client'; // الدور الافتراضي

// Supabase is the source of truth. Do not save business data to localStorage.
const sv = () => {};
const sb = () => window.AppSupabase && window.AppSupabase.client;
const uid = () => crypto.randomUUID();
const periodDate = (month) => `${month}-01`;

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
  const q = $("q" + k)?.value?.trim() || "",
    lo = $("a" + k)?.value || "",
    hi = $("b" + k)?.value || "";

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

// رسم القائمة الجانبية بناءً على صلاحية المستخدم
function setupUserTabs(role) {
  let allowedTabs = [];
  
  if (role === 'admin') {
    allowedTabs = [
      { name: "الملخص", index: 0 },
      { name: "الشركات", index: 1 },
      { name: "أذونات العنابر", index: 2 },
      { name: "العمال الشهري", index: 3 },
      { name: "العمالة اليومية", index: 4 },
      { name: "المصروفات", index: 5 }
    ];
  } else {
    // العميل يرى فقط أذونات العنابر والمصروفات
    allowedTabs = [
      { name: "أذونات العنابر", index: 2 },
      { name: "المصروفات", index: 5 }
    ];
  }

  const tbElement = $("tb");
  if (tbElement) {
    tbElement.innerHTML = allowedTabs
      .map(t => `<button onclick="tab(${t.index})">${t.name}</button>`)
      .join("");
  
   // 2. إعادة إضافة زر الملف الشخصي دائماً في نهاية القائمة
    tbElement.insertAdjacentHTML(
      "beforeend",
      `<button type="button" onclick="location.href='profile.html'">
        👤 الملف الشخصي
      </button>`
    );
  }
  // إذا كان العميل، افتح له تبويب أذونات العنابر افتراضياً
  if (role !== 'admin') {
    tab(2);
  } else {
    tab(0);
  }
}

function tab(i) {
  document
    .querySelectorAll(".sec")
    .forEach((s, j) => s.classList.toggle("on", i == j));

  document
    .querySelectorAll("#tb button")
    .forEach((b, j) => {
      // مطابقة الزر بالتبويب الفعلي
      const btnOnClick = b.getAttribute("onclick") || "";
      if (btnOnClick.includes(`tab(${i})`)) {
        b.classList.add("on");
      } else {
        b.classList.remove("on");
      }
    });
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
    dbResult(client.from("companies").select("id,name,archived_at,created_at")),
    dbResult(client.from("contracts").select("id,company_id,start_date,end_date,duration_months,total_price,monthly_rent,status,notes")),
    dbResult(client.from("contract_barns").select("contract_id,barn_id")),
    dbResult(client.from("rent_payments").select("id,contract_id,period_month,amount,paid_at")),
    dbResult(client.from("workers").select("id,name,base_salary,archived_at")),
    dbResult(client.from("payroll_entries").select("id,worker_id,period_month,base_salary,bonus,deduction,paid_at")),
    dbResult(client.from("daily_labor_entries").select("id,worker_name_snapshot,work_date,daily_rate,days,paid_at,notes")),
    dbResult(client.from("expenses").select("id,expense_date,category,custom_category,amount,notes")),
  ]);

  const barnMap = {};
  contractBarns.forEach(
    (x) => (barnMap[x.contract_id] ||= []).push(x.barn_id)
  );

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
  renderPermitBarns();
  loadBarnPermits();
}

async function saveCompany(c, file) {
  const client = sb();
  const companyRow = { name: c.n };

  if (c.id) {
    await dbResult(client.from("companies").update(companyRow).eq("id", c.id).select().single());
  } else {
    const row = await dbResult(client.from("companies").insert(companyRow).select("id").single());
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
    await dbResult(client.from("contracts").update(contractRow).eq("id", c.cid).select("id").single());
  } else {
    const row = await dbResult(client.from("contracts").insert(contractRow).select("id").single());
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

  await dbResult(client.from("contract_barns").delete().eq("contract_id", c.cid));

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
  ["cn", "cs", "cy", "ct2", "cm", "ci"].forEach((i) => {
    if ($(i)) $(i).value = "";
  });
  document.querySelectorAll(".wb").forEach((x) => (x.checked = false));
  if ($("ct")) $("ct").textContent = "شركة جديدة";
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
    return alert("فيه شركة تانية مستأجرة عنبر من العنابر المختارة خلال نفس الفترة.");
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
      await dbResult(client.from("rent_payments").delete().eq("contract_id", c.cid));
      await dbResult(client.from("contract_barns").delete().eq("contract_id", c.cid));
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
      await dbResult(sb().from("workers").update({ base_salary: value }).eq("id", id));
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
    await dbResult(sb().from("payroll_entries").delete().eq("worker_id", id));
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
    await dbResult(sb().from("daily_labor_entries").delete().eq("id", id));
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
    "استرجاع النسخة من النص غير مفعّل في نسخة Supabase الحالية؛ لا يتم استبدال بيانات السحابة تلقائيًا."
  );
}

/* render */
function R() {
  const m = ym();
  if ($("ml")) $("ml").textContent = MN[Mo] + " " + Y;

  const ac = db.co.filter(act),
    late = fut() ? [] : ac.filter((c) => !db.pd["r" + c.id + m]);

  const al = late.length
    ? `<div class="al">⚠️ لسه ماخدتش فلوس الإيجار من: ${late
        .map(
          (c) => esc(c.n) + " (عنبر " + c.w.join("، ") + " — " + f(mp(c)) + ")"
        )
        .join(" | ")}</div>`
    : "";

  if ($("al")) $("al").innerHTML = al;
  if ($("al2")) $("al2").innerHTML = al;

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

  if ($("rg"))
    $("rg").textContent = `الشهر من 1 ${MN[Mo]} إلى ${ld} ${MN[Mo]}`;

  const cd = (k, v, c) =>
    `<div class="card"><div class="k">${k}</div><div class="v ${c || ""}">${f(
      v
    )}</div></div>`;

  if ($("cd")) {
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
  }

  let wt =
    "<tr><th>العنبر</th><th>الشركة</th><th>الحالة</th><th>المدة الباقية / النهاية</th><th>الإيجار</th></tr>";

  for (let n = 1; n <= 7; n++) {
    const c = ac.find((c) => c.w.includes(n));
    
    // حساب تاريخ نهاية العقد والمدة الباقية لو العنبر مأجّراً
    let remainingText = "—";
    if (c) {
      const endDate = en(c);
      remainingText = `${rem(endDate)} (نهاية: ${fs(endDate)})`;
    }

    wt += `
      <tr>
        <td><b>عنبر ${n}</b></td>
        <td>${c ? esc(c.n) : "—"}</td>
        <td class="${c ? "ok" : "no"}">${c ? "مأجّر" : "فاضي"}</td>
        <td style="font-size: 11px; color: ${c ? 'var(--text)' : 'var(--muted)'};">${remainingText}</td>
        <td>${c ? (db.pd["r" + c.id + m] ? "اتقبض" : "لسه") : "—"}</td>
      </tr>`;
  }

  if ($("wt")) $("wt").innerHTML = wt;

/* companies list */
  if ($("l1")) {
    $("l1").innerHTML =
      fl(1, db.co, (c) => c.n, mp)
        .map((c) => {
          const e = en(c),
            a = act(c),
            p = db.pd["r" + c.id + m];

          return `
            <div class="row">
              <b>${esc(c.n)}</b> — عنبر ${c.w.join("، ")}
              <div class="sm" style="margin-top: 4px;">
                بداية العقد: ${c.s} | نهاية العقد: ${fs(e)}
              </div>
              <div class="sm" style="color: var(--primary); font-weight: bold; margin-top: 2px;">
                ⏳ المدة الباقية على الانتهاء: ${rem(e)}
              </div>
              <div style="margin-top: 4px;">الكلي: ${f(c.t)} | شهري: ${f(mp(c))}</div>
              ${
                c.img
                  ? `<img class="th" src="${c.img}" onclick="zoom(this.src)">`
                  : ""
              }
              <div class="acts">
                ${
                  a
                    ? `<button class="${p ? "" : "g"}" ${
                        fut() ? "disabled" : ""
                      } onclick="payR('${c.id}')">${
                        p ? "استرجاع القبض (" + p + ")" : "تم قبض إيجار الشهر"
                      }</button>`
                    : '<span class="sm">غير ساري في الشهر ده</span>'
                }
                <button onclick="edC('${c.id}')">تعديل</button>
                <button class="d" onclick="delC('${c.id}')">حذف</button>
              </div>
            </div>`;
        })
        .join("") || '<div class="sm">لا يوجد</div>';
  }

  /* workers */
  const ws = fl(2, db.wk, (w) => w.n, net),
    tot = ws.reduce((s, w) => s + net(w), 0),
    paid = ws.filter((w) => wd(w).p).reduce((s, w) => s + net(w), 0);

  if ($("t2"))
    $("t2").innerHTML = `إجمالي القبض الشهري: <b>${f(
      tot
    )}</b> | اتصرف: <b class="ok">${f(paid)}</b> | متبقي: <b class="no">${f(
      tot - paid
    )}</b>`;

  if ($("l2")) {
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
  }

  /* daily */
  const ds = fl(
    3,
    db.dl.filter((x) => x.ym == m),
    (x) => x.n,
    (x) => x.r * x.d
  );

  if ($("t3"))
    $("t3").innerHTML = `إجمالي اليوميات: <b>${f(
      ds.reduce((s, x) => s + x.r * x.d, 0)
    )}</b> | اتصرف: <b class="ok">${f(
      ds.filter((x) => x.p).reduce((s, x) => s + x.r * x.d, 0)
    )}</b>`;

  if ($("l3")) {
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
  }

  /* expenses */
  const lab = (x) => (x.t == "أخرى" ? "أخرى: " + x.o : x.t),
    ef = $("ef")?.value || "",
    es = fl(
      4,
      db.ex.filter((x) => x.ym == m && (!ef || x.t == ef)),
      (x) => x.n + x.o,
      (x) => x.a
    );

  if ($("t4")) {
    $("t4").innerHTML = TY.map(
      (t) =>
        `${t}: <b>${f(
          db.ex.filter((x) => x.ym == m && x.t == t).reduce((s, x) => s + x.a, 0)
        )}</b>`
    ).join(" | ");
  }

  if ($("l4")) {
    $("l4").innerHTML =
      es
        .map(
          (x) =>
            `<div class="row">
              <b>${esc(lab(x))}</b> — ${f(x.a)} 
              <span class="sm">${x.d || ""} ${esc(x.n)}</span>
              <div class="acts">
                <button class="small-btn btn-primary" onclick="editExpense('${x.id}')">تعديل</button>
                <button class="d" onclick="delE('${x.id}')">حذف</button>
              </div>
            </div>`
        )
        .join("") || '<div class="sm">لا يوجد</div>';
  }
}
// تعديل مصروف (سحب البيانات ووضعها في نموذج الإدخال العلوي)
function editExpense(id) {
  const exp = db.ex.find(x => x.id === id);
  if (!exp) return alert("المصروف غير موجود");

  // تعبئة الحقول ببيانات المصروف المراد تعديله
  if ($("et")) {
    $("et").value = TY.includes(exp.t) ? exp.t : "أخرى";
    // إظهار حقل النص الإضافي لو كانت الفئة "أخرى"
    if ($("eo")) {
      $("eo").style.display = exp.t === "أخرى" ? "" : "none";
      $("eo").value = exp.o || "";
    }
  }
  if ($("ea")) $("ea").value = exp.a;
  if ($("en")) $("en").value = exp.n || "";

  // تحويل زر الحفظ إلى "حفظ التعديلات" وتغيير دالة الـ onclick لتشغيل التحديث
  const saveBtn = document.querySelector(".sec#s4 .form-card button.g") || document.querySelector("section#s4 button.g");
  if (saveBtn) {
    saveBtn.textContent = "حفظ تعديل المصروف";
    saveBtn.setAttribute("onclick", `updateExpense('${id}')`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// تنفيذ التعديل الفعلي وحفظ البيانات المُحدثة في جدول expenses في Supabase
async function updateExpense(id) {
  const t = $("et").value,
    o = $("eo")?.value.trim() || "",
    a = parseFloat($("ea").value),
    notes = $("en")?.value.trim() || "";

  if (isNaN(a) || a < 0) return alert("اكتب مبلغًا صحيحًا");
  if (t === "أخرى" && !o) return alert("اكتب نوع المصروف");

  try {
    const client = sb();
    status("جارٍ تحديث المصروف...");

    const updatedRow = {
      category: t,
      custom_category: t === "أخرى" ? o : null,
      amount: a,
      notes: notes || null
    };

    await dbResult(client.from("expenses").update(updatedRow).eq("id", id));

    alert("تم تحديث المصروف بنجاح!");

    // إعادة زر الحفظ إلى وضعه الطبيعي (إضافة جديد)
    const saveBtn = document.querySelector(".sec#s4 .form-card button.g") || document.querySelector("section#s4 button.g");
    if (saveBtn) {
      saveBtn.textContent = "حفظ المصروف";
      saveBtn.setAttribute("onclick", "addE()");
    }

    // تفريغ الحقول
    if ($("ea")) $("ea").value = "";
    if ($("en")) $("en").value = "";
    if ($("eo")) $("eo").value = "";

    // إعادة تحميل البيانات وتحديث الواجهة
    await loadData();
    status("تم التحديث بنجاح");
  } catch (e) {
    reportError(e);
  }
}

/* تهيئة العناصر الإضافية */
if ($("wb")) {
  $("wb").innerHTML = [1, 2, 3, 4, 5, 6, 7]
    .map(
      (n) =>
        `<label><input type="checkbox" class="wb" value="${n}"> عنبر ${n}</label>`
    )
    .join(" ");
}

if ($("et")) $("et").innerHTML = TY.map((t) => `<option>${t}</option>`).join("");
if ($("ef"))
  $("ef").innerHTML =
    '<option value="">كل الأنواع</option>' +
    TY.map((t) => `<option>${t}</option>`).join("");

try {
  const h = localStorage.getItem("ht");
  if (h) document.documentElement.dataset.theme = h;
} catch (e) {}

// تشغيل التحقق من السحابة والتحقق من الدور
(async function initCloudApp() {
  try {
    if (!window.AppSupabase || !window.AppSupabase.client)
      throw new Error("ملف js/supabase.js غير جاهز أو إعداداته ناقصة");

    if (typeof window.AppSupabase.refreshAuthUI === "function")
      await window.AppSupabase.refreshAuthUI();

    const client = sb();
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData?.session) {
      status("سجّل الدخول أولًا");
      return;
    }
    const user = sessionData.session.user;

    // 1. استخراج اسم المستخدم (سواء من الـ user_metadata أو من الجزء الأول قبل @ في الإيميل)
    const displayName = user.user_metadata?.full_name 
                     || user.user_metadata?.name 
                     || (user.email ? user.email.split('@')[0] : "المستخدم");

    // 2. تحديث نص الترحيب في الصفحة
    const welcomeEl = $("welcomeName");
    if (welcomeEl) {
      welcomeEl.textContent = displayName;
    }

    // جلب دور المستخدم من جدول user_roles المخصص
    try {
      const { data: roleData } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", sessionData.session.user.id)
        .maybeSingle();

      currentUserRole = roleData?.role || 'client';
    } catch (err) {
      console.warn("تعذر تحديد دور المستخدم، سيتم التعامل كـ client:", err.message);
      currentUserRole = 'client';
    }

    // بناء القائمة الجانبية حسب الصلاحية (Admin vs Client)
    setupUserTabs(currentUserRole);

    // تحميل البيانات
    await loadData();

  } catch (e) {
    status("تعذّر الاتصال بقاعدة البيانات أو تحميل البيانات");
    reportError(e);
  } finally {
    const shell = $("app-shell");
    if (shell) shell.style.display = "";
  }
})();

// ==========================================
// منطق أذونات العنابر المحدث (Barn Permits)
// ==========================================
let activePermitBarn = null;
let allBarnPermitsCache = [];

function renderPermitBarns() {
  const container = $("permit-barn-cards");
  if (!container) return;

  const activeCompanies = db.co.filter(act);
  let html = "";

  for (let n = 1; n <= 7; n++) {
    const company = activeCompanies.find((c) => c.w.includes(n));
    const isOccupied = !!company;
    const isSelected = activePermitBarn === n;

    html += `
      <div class="stat-card ${isOccupied ? "blue" : "purple"}" style="cursor: pointer; border: ${isSelected ? '2px solid var(--primary)' : '1px solid var(--line)'};" onclick="selectBarnForPermit(${n})">
        <div class="stat-head">
          <span class="stat-label">عنبر رقم ${n}</span>
          <span class="stat-icon">${isOccupied ? "📦" : "🚪"}</span>
        </div>
        <div class="stat-value" style="font-size: 15px;">${isOccupied ? esc(company.n) : "عنبر فارغ"}</div>
        <div class="stat-foot">${isOccupied ? "مأجّر — اضغط للعرض والتسجيل" : "غير مأجّر — اضغط للتسجيل"}</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function selectBarnForPermit(barnNumber) {
  activePermitBarn = barnNumber;
  renderPermitBarns();

  const company = db.co.filter(act).find((c) => c.w.includes(barnNumber));

  if ($("permit-barn-title"))
    $("permit-barn-title").textContent = `إدارة أذونات عنبر رقم (${barnNumber})`;
  if ($("permit-barn-company"))
    $("permit-barn-company").textContent = company ? `الشركة المستأجرة الحالية: ${company.n}` : "العنبر ليس له شركة مستأجرة حالياً";
  
  if ($("permit-date")) $("permit-date").value = T0();
  if ($("permit-details")) {
    $("permit-details").style.display = "block";
    renderSingleBarnHistory(barnNumber);
    $("permit-details").scrollIntoView({ behavior: "smooth" });
  }
}

function closeBarnPermit() {
  activePermitBarn = null;
  renderPermitBarns();
  if ($("permit-details")) $("permit-details").style.display = "none";
  ["permit-item-name", "permit-item-type", "permit-unit", "permit-unit-weight", "permit-quantity", "permit-pallets", "permit-notes"].forEach(
    (id) => { if ($(id)) $(id).value = ""; }
  );
}

async function saveBarnPermit() {
  if (!activePermitBarn) return alert("اختر عنبر أولاً");

  const itemName = $("permit-item-name")?.value?.trim() || "";
  const quantity = parseFloat($("permit-quantity")?.value);

  if (!itemName || isNaN(quantity) || quantity <= 0) {
    return alert("يرجى إدخال اسم الصنف والكمية بشكل صحيح");
  }

  try {
    const client = sb();
    status("جارٍ حفظ الإذن في السحابة...");

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData?.session?.user;

    const activeContract = db.co.filter(act).find((c) => c.w.includes(activePermitBarn));

    const permitRow = {
      barn_id: activePermitBarn,
      contract_id: activeContract?.cid || null,
      company_id: activeContract?.id || null,
      item_name: itemName,
      item_type: $("permit-item-type")?.value?.trim() || null,
      unit: $("permit-unit")?.value?.trim() || null,
      unit_weight: parseFloat($("permit-unit-weight")?.value) || null,
      quantity: quantity,
      pallet_count: parseFloat($("permit-pallets")?.value) || null,
      permit_type: $("permit-direction")?.value || 'in',
      permit_date: $("permit-date")?.value || T0(),
      notes: $("permit-notes")?.value?.trim() || null,
      employee_id: user?.id || null,
      employee_name: user?.email || "مستخدم النظام"
    };

    await dbResult(client.from("barn_permits").insert(permitRow));

    alert("تم حفظ الإذن بنجاح!");
    
    ["permit-item-name", "permit-item-type", "permit-quantity", "permit-pallets", "permit-notes"].forEach(
      (id) => { if ($(id)) $(id).value = ""; }
    );

    await loadBarnPermits();
    status("تم الحفظ وتحديث السجلات بنجاح");
  } catch (e) {
    reportError(e);
  }
}

async function loadBarnPermits() {
  try {
    const client = sb();
    const permits = await dbResult(
      client.from("barn_permits").select("*").order("permit_date", { ascending: false }).order("created_at", { ascending: false })
    );

    allBarnPermitsCache = permits || [];

    const countEl = $("permit-count");
    if (countEl) countEl.textContent = allBarnPermitsCache.length;

    renderGeneralPermitsTable();

    if (activePermitBarn) {
      renderSingleBarnHistory(activePermitBarn);
    }
  } catch (e) {
    console.warn("تعذر جلب سجل أذونات العنابر:", e.message);
  }
}

// عرض جدول الأذونات الخاص بالعنبر المحدد
function renderSingleBarnHistory(barnNumber) {
  const tbody = $("single-barn-history-body");
  if (!tbody) return;

  const filtered = allBarnPermitsCache.filter(p => p.barn_id === barnNumber);

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="sm">لا توجد أذونات مسجلة لهذا العنبر حتى الآن</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (p) => `
      <tr>
        <td><b>${esc(p.item_name)}</b></td>
        <td>${esc(p.item_type || "—")}</td>
        <td><b>${f(p.quantity)}</b> ${esc(p.unit || "")}</td>
        <td>${p.pallet_count ?? "—"}</td>
        <td><span class="${p.permit_type === "in" ? "ok" : "no"}">${p.permit_type === "in" ? "دخول 📥" : "خروج 📤"}</span></td>
        <td>${p.permit_date}</td>
        <td class="sm">${esc(p.employee_name || "—")}</td>
        <td>${esc(p.notes || "—")}</td>
        <td>
          <div class="table-actions">
            <button class="small-btn btn-primary" onclick="editBarnPermit('${p.id}')">تعديل</button>
            <button class="small-btn btn-danger" onclick="deleteBarnPermit('${p.id}')">حذف</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}
// حذف إذن عنبر
async function deleteBarnPermit(id) {
  if (!confirm("هل أنت متأكد من حذف هذا الإذن نهائياً؟")) return;

  try {
    const client = sb();
    status("جارٍ حذف الإذن...");

    await dbResult(client.from("barn_permits").delete().eq("id", id));

    alert("تم حذف الإذن بنجاح.");
    await loadBarnPermits(); // إعادة تحميل السجلات وتحديثها
    status("تم الحذف بنجاح");
  } catch (e) {
    reportError(e);
  }
}

// تعديل إذن عنبر (سحب البيانات ووضعها في نموذج الإدخال للتحديث)
async function editBarnPermit(id) {
  const permit = allBarnPermitsCache.find(p => p.id === id);
  if (!permit) return alert("الإذن غير موجود في الذاكرة المؤقتة");

  // نقل المستخدم للعنبر الخاص بالإذن لو لم يكن مفتوحاً
  if (activePermitBarn !== permit.barn_id) {
    selectBarnForPermit(permit.barn_id);
  }

  // تعبئة حقول النموذج ببيانات الإذن المراد تعديله
  if ($("permit-item-name")) $("permit-item-name").value = permit.item_name || "";
  if ($("permit-item-type")) $("permit-item-type").value = permit.item_type || "";
  if ($("permit-unit")) $("permit-unit").value = permit.unit || "";
  if ($("permit-unit-weight")) $("permit-unit-weight").value = permit.unit_weight || "";
  if ($("permit-quantity")) $("permit-quantity").value = permit.quantity || "";
  if ($("permit-pallets")) $("permit-pallets").value = permit.pallet_count || "";
  if ($("permit-direction")) $("permit-direction").value = permit.permit_type || "in";
  if ($("permit-date")) $("permit-date").value = permit.permit_date || T0();
  if ($("permit-notes")) $("permit-notes").value = permit.notes || "";

  // تغيير زر الحفظ ليعمل كـ "تعديل وحفظ" مع الاحتفاظ بالمعرف (ID)
  const saveBtn = document.querySelector("#permit-details button.g");
  if (saveBtn) {
    saveBtn.textContent = "حفظ التعديلات";
    saveBtn.setAttribute("onclick", `updateBarnPermit('${id}')`);
  }

  window.scrollTo({ top: $("permit-details").offsetTop - 50, behavior: "smooth" });
}

// تنفيذ التعديل الفعلي وحفظ البيانات المُحدثة في Supabase
async function updateBarnPermit(id) {
  const itemName = $("permit-item-name")?.value?.trim() || "";
  const quantity = parseFloat($("permit-quantity")?.value);

  if (!itemName || isNaN(quantity) || quantity <= 0) {
    return alert("يرجى إدخال اسم الصنف والكمية بشكل صحيح");
  }

  try {
    const client = sb();
    status("جارٍ تحديث الإذن...");

    const updatedRow = {
      item_name: itemName,
      item_type: $("permit-item-type")?.value?.trim() || null,
      unit: $("permit-unit")?.value?.trim() || null,
      unit_weight: parseFloat($("permit-unit-weight")?.value) || null,
      quantity: quantity,
      pallet_count: parseFloat($("permit-pallets")?.value) || null,
      permit_type: $("permit-direction")?.value || 'in',
      permit_date: $("permit-date")?.value || T0(),
      notes: $("permit-notes")?.value?.trim() || null
    };

    await dbResult(client.from("barn_permits").update(updatedRow).eq("id", id));

    alert("تم تعديل الإذن بنجاح!");

    // إعادة زر الحفظ إلى وضعه الطبيعي
    const saveBtn = document.querySelector("#permit-details button.g");
    if (saveBtn) {
      saveBtn.textContent = "حفظ الإذن في العنبر";
      saveBtn.setAttribute("onclick", "saveBarnPermit()");
    }

    closeBarnPermit();
    await loadBarnPermits();
    status("تم التحديث بنجاح");
  } catch (e) {
    reportError(e);
  }
}

// عرض السجل العام لكل العنابر مع أزرار الإجراءات
function renderGeneralPermitsTable() {
  const tbody = $("permit-history-body");
  if (!tbody) return;

  const searchQuery = ($("permit-history-search")?.value || "").trim().toLowerCase();
  const dirFilter = $("permit-history-direction")?.value || "";

  const filtered = allBarnPermitsCache.filter(p => {
    const matchSearch = !searchQuery || 
      String(p.item_name || "").toLowerCase().includes(searchQuery) ||
      String(p.employee_name || "").toLowerCase().includes(searchQuery) ||
      String(p.barn_id).includes(searchQuery);
    
    const matchDir = !dirFilter || p.permit_type === dirFilter;

    return matchSearch && matchDir;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="sm">لا توجد نتائج مطابقة للبحث</td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map(
      (p) => `
      <tr>
        <td><b>عنبر ${p.barn_id}</b></td>
        <td><b>${esc(p.item_name)}</b></td>
        <td>${esc(p.item_type || "—")}</td>
        <td><b>${f(p.quantity)}</b> ${esc(p.unit || "")}</td>
        <td>${p.pallet_count ?? "—"}</td>
        <td><span class="${p.permit_type === "in" ? "ok" : "no"}">${p.permit_type === "in" ? "دخول 📥" : "خروج 📤"}</span></td>
        <td>${p.permit_date}</td>
        <td class="sm">${esc(p.employee_name || "—")}</td>
        <td>${esc(p.notes || "—")}</td>
        <td>
          <div class="table-actions">
            <button class="small-btn btn-primary" onclick="editBarnPermit('${p.id}')">تعديل</button>
            <button class="small-btn btn-danger" onclick="deleteBarnPermit('${p.id}')">حذف</button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}
