/*
 * La scheda del canone per gli accordi descritti solo con i dati
 * ("regole.generico": true, es. Cagliari, Trieste): il modulo
 * #scheda-generica si costruisce dal file dell'accordo. Calcolo in
 * canone-generico.js, PDF in stampa-generica.js (titoli e testi del modulo
 * ufficiale presi da "pdf" nel file dell'accordo).
 */
(function () {
  "use strict";
  const modulo = document.getElementById("scheda-generica");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneGenerico.virgola(n, c);
  const virgolaN = (n) => String(n).replace(".", ",");
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "indirizzo", "piano", "foglio", "particella", "subalterno", "mq_porzione", "canone_mensile"];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";
  const R = () => accordo.regole;
  const unita = () => (R().unita === "anno" ? "all'anno" : "al mese");

  function soglieTesto(z) {
    const F = R().fasce, s = (F.soglie_zona && z && F.soglie_zona[z.codice]) || F.soglie, cosa = F.criterio === "punti" ? "punti" : "elementi";
    if (F.criterio === "scelta") return F.nota || "fascia scelta in base al foglio di calcolo dell'accordo";
    if (!s.length) return "una sola fascia per zona; gli elementi indicano se avvicinarsi al minimo o al massimo";
    return F.nomi.map((nome, i) => i === 0 ? `${nome}: fino a ${s[0]} ${cosa}` : i < s.length ? `${nome}: da ${s[i - 1] + 1} a ${s[i]}` : `${nome}: da ${s[i - 1] + 1}`).join(" · ") + (F.almeno ? ` (${F.almeno.avviso.replace(/^Per /, "per ").replace(/\.$/, "")})` : "") + (F.nota_soglie ? `; ${F.nota_soglie}` : "");
  }

  function costruisci() {
    const r = R();
    campo("zona").innerHTML = '<option value="">scegli…</option>' + r.zone.map((z) => `<option value="${testo(z.codice)}">${testo(z.nome)}</option>`).join("");
    const durate = r.durate || [3, 4, 5, 6];
    const pd = (n) => (r.durata && r.durata[String(n)] ? ` (+${v(r.durata[String(n)], r.durata[String(n)] % 1 ? 1 : 0)}%)` : "");
    $("gen-durata").innerHTML = durate.map((n) => `<option value="${n}">${n} + 2 anni${n === 6 ? " o più" : ""}${pd(n)}</option>`).join("");
    $("gen-titolo-elementi").textContent = (accordo.pdf && accordo.pdf.titolo_elementi) || (r.fasce.criterio === "punti" ? "Parametri e punteggi" : "Elementi");
    $("gen-elementi").innerHTML = r.elementi.map((e, i) => {
      const g = [...(r.fasce.gruppi || []), ...(r.titoli_elementi || [])].find((x) => x.da === i);
      const titolo = g ? `<h3 class="stacco">${testo(g.titolo || g.nome)}</h3>` : "";
      if (e.livelli) return `${titolo}<label class="livello"><span><b class="codice">${i + 1}</b> ${testo(e.testo)}</span><select name="el" data-i="${i}"><option value="">scegli…</option>${e.livelli.map((l, k) => `<option value="${k}">${testo(l.testo)}${e.mostra_punti === false ? "" : ` (${virgolaN(l.punti)} ${l.punti === 1 ? "punto" : "punti"})`}</option>`).join("")}</select></label>`;
      return `${titolo}<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1}</b> ${testo(e.testo)}${e.punti ? ` <small>(${virgolaN(e.punti)} ${e.punti === 1 ? "punto" : "punti"})</small>` : ""}</span></label>`;
    }).join("");
    const S = r.superficie || {};
    $("gen-superfici").innerHTML = [{ chiave: "base", testo: S.base || "Superficie dell'alloggio" }, ...(S.voci || [])].map((x) => `
      <tr data-riga="${x.chiave}">
        <th scope="row">${testo(x.testo)}${x.coeff !== undefined && !String(x.testo).includes("%") ? ` (${v(x.coeff * 100, 0)}%)` : ""}</th>
        <td><input type="text" class="campo-numero" name="sup_${x.chiave}" inputmode="decimal" aria-label="${testo(x.testo)}, mq"></td>
        <td class="risultato" data-sup="${x.chiave}">—</td>
      </tr>`).join("");
    $("gen-maggiorazioni").innerHTML = (r.maggiorazioni || []).filter((m) => m.tipo !== "auto").map((m) => {
      const cl = m.contratti ? m.contratti.map((c) => `per-${c}`).join(" ") : "";
      if (m.tipo === "scelta") return `<div class="griglia-campi stacco ${cl}" data-m="${m.chiave}"><label class="largo">${testo(m.testo)}<select name="m_${m.chiave}">` +
        `<option value="">${testo(m.nessuna || "no")}</option>` + m.opzioni.map((o) => `<option value="${testo(o.valore)}">${testo(o.testo)}${o.perc && m.mostra_perc !== false ? ` (${o.perc > 0 ? "+" : ""}${v(o.perc, o.perc % 1 ? 1 : 0)}%)` : ""}</option>`).join("") + `</select></label></div>`;
      return `<div class="caselle colonna stacco ${cl}" data-m="${m.chiave}"><label><input type="checkbox" name="m_${m.chiave}"> ${testo(m.testo)} (${m.perc > 0 ? "+" : ""}${v(m.perc, m.perc % 1 ? 1 : 0)}%)</label></div>`;
    }).join("") + (r.nota_maggiorazioni ? `<p class="nota-copia stacco">${testo(r.nota_maggiorazioni)}</p>` : "");
    $("gen-valore-etichetta").textContent = `Valore al mq ${unita()} (€)`;
  }

  function leggi() {
    const r = R(), s = { modello: accordo.accordo.modello, tipo: radio("tipo"), zona: campo("zona").value, durata_anni: Number(campo("durata_anni").value) || 3, porzione: campo("porzione").checked };
    for (const k of TESTI) s[k] = campo(k).value.trim();
    s.citta = (accordo.accordo.comune || "").toUpperCase();
    const valore = $("gen-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const x of [{ chiave: "base" }, ...((r.superficie || {}).voci || [])]) s.superfici[x.chiave] = campo("sup_" + x.chiave).value.trim();
    s.elementi = [...modulo.querySelectorAll("[name=el]")].map((c) => (c.tagName === "SELECT" ? c.value : c.checked));
    s.maggiorazioni_scelte = {};
    for (const m of r.maggiorazioni || []) { if (m.tipo === "auto") continue; const c = campo("m_" + m.chiave); s.maggiorazioni_scelte[m.chiave] = m.tipo === "scelta" ? c.value : c.checked; }
    s.catasto = { foglio: s.foglio, particella: s.particella, subalterno: s.subalterno };
    const arr = (r.maggiorazioni || []).find((m) => m.ammobiliato);
    let ammob = "";
    if (arr) { const val = s.maggiorazioni_scelte[arr.chiave]; if (arr.tipo === "scelta") { const o = arr.opzioni.find((x) => x.valore === val); if (o) ammob = String(o.perc); } else if (val) ammob = String(arr.perc); }
    s.maggiorazioni = { ammobiliato: ammob };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const c = modulo.querySelector(`input[name=tipo][value="${d.tipo}"]`); if (c) c.checked = true;
    if (d.zona) campo("zona").value = d.zona;
    if (d.durata_anni) campo("durata_anni").value = String(d.durata_anni);
    campo("porzione").checked = !!d.porzione;
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    for (const [k, val] of Object.entries(d.superfici || {})) if (campo("sup_" + k)) campo("sup_" + k).value = val;
    modulo.querySelectorAll("[name=el]").forEach((x, i) => { const val = (d.elementi || [])[i]; if (x.tagName === "SELECT") x.value = val === undefined || val === null || val === false ? "" : String(val); else x.checked = !!val; });
    for (const m of R().maggiorazioni || []) {
      if (m.tipo === "auto") continue;
      const el = campo("m_" + m.chiave), val = (d.maggiorazioni_scelte || {})[m.chiave];
      if (m.tipo === "scelta") el.value = val || ""; else el.checked = !!val;
    }
    const valore = $("gen-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneGenerico.calcola(accordo, s);
    ultimo = { scheda: s, r };
    for (const t of ["agevolato", "transitorio", "studenti"]) modulo.classList.toggle("tipo-" + t, s.tipo === t);
    modulo.classList.toggle("porzione", s.porzione);
    modulo.querySelectorAll("[data-m]").forEach((el) => {
      const m = (R().maggiorazioni || []).find((x) => x.chiave === el.dataset.m), z = s.zona;
      el.hidden = !!(m && ((m.contratti && !m.contratti.includes(s.tipo)) || (m.zone && z && !m.zone.includes(z)) || (m.escluse && m.escluse.includes(z))));
    });
    const sup = r.superficie;
    for (const td of modulo.querySelectorAll("[data-sup]")) {
      const riga = sup && sup.righe.find((x) => x.chiave === td.dataset.sup);
      td.textContent = riga && riga.mq ? v(riga.convenzionale) : "—";
    }
    $("gen-totale").textContent = sup ? v(sup.totale) : "—";
    $("gen-sup-nota").textContent = (R().superficie || {}).nota || "";
    $("gen-zona-nota").textContent = r.zona ? (r.zona.nota || "") : ((accordo.pdf && accordo.pdf.nota_zone) || "");
    $("gen-soglie").textContent = R().fasce.gruppi ? (R().fasce.nota || "") : `Fasce${r.zona ? ` (${r.zona.nome})` : ""}: ${soglieTesto(r.zona)}.`;
    $("gen-conteggio").textContent = r.fascia.prevalente ? `· livello ${r.fascia.nome.toLowerCase()}` : R().fasce.criterio === "scelta" ? `· ${$("gen-elementi").querySelectorAll("input:checked").length} su ${R().elementi.length}` : R().fasce.criterio === "punti" ? `· ${virgolaN(r.punti)} punti` : R().fasce.conta ? `· ${r.punti} base${r.premium !== undefined ? `, ${r.premium} premium` : ""}` : `· ${r.punti} su ${R().elementi.length}`;
    $("gen-esito-fascia").textContent = r.base
      ? `${r.zona.nome}, fascia ${r.fascia.nome}${R().fasce.criterio === "scelta" || r.fascia.prevalente ? "" : ` (${virgolaN(r.punti)} ${R().fasce.criterio === "punti" ? (r.punti === 1 ? "punto" : "punti") : (r.punti === 1 ? "elemento" : "elementi")})`}: da € ${v(r.base[0])} a € ${v(r.base[1])} al mq ${unita()}` : `fascia ${r.fascia.nome}`;
    $("gen-esito-magg").textContent = r.maggiorazioni.length
      ? r.maggiorazioni.map((m) => `${m.nome} ${m.perc > 0 ? "+" : ""}${v(m.perc, m.perc % 1 ? 1 : 0)}%`).join(", ") + (r.maggiorazioni.length > 1 ? ` = ${r.fattore >= 1 ? "+" : ""}${v((r.fattore - 1) * 100)}%` : "") +
        (r.valori ? ` → da € ${v(r.valori[0])} a € ${v(r.valori[1])}` : "")
      : "nessuna";
    const valore = $("gen-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto);
    $("gen-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto)}` : "il massimo della fascia";
    $("gen-esito-minimo").textContent = euro(r.canone_minimo);
    $("gen-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("gen-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "gen-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
    ricalcola();
  });
  modulo.addEventListener("change", ricalcola);

  let risorse = null;
  async function creaPDF() {
    if (window.caricaLibrerie) await window.caricaLibrerie("pdf");
    if (!ultimo || !window.PDFLib || !window.fontkit) throw new Error("la stampa non è ancora pronta, riprova tra un attimo");
    if (!risorse) {
      const prendi = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error("file mancante: " + f); return r.arrayBuffer(); });
      const [regolare, grassetto, icona, sansRegolare, sansGrassetto] = await Promise.all([
        prendi("assets/canone/caratteri/LiberationSerif-Regular.ttf"), prendi("assets/canone/caratteri/LiberationSerif-Bold.ttf"),
        fetch("assets/canone/icona-locaonline.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
        prendi("assets/canone/caratteri/Carlito-Regular.ttf"), prendi("assets/canone/caratteri/Carlito-Bold.ttf")]);
      risorse = { regolare, grassetto, icona, sansRegolare, sansGrassetto };
    }
    const byte = await StampaGenerica.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return [`Scheda canone ${accordo.accordo.comune}`, s.locatore || "", ultimo.r.zona ? ultimo.r.zona.nome : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = !!(e.detail && e.detail.regole && e.detail.regole.generico);
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("gen-valore").dataset.modificato;
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!accordo) return "Scheda del canone";
      if (!ultimo) return `Scheda del canone (${accordo.accordo.comune})`;
      const s = ultimo.scheda, r = ultimo.r;
      return [accordo.accordo.comune, r.zona ? r.zona.nome.toLowerCase() : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaGenerica = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
