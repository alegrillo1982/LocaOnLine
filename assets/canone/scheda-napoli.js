/*
 * La scheda del canone per l'accordo di Napoli (2025): il modulo
 * #scheda-napoli, che riproduce la "Scheda determinativa del canone
 * concordato" (allegato H). Si attiva con un accordo "modello": "napoli-2025".
 * Calcolo in canone-napoli.js, PDF in stampa-napoli.js. Verso il resto della
 * pagina espone le stesse funzioni della scheda di Roma (window.SchedeCitta).
 */
(function () {
  "use strict";
  const MODELLO = "napoli-2025";
  const modulo = document.getElementById("scheda-napoli");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneNapoli.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "conduttore", "citta", "indirizzo", "foglio", "particella", "subalterno", "mesi",
    "verde_mq", "verde_millesimi", "superficie_locata", "canone_annuo"];
  const CORR = ["arredo", "transitorio", "veduta", "pregio", "non_pregio", "piccoli", "grandi", "risparmio", "giardino", "basso"];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  // ------------------------------------------------------------- costruzione
  function costruisci() {
    campo("sezione").innerHTML = '<option value="">scegli…</option>' +
      CanoneNapoli.SEZIONI(accordo).map((s) => `<option>${s}</option>`).join("");
    $("napoli-elementi").innerHTML = accordo.elementi.map((d, i) =>
      `<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1})</b> ${testo(d)}</span></label>`).join("");
    $("napoli-superfici").innerHTML = accordo.regole.superficie.map((r) => `
      <tr data-riga="${r.chiave}">
        <th scope="row">${testo(r.etichetta)}</th>
        <td><input type="text" class="campo-numero" name="sup_${r.chiave}" inputmode="decimal" aria-label="${testo(r.etichetta)}, mq"></td>
        <td class="coeff">× ${v(r.coeff)}</td>
        <td class="risultato" data-sup="${r.chiave}">—</td>
      </tr>`).join("");
  }

  /** Le strade di pregio del foglio scelto: una casella per sceglierne una. */
  function mostraStrade(r) {
    const box = $("napoli-strade"), prima = radio("strada");
    if (!r.area_foglio) { box.hidden = true; box.innerHTML = ""; return; }
    const strade = r.strade_foglio || [];
    box.innerHTML = `<p class="nota-copia">${strade.length
      ? "Su questo foglio ci sono strade di pregio dell'accordo: l'immobile è in una di queste?"
      : "Su questo foglio non ci sono strade di pregio negli elenchi dell'accordo."}</p>` +
      strade.map((e) => `<label><input type="radio" name="strada" value="${e.i}"> <span>${testo(e.via)} <small>(${e.rimodulata ? `vale come area ${e.area}` : `pregio area ${e.area}`})</small></span></label>`).join("") +
      `<label><input type="radio" name="strada" value="nessuna"> <span>${strade.length ? "No, un'altra strada" : "Strada non compresa negli elenchi"} <small>(riduzione possibile fino al 30%)</small></span></label>` +
      `<label><input type="radio" name="strada" value=""> <span>Non indicare</span></label>`;
    const c = modulo.querySelector(`input[name=strada][value="${prima}"]`) || modulo.querySelector('input[name=strada][value=""]');
    c.checked = true;
    box.hidden = false;
  }

  // --------------------------------------------------------------- lettura
  function leggi() {
    const s = { modello: MODELLO, tipo: radio("tipo"), arredo: radio("arredo"), stato: radio("stato"),
      parziale: radio("locazione") === "parziale", durata_anni: Number(campo("durata_anni").value),
      sezione: campo("sezione").value, classe: campo("classe").value, classe_A_2013: campo("classe_A_2013").checked,
      basso: campo("basso").checked, strada: radio("strada") };
    for (const k of TESTI) s[k] = campo(k).value.trim();
    const valore = $("napoli-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const r of accordo.regole.superficie) s.superfici[r.chiave] = campo("sup_" + r.chiave).value.trim();
    s.elementi = [...modulo.querySelectorAll("input[name=el]")].map((c) => c.checked);
    s.correttivi = {};
    for (const k of CORR) s.correttivi[k] = campo("c_" + k).value.trim();
    s.catasto = { foglio: s.sezione ? `${s.sezione} ${s.foglio}`.trim() : s.foglio, particella: s.particella, subalterno: s.subalterno };
    s.maggiorazioni = { ammobiliato: s.arredo === "completo" ? (s.correttivi.arredo || "15") : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const metti = (nome, val) => { const c = modulo.querySelector(`input[name=${nome}][value="${val}"]`); if (c) c.checked = true; };
    metti("tipo", d.tipo); metti("arredo", d.arredo || "no"); metti("stato", d.stato || "normale");
    metti("locazione", d.parziale ? "parziale" : "intera");
    if (d.durata_anni) campo("durata_anni").value = String(d.durata_anni);
    campo("sezione").value = d.sezione || ""; campo("classe").value = d.classe || "";
    campo("classe_A_2013").checked = !!d.classe_A_2013; campo("basso").checked = !!d.basso;
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    for (const r of accordo.regole.superficie) campo("sup_" + r.chiave).value = (d.superfici || {})[r.chiave] || "";
    modulo.querySelectorAll("input[name=el]").forEach((c, i) => { c.checked = !!(d.elementi || [])[i]; });
    for (const k of CORR) campo("c_" + k).value = (d.correttivi || {})[k] || "";
    const valore = $("napoli-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
    if (d.strada !== undefined) { metti("strada", d.strada); ricalcola(); }
  }

  // -------------------------------------------------------------- calcolo
  function ricalcola() {
    if (!accordo) return;
    let s = leggi(), r = CanoneNapoli.calcola(accordo, s);
    // le strade si ridisegnano quando cambia il foglio
    const chiave = `${s.sezione}/${s.foglio}`;
    if (modulo.dataset.foglio !== chiave) { modulo.dataset.foglio = chiave; mostraStrade(r); s = leggi(); r = CanoneNapoli.calcola(accordo, s); }
    ultimo = { scheda: s, r };
    const C = accordo.regole.correttivi;
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("tipo-transitorio", s.tipo === "transitorio");
    modulo.classList.toggle("parziale", s.parziale);
    modulo.classList.toggle("con-arredo", s.arredo !== "no");
    modulo.classList.toggle("con-pregio", !!r.strada);
    modulo.classList.toggle("con-non-pregio", s.strada === "nessuna");
    modulo.classList.toggle("con-piccoli", !!r.piccoli_massimo);
    modulo.classList.toggle("con-grandi", r.totale !== null && r.totale > C.grandi_soglia);
    modulo.classList.toggle("con-basso", s.basso);
    const maxArredo = s.arredo === "parziale" ? C.parz_arredato : s.tipo === "transitorio" ? C.arredato_transitorio : C.arredato;
    modulo.querySelector('[data-max="arredo"]').textContent = `max ${maxArredo}%`;
    modulo.querySelector('[data-max="pregio"]').textContent = r.area ? (r.area >= 5 ? `aumento o riduzione max ${C.pregio_area[r.area]}%` : `aumento max ${C.pregio_area[r.area] || 0}%`) : "";
    modulo.querySelector('[data-max="piccoli"]').textContent = r.piccoli_massimo ? `max ${r.piccoli_massimo}% (vuoto = massimo)` : "";

    $("napoli-area").innerHTML = r.area
      ? `<b>Area ${r.area}</b>` + (r.area !== r.area_foglio ? ` (il foglio è in area ${r.area_foglio}: ${testo(r.strada.via)} vale come area ${r.area})` : "") +
        ` · valori da ${v(r.valori[0])} a ${v(r.valori[1])} €/mq annui`
      : s.sezione && s.foglio ? "Foglio non trovato nell'allegato A." : "";
    for (const riga of r.righe) {
      const td = modulo.querySelector(`[data-sup="${riga.chiave}"]`);
      if (td) td.textContent = riga.convenzionale === null ? "—" : v(riga.convenzionale);
    }
    $("napoli-totale").textContent = r.totale === null ? "—" : v(r.totale) + (r.verde ? ` (verde ${v(r.verde)})` : "");
    $("napoli-conteggio").textContent = `· ${r.elementi} su 22`;
    $("napoli-esito-area").textContent = r.area ? `Area ${r.area}: da € ${v(r.valori[0])} a € ${v(r.valori[1])} al mq annui` : "indica sezione e foglio";
    $("napoli-esito-fascia").textContent = r.fascia_valori
      ? `${r.fascia}^ (${r.elementi} elementi${r.fascia_da_classe ? ", classe A" : ""}): da € ${v(r.fascia_valori[0])} a € ${v(r.fascia_valori[1])}`
      : `${r.fascia}^ (${r.elementi} elementi)`;
    const valore = $("napoli-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto);
    $("napoli-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato
      ? `proposto ${v(r.valore_proposto)}` : `proposto per lo stato "${s.stato}"`;
    $("napoli-esito-correttivi").textContent = r.correttivi.length
      ? r.correttivi.map((c) => `${c.nome} ${c.percento > 0 ? "+" : "−"}${Math.abs(c.percento)}%`).join(", ") +
        ` = ${r.totale_perc >= 0 ? "+" : "−"}${Math.abs(r.totale_perc)}%`
      : "nessuna";
    $("napoli-esito-applicato").textContent = r.valore_applicato === null ? "—" : `€ ${v(r.valore_applicato)} al mq annui`;
    $("napoli-esito-annuo").textContent = r.canone_annuo === null ? "—" : `${euro(r.canone_annuo)} (${v(r.superficie_locata)} mq)`;
    $("napoli-esito-massimo").textContent = euro(r.canone_massimo);
    $("napoli-mensile").textContent = r.canone_pattuito === null ? "" : `= ${euro(r.canone_pattuito)} al mese`;
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("napoli-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "napoli-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
    ricalcola();
  });
  modulo.addEventListener("change", ricalcola);

  // ------------------------------------------------------------------ PDF
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
    const byte = await StampaNapoli.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Scheda canone Napoli", s.locatore || "", ultimo.r.area ? "area " + ultimo.r.area : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  // ---------------------------------------------------------------- avvio
  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete modulo.dataset.foglio;
    delete $("napoli-valore").dataset.modificato;
    campo("citta").value = (accordo.accordo.comune || "").toUpperCase();
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Napoli)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Napoli", r.area ? `area ${r.area}` : "area da trovare", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaNapoli = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
