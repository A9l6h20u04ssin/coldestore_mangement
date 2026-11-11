/* Supabase authentication and database helpers. Use only the public anon/publishable key here. */
(() => {
  "use strict";

  const SUPABASE_URL = "https://ezmuunokxdttzihmwotx.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6bXV1bm9reGR0dHppaG13b3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTAyNzEsImV4cCI6MjEwODE2NjI3MX0.fJq7nDrvrRlctlT94SpYRbbCl8xFsi2pjfm1Z6lxAmY";

  const configured =
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 0 &&
    !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
    !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");

  const client =
    configured && window.supabase
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;

  const isLoginPage = /(^|\/)login\.html$/.test(location.pathname);
  const $ = (id) => document.getElementById(id);

  function showMessage(message, good = false) {
    const el = $("login-status") || $("connection-status");
    if (el) {
      el.textContent = message;
      el.classList.toggle("ok", good);
      el.classList.toggle("no", !good);
    }
  }

  function requireClient() {
    if (!client)
      throw new Error(
        "قبل تسجيل الدخول، ضع Project URL و anon/publishable key في ملف js/supabase.js."
      );
    return client;
  }

  // التحقق من الصلاحيات بناءً على جدول user_roles الجديد
  async function ownerOnly() {
    const sb = requireClient();
    const {
      data: { session },
      error: sessionError,
    } = await sb.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session) return false;

    const user = session.user;

    // التحقق من جدول user_roles المخصص بناءً على user_id و role
    const { data: roleData, error: roleError } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleError && roleData && roleData.role === "admin") {
      return true;
    }

    throw new Error("الحساب غير مسجل كمدير (Admin) في جدول الصلاحيات.");
  }

  async function signIn(email, password) {
    const sb = requireClient();

    if (!email.trim() || !password)
      throw new Error("اكتب البريد الإلكتروني وكلمة المرور.");

    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error)
      throw new Error(
        error.message === "Invalid login credentials"
          ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
          : error.message
      );

    if (!data.session) {
      throw new Error("تعذر إنشاء جلسة دخول.");
    }

    location.replace("index.html");
    return true;
  }

  async function signOut() {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
    location.replace("login.html");
  }

  async function refreshAuthUI() {
    if (!client) {
      showMessage("الاتصال بقاعدة البيانات غير مُعدّ.");
      const submit = $("auth-login");
      if (submit) submit.disabled = true;
      const shell = $("app-shell");
      if (shell) shell.style.display = "none";
      return;
    }

    try {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();

      if (error) throw error;

      if (!session) {
        if (isLoginPage) {
          showMessage("سجّل الدخول للمتابعة.");
        } else {
          location.replace("login.html");
        }
        return;
      }

      if (isLoginPage) {
        location.replace("index.html");
        return;
      }

      const shell = $("app-shell");
      if (shell) shell.style.display = "";

      showMessage(`متصل بحساب ${session.user.email}`, true);
    } catch (e) {
      console.error("AUTH ERROR:", e);
      showMessage(e.message || "تعذر التحقق من الحساب.");
      const shell = $("app-shell");
      if (shell) shell.style.display = "none";
    }
  }

  async function select(table, query = "*", options = {}) {
    const sb = requireClient();
    if (!(await ownerOnly()))
      throw new Error("سجّل الدخول بحساب المالك أولًا.");

    let request = sb.from(table).select(query);

    if (options.order)
      request = request.order(options.order.column, {
        ascending: options.order.ascending ?? true,
      });

    if (options.eq)
      for (const [column, value] of Object.entries(options.eq))
        request = request.eq(column, value);

    const { data, error } = await request;
    if (error) throw error;
    return data;
  }

  async function insert(table, values, returning = "*") {
    if (!(await ownerOnly()))
      throw new Error("سجّل الدخول بحساب المالك أولًا.");

    const { data, error } = await requireClient()
      .from(table)
      .insert(values)
      .select(returning)
      .single();

    if (error) throw error;
    return data;
  }

  async function upsert(table, values, conflict) {
    if (!(await ownerOnly()))
      throw new Error("سجّل الدخول بحساب المالك أولًا.");

    const { data, error } = await requireClient()
      .from(table)
      .upsert(values, conflict ? { onConflict: conflict } : undefined)
      .select();

    if (error) throw error;
    return data;
  }

  async function update(table, id, values) {
    if (!(await ownerOnly()))
      throw new Error("سجّل الدخول بحساب المالك أولًا.");

    const { data, error } = await requireClient()
      .from(table)
      .update(values)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function remove(table, id) {
    if (!(await ownerOnly()))
      throw new Error("سجّل الدخول بحساب المالك أولًا.");

    const { error } = await requireClient().from(table).delete().eq("id", id);
    if (error) throw error;
  }

  window.AppSupabase = {
    configured,
    get client() {
      return client;
    },
    signIn,
    signOut,
    refreshAuthUI,
    ownerOnly,
    select,
    insert,
    upsert,
    update,
    remove,
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.supabase) {
      showMessage("مكتبة Supabase لم يتم تحميلها. راجع ترتيب ملفات JavaScript.");
    }

    const loginForm = $("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = $("auth-login");
        if (button) button.disabled = true;

        try {
          await signIn(
            $("auth-email")?.value || "",
            $("auth-password")?.value || ""
          );
        } catch (error) {
          showMessage(error.message || "فشل تسجيل الدخول.");
        } finally {
          if (button) button.disabled = false;
        }
      });
    }

    const logoutButton = $("auth-logout");
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await signOut();
        } catch (error) {
          showMessage(error.message || "تعذر تسجيل الخروج.");
        }
      });
    }

    refreshAuthUI();
  });
})();
