// Lee las pestañas del Sheet (valores tal como se ven) y arma EV (clases) y ST (alumnos).
(function (root) {
  const MESES = {enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,setiembre:8,octubre:9,noviembre:10,diciembre:11};
  const ABR = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,set:8,oct:9,nov:10,dic:11};
  const pad = n => String(n).padStart(2, "0");
  const hhmm = (h, m) => pad(+h) + ":" + m;
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const RANGE = /(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/g;

  function isHeaderRow(r) {
    let nums = 0;
    for (let k = 0; k < 14; k++) {
      const v = String(r[k] == null ? "" : r[k]).trim();
      if (!v) continue;
      if (k % 2 === 0 && /^\d{1,2}$/.test(v)) nums++; else return false;
    }
    return nums > 0;
  }

  function parseMonth(vals) {
    const title = String((vals[0] || [])[0] || "");
    const m = title.match(/([A-Za-zÁÉÍÓÚáéíóú]+)\s+(\d{4})/);
    if (!m) return [];
    const month = MESES[norm(m[1])], year = +m[2];
    if (month == null) return [];
    const out = [];
    let days = null;
    for (let i = 1; i < vals.length; i++) {
      const r = vals[i] || [];
      if (isHeaderRow(r)) { days = []; for (let k = 0; k < 7; k++) { const v = String(r[2 * k] || "").trim(); days[k] = /^\d{1,2}$/.test(v) ? +v : null; } continue; }
      if (!days) continue;
      for (let k = 0; k < 7; k++) {
        if (!days[k]) continue;
        const t = String(r[2 * k] || ""), n = String(r[2 * k + 1] || "");
        if (!n.trim()) continue;
        const rs = [...t.matchAll(RANGE)].map(x => ({ s: hhmm(x[1], x[2]), e: hhmm(x[3], x[4]) }));
        if (!rs.length) continue;
        const date = year + "-" + pad(month + 1) + "-" + pad(days[k]);
        cell(out, date, rs, n);
      }
    }
    return out;
  }

  function cell(out, date, rs, n) {
    if (/campus/i.test(n)) {
      const lines = n.split("\n").map(s => s.trim()).filter(Boolean);
      const title = lines.filter(l => !/campus/i.test(l))
        .map(l => l.split("|")[0].replace(/\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/g, "").replace(/\([^)]*\)/g, "").trim())
        .filter(Boolean).join(" + ");
      out.push({ date, start: rs[0].s, end: rs[rs.length - 1].e, title: title || lines[0], type: "upc", people: [], note: lines.slice(1).join(" · ") });
      return;
    }
    const rec = /recuperaci/i.test(n);
    const clean = n.replace(/\(?\s*recuperaci[oó]n\s*\)?/ig, " ");
    let parts = clean.split(/\s{3,}|\n/).map(s => s.trim().replace(/^\(+/, "").replace(/[\s,]+$/, "").trim()).filter(Boolean);
    if (!parts.length) return;
    const note = rec ? "Recuperación" : "";
    if (rs.length > 1 && parts.length === rs.length) {
      rs.forEach((r, i) => out.push({ date, start: r.s, end: r.e, title: parts[i], type: "", people: [], note }));
    } else {
      out.push({ date, start: rs[0].s, end: rs[rs.length - 1].e, title: parts.join(" "), type: "", people: [], note });
    }
  }

  function build(tabs) {
    // Alumnos
    const al = (tabs.Alumnos || tabs.alumnos || []);
    const head = (al[0] || []).map(norm);
    const col = name => head.findIndex(h => h.startsWith(name));
    const C = { a: col("alumno"), mod: col("modalidad"), niv: col("nivel"), dias: col("dias"), hor: col("horario"), paq: col("clases"), ren: col("renovacion"), saldo: col("saldo"), est: col("estado"), notas: col("notas") };
    const g = (r, i) => i >= 0 ? String(r[i] == null ? "" : r[i]).trim() : "";
    const alumnos = al.slice(1).filter(r => g(r, C.a)).map(r => ({
      name: g(r, C.a), key: norm(g(r, C.a)), mod: g(r, C.mod) || "", niv: g(r, C.niv), dias: g(r, C.dias), hor: g(r, C.hor),
      paq: g(r, C.paq), ren: g(r, C.ren), saldo: g(r, C.saldo), est: g(r, C.est), notas: g(r, C.notas)
    }));
    const uniq = []; const seen = new Set();
    alumnos.forEach(a => { if (!seen.has(a.key)) { seen.add(a.key); uniq.push(a); } });

    // Clases
    let ev = [];
    Object.keys(tabs).forEach(k => { if (norm(k) !== "alumnos") ev = ev.concat(parseMonth(tabs[k] || [])); });
    const partKeys = uniq.filter(a => /particular|pareja/i.test(a.mod)).map(a => a.key);
    ev.forEach(e => {
      if (e.type) return;
      const k = norm(e.title);
      e.type = (/\((particular|pareja|sola)\)/i.test(e.title) || partKeys.some(p => k === p)) ? "particular" : "grupal";
    });
    // juntar bloques seguidos de la misma persona
    ev.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    const merged = [];
    ev.forEach(e => {
      const p = merged[merged.length - 1];
      if (p && p.date === e.date && p.type === e.type && p.type !== "upc" && norm(p.title) === norm(e.title) && p.end === e.start && p.note === e.note) {
        p.end = e.end; p._n = (p._n || 1) + 1;
      } else merged.push(Object.assign({}, e));
    });
    merged.forEach(e => {
      if (e._n) { e.note = [e.note, e._n + " clases seguidas"].filter(Boolean).join(" · "); delete e._n; }
      if (e.type === "grupal") e.people = e.title.split(/,/).map(s => s.trim()).filter(Boolean);
      if (e.type === "particular") e.people = [e.title];
    });

    // Fechas por alumno
    const years = merged.map(e => +e.date.slice(0, 4));
    const yr = years.length ? Math.max(...years) : new Date().getFullYear();
    const keys = uniq.map(a => a.key).filter(Boolean);
    const datesBy = {}; keys.forEach(k => datesBy[k] = new Set());
    const has = (txt, k) => (" " + txt + " ").includes(" " + k + " ");
    merged.forEach(e => {
      if (e.type === "upc") return;
      const txt = norm(e.title);
      let hit = keys.filter(k => has(txt, k));
      hit = hit.filter(k => !hit.some(o => o !== k && o.length > k.length && has(o, k)));
      hit.forEach(k => datesBy[k].add(e.date));
    });
    const parseRen = s => {
      const m = norm(s).match(/^(\d{1,2}) ([a-z]{3})/); if (!m || ABR[m[2]] == null) return null;
      let y = yr; const mo = ABR[m[2]];
      const lastMo = merged.length ? +merged[merged.length - 1].date.slice(5, 7) - 1 : mo;
      if (mo < lastMo - 6) y++;
      return y + "-" + pad(mo + 1) + "-" + pad(+m[1]);
    };
    const st = uniq.map(a => {
      const saldo = a.saldo && !/^s?\/?\s*0([.,]0+)?$/i.test(a.saldo.replace(/\s/g, "")) && /pend/i.test(a.est || "pend") ? "Saldo pendiente " + a.saldo : null;
      return {
        name: a.name, label: a.name, mod: a.mod || "—", niv: a.niv || "Por confirmar",
        dates: [...datesBy[a.key]].sort(), hor: [a.hor || a.dias || ""].filter(Boolean),
        paq: a.paq ? +a.paq || a.paq : null, ren: parseRen(a.ren), pago: saldo, nota: a.notas
      };
    });
    return { EV: merged, ST: st };
  }

  root.MarineraParse = { build, parseMonth, norm };
  if (typeof module !== "undefined") module.exports = root.MarineraParse;
})(typeof window !== "undefined" ? window : globalThis);
