// Copyright (c) 2026 David Kerr. All rights reserved.
// Storage and sign-in layer for the yard system.
// With Supabase details in config.js, people must sign in and data is shared between computers.
// Without them, the page saves to this browser only (no sign-in).
(function () {
  var CFG = window.YARD_CONFIG || {};
  var KEY = CFG.SUPABASE_ANON_KEY || "";
  var BASE = (CFG.SUPABASE_URL || "").replace(/\/$/, "");
  var ON = !!(BASE && KEY);
  var SKEY = "yardmgr.auth." + BASE.replace(/^https?:\/\//, "");
  var sess = null;
  try { sess = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (e) {}

  function store(s) { sess = s; try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch (e) {} }
  function now() { return Math.floor(Date.now() / 1000); }
  function mkErr(j, status) {
    return { code: (j && (j.error_code || j.code)) || ("http_" + status), message: (j && (j.error_description || j.msg || j.message || j.error)) || "Request failed" };
  }
  function parse(r) {
    return r.text().then(function (t) {
      var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = { message: t }; }
      if (!r.ok) throw mkErr(j, r.status);
      return j;
    });
  }
  function authFetch(path, o) {
    o = o || {};
    var h = { apikey: KEY, "Content-Type": "application/json" };
    if (o.token) h.Authorization = "Bearer " + o.token;
    return fetch(BASE + "/auth/v1/" + path, { method: o.method || "POST", headers: h, body: o.body ? JSON.stringify(o.body) : undefined }).then(parse);
  }
  function adopt(j) {
    if (!j || !j.access_token) return null;
    store({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (now() + (j.expires_in || 3600)), user: j.user || (sess && sess.user) || null });
    return sess;
  }
  var refreshing = null;
  function token() {
    if (!sess) return Promise.resolve(null);
    if (sess.expires_at - 60 > now()) return Promise.resolve(sess.access_token);
    if (!refreshing) {
      refreshing = authFetch("token?grant_type=refresh_token", { body: { refresh_token: sess.refresh_token } })
        .then(function (j) { adopt(j); return sess.access_token; }, function () { store(null); return null; })
        .then(function (t) { refreshing = null; return t; });
    }
    return refreshing;
  }
  function rest(path, o, retried) {
    o = o || {};
    return token().then(function (t) {
      var h = Object.assign({ apikey: KEY, "Content-Type": "application/json" }, o.headers || {});
      if (t) h.Authorization = "Bearer " + t; else if (KEY.indexOf("sb_") !== 0) h.Authorization = "Bearer " + KEY;
      return fetch(BASE + "/rest/v1/" + path, Object.assign({}, o, { headers: h }));
    }).then(function (r) {
      if (r.status === 401 && !retried && sess) { sess.expires_at = 0; return rest(path, o, true); }
      return r.status === 204 ? null : parse(r);
    });
  }

  var Auth = {
    on: ON,
    user: function () { return sess && sess.user; },
    restore: function () {
      if (!ON || !sess) return Promise.resolve(null);
      return token().then(function (t) {
        if (!t) return null;
        if (sess.user) return sess.user;
        return authFetch("user", { method: "GET", token: t }).then(function (u) { sess.user = u; store(sess); return u; });
      });
    },
    login: function (email, pw) {
      return authFetch("token?grant_type=password", { body: { email: email, password: pw } }).then(function (j) { adopt(j); return sess.user; });
    },
    signup: function (email, pw, name) {
      return authFetch("signup", { body: { email: email, password: pw, data: { name: name } } }).then(function (j) {
        if (j && j.access_token) { adopt(j); return { signedIn: true }; }
        return { signedIn: false };
      });
    },
    logout: function () {
      var t = sess && sess.access_token; store(null);
      return t ? authFetch("logout", { token: t }).catch(function () {}) : Promise.resolve();
    },
    recover: function (email) { return authFetch("recover", { body: { email: email } }); },
    recoveryFromHash: function () {
      var h = location.hash || "";
      if (h.indexOf("type=recovery") < 0 || h.indexOf("access_token=") < 0) return Promise.resolve(false);
      var p = {}; h.replace(/^#/, "").split("&").forEach(function (kv) { var a = kv.split("="); p[a[0]] = decodeURIComponent(a[1] || ""); });
      history.replaceState(null, "", location.pathname + location.search);
      store({ access_token: p.access_token, refresh_token: p.refresh_token, expires_at: now() + (+p.expires_in || 3600), user: null });
      return authFetch("user", { method: "GET", token: p.access_token }).then(function (u) { sess.user = u; store(sess); return true; }, function () { return false; });
    },
    setPassword: function (pw) { return token().then(function (t) { return authFetch("user", { method: "PUT", token: t, body: { password: pw } }); }); },
    profile: function () {
      var u = sess && sess.user; if (!u) return Promise.resolve(null);
      return rest("profiles?id=eq." + encodeURIComponent(u.id) + "&select=*").then(function (rows) { return rows && rows[0] || null; });
    },
    profiles: function () { return rest("profiles?select=*&order=created_at.asc"); },
    updateProfile: function (id, patch) {
      return rest("profiles?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) });
    }
  };

  function supaDB() {
    var pending = 0, ticks = [];
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poke(); });
    function poke() { ticks.forEach(function (t) { t(); }); }
    function done() { pending--; poke(); }
    function fail(e) { pending--; throw e; }
    function watch(coll, cb, err, extra, every) {
      var last = null, stop = false;
      function tick() {
        if (stop || pending > 0 || document.hidden) return;
        rest("yard_docs?coll=eq." + encodeURIComponent(coll) + "&select=path,data" + (extra || "")).then(function (rows) {
          var j = JSON.stringify(rows);
          if (j !== last) { last = j; cb(rows || []); }
        }, function (e) { if (err) err(e); });
      }
      ticks.push(tick); tick();
      var t = setInterval(tick, every || 20000);
      return function () { stop = true; clearInterval(t); };
    }
    function collSnap(rows) {
      var docs = rows.map(function (r) { return { id: r.path.split("/").pop(), exists: true, data: function () { return r.data; } }; });
      return { docs: docs, empty: !docs.length, size: docs.length, metadata: { fromCache: false, hasPendingWrites: false } };
    }
    return {
      doc: function (path) {
        var coll = path.split("/")[0];
        return {
          set: function (d) {
            pending++;
            return rest("yard_docs?on_conflict=path", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ path: path, coll: coll, data: d }) }).then(done, fail);
          },
          delete: function () {
            pending++;
            return rest("yard_docs?path=eq." + encodeURIComponent(path), { method: "DELETE" }).then(done, fail);
          },
          onSnapshot: function (cb, err) {
            return watch(coll, function (rows) {
              var m = rows.filter(function (r) { return r.path === path; })[0];
              cb({ exists: !!m, data: function () { return m && m.data; }, metadata: { fromCache: false, hasPendingWrites: false } });
            }, err);
          }
        };
      },
      collection: function (coll, opts) {
        var extra = opts && opts.limit ? "&order=path.desc&limit=" + opts.limit : "", every = opts && opts.every;
        return { onSnapshot: function (cb, err) { return watch(coll, function (rows) { cb(collSnap(rows)); }, err, extra, every); } };
      }
    };
  }

  function saveFile(o) {
    var b = new Blob([o.data], { type: "application/octet-stream" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = o.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    return Promise.resolve({ status: "saved" });
  }

  window.YardAuth = Auth;
  window.yardHost = {
    use: function (name) {
      if (name === "downloads") return Promise.resolve({ save: saveFile });
      if (name === "user") return Promise.resolve({ can: function () { return Promise.resolve(true); } });
      if (name === "db") return Promise.resolve(ON && sess ? supaDB() : null);
      return Promise.resolve(null);
    }
  };
})();
