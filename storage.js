// Storage layer for the yard system.
// With Supabase details in config.js, data is shared between computers.
// Without them, the page saves to this browser only.
(function () {
  var CFG = window.YARD_CONFIG || {};

  function supaDB() {
    var U = CFG.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/yard_docs";
    var H = { apikey: CFG.SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    // Older "anon" keys are JWTs and go in Authorization too; newer "sb_publishable_" keys do not.
    if (CFG.SUPABASE_ANON_KEY.indexOf("sb_") !== 0) H.Authorization = "Bearer " + CFG.SUPABASE_ANON_KEY;
    var pending = 0, ticks = [];
    function req(url, opt) {
      return fetch(url, opt).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw { code: "http_" + r.status, message: t }; });
        return r.status === 204 ? null : r.text().then(function (t) { return t ? JSON.parse(t) : null; });
      });
    }
    function poke() { ticks.forEach(function (t) { t(); }); }
    function done() { pending--; poke(); }
    function fail(e) { pending--; throw e; }
    function watch(coll, cb, err, extra) {
      var last = null, stop = false;
      function tick() {
        if (stop || pending > 0) return;
        req(U + "?coll=eq." + encodeURIComponent(coll) + "&select=path,data" + (extra || ""), { headers: H }).then(function (rows) {
          var j = JSON.stringify(rows);
          if (j !== last) { last = j; cb(rows); }
        }, function (e) { if (err) err(e); });
      }
      ticks.push(tick); tick();
      var t = setInterval(tick, 8000);
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
            var h = Object.assign({ Prefer: "resolution=merge-duplicates,return=minimal" }, H);
            return req(U + "?on_conflict=path", { method: "POST", headers: h, body: JSON.stringify({ path: path, coll: coll, data: d }) }).then(done, fail);
          },
          delete: function () {
            pending++;
            return req(U + "?path=eq." + encodeURIComponent(path), { method: "DELETE", headers: H }).then(done, fail);
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
        var extra = opts && opts.limit ? "&order=path.desc&limit=" + opts.limit : "";
        return { onSnapshot: function (cb, err) { return watch(coll, function (rows) { cb(collSnap(rows)); }, err, extra); } };
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

  window.claude = {
    use: function (name) {
      if (name === "downloads") return Promise.resolve({ save: saveFile });
      if (name === "user") return Promise.resolve({ can: function () { return Promise.resolve(true); } });
      if (name === "db") return Promise.resolve(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY ? supaDB() : null);
      return Promise.resolve(null);
    }
  };
})();
