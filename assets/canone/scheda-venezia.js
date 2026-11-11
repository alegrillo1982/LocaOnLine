/*
 * La scheda del canone per l'accordo di Venezia (2026): il modulo
 * #scheda-venezia (Tab. 2 elementi oggettivi, Tab. 3 criteri, scheda di
 * calcolo). Si attiva con un accordo "modello": "venezia-2026". Calcolo in
 * canone-venezia.js, PDF (Tab. 2, scheda calcolo e attestazione allegato 4)
 * in stampa-venezia.js.
 */
(function () {
  "use strict";
  const MODELLO = "venezia-2026";
  const modulo = document.getElementById("scheda-venezia");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneVenezia.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "indirizzo", "piano", "interno", "mq_porzione", "canone_mensile"];
  const SCELTE = ["durata_anni", "zona", "localita", "arredo", "energia"];
  const SPUNTE = ["pregio", "zona1_penalita", "degrado", "a5", "acqua_alta", "vincolato", "porzione", "manutenzione", "vetusto", "senza_bagno"];
  const GRUPPI = [["A", "Elementi di tipo A"], ["B", "Elementi di tipo B"], ["C", "Elementi di tipo C"], ["D", "Elementi di tipo D (solo a Venezia centro storico e isole)"]];
  const SUP = [["utile", "Superficie utile calpestabile (per il coefficiente K)"], ["basse", "Vani con altezza tra 1,00 e 1,70 m (50%)"],
    ["autorimessa", "Autorimessa a uso esclusivo (85%, zona 5: 60%)"], ["posto_coperto", "Posto auto in autorimessa comune coperta (50%, zona 5: 40%)"],
    ["posto_scoperto", "Posto auto scoperto (30%, zona 5: 20%)"], ["accessori", "Balconi, terrazze, cantine e simili (25%)"],
    ["scoperta", "Area scoperta di pertinenza esclusiva (15%)"], ["verde", "Verde condominiale diviso per il numero dei condomini (10%)"]];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  function costruisci() {
    const R = accordo.regole;
    campo("zona").innerHTML = '<option value="">scegli…</option>' + R.zone.map(([k, n]) => `<option value="${k}">Zona ${k} · ${testo(n)}</option>`).join("");
    $("venezia-elementi").innerHTML = GRUPPI.map(([g, titolo]) => `
      <h3 class="${g === "D" ? "solo-venezia " : ""}stacco">${testo(titolo)}</h3>
      <div class="caselle colonna elementi${g === "D" ? " solo-venezia" : ""}">${accordo.elementi[g].map((d, i) =>
        `<label><input type="checkbox" name="el_${g}" value="${i}"> <span><b class="codice">${g}${i + 1}</b> ${testo(d)}</span></label>`).join("")}</div>`).join("");
    $("venezia-superfici").innerHTML = SUP.map(([k, et]) => `
      <tr data-riga="${k}">
        <th scope="row">${testo(et)}</th>
        <td><input type="text" class="campo-numero" name="sup_${k}" inputmode="decimal" aria-label="${testo(et)}, mq"></td>
        <td class="risultato" data-sup="${k}">—</td>
      </tr>`).join("");
  }

  function leggi() {
    const s = { modello: MODELLO, tipo: radio("tipo") };
    for (const k of SCELTE) s[k] = campo(k).value;
    s.durata_anni = Number(s.durata_anni) || 3;
    if (s.zona === "4" || s.zona === "5") s.localita = "terraferma";
    for (const k of SPUNTE) s[k] = campo(k).checked;
    for (const k of TESTI) s[k] = campo(k).value.trim();
    s.citta = "VENEZIA";
    const valore = $("venezia-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const [k] of SUP) s.superfici[k] = campo("sup_" + k).value.trim();
    s.elementi = {};
    for (const [g] of GRUPPI) s.elementi[g] = [...modulo.querySelectorAll(`input[name=el_${g}]`)].map((c) => c.checked && !(g === "D" && s.localita !== "venezia"));
    s.catasto = { foglio: "", particella: "", subalterno: "" };
    s.maggiorazioni = { ammobiliato: s.arredo ? String(accordo.regole.arredo[s.arredo]) : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const c = modulo.querySelector(`input[name=tipo][value="${d.tipo}"]`); if (c) c.checked = true;
    for (const k of SCELTE) if (d[k] !== undefined && d[k] !== null && !(k === "localita" && d[k] === "terraferma")) campo(k).value = String(d[k]);
    for (const k of SPUNTE) campo(k).checked = !!d[k];
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    for (const [k] of SUP) campo("sup_" + k).value = (d.superfici || {})[k] || "";
    for (const [g] of GRUPPI) modulo.querySelectorAll(`input[name=el_${g}]`).forEach((x, i) => { x.checked = !!((d.elementi || {})[g] || [])[i]; });
    const valore = $("venezia-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneVenezia.calcola(accordo, s);
    ultimo = { scheda: s, r };
    const R = accordo.regole;
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("porzione", s.porzione);
    modulo.classList.toggle("terraferma", s.localita === "terraferma");
    modulo.classList.toggle("in-venezia", s.localita === "venezia");
    modulo.classList.toggle("con-pregio", !!R.pregio[s.zona]);
    modulo.classList.toggle("zona-1", s.zona === "1");
    modulo.classList.toggle("zona-5", s.zona === "5");
    $("venezia-pregio-testo").textContent = R.pregio[s.zona] ? `Zona di particolare pregio: ${R.pregio[s.zona]}` : "Zona di particolare pregio";
    const sup = r.superficie;
    for (const [k] of SUP) {
      const td = modulo.querySelector(`[data-sup="${k}"]`), riga = sup && sup.righe.find((x) => x.chiave === k);
      td.textContent = riga && riga.mq ? v(riga.convenzionale) : "—";
    }
    $("venezia-totale").textContent = sup ? v(sup.totale) : "—";
    $("venezia-sup-nota").textContent = sup ? `Coefficiente K ${v(sup.K, 4)}: ${v(sup.righe[0].mq)} mq utili diventano ${v(sup.supK)} mq.` : "";
    const conta = (g) => (s.elementi[g] || []).filter(Boolean).length;
    $("venezia-conteggio").textContent = `· A ${conta("A")}/6, B ${conta("B")}/8, C ${conta("C")}/11${s.localita === "venezia" ? `, D ${conta("D")}/7` : ""}`;
    const nomi = ["inferiore", "intermedia", "superiore"];
    $("venezia-esito-fascia").textContent = r.base
      ? `Zona ${s.zona}, subfascia ${nomi[r.sub.n]} (${r.sub.perche}): da € ${v(r.base[0])} a € ${v(r.base[1])} al mq l'anno` : `subfascia ${nomi[r.sub.n]}`;
    $("venezia-esito-magg").textContent = (r.correzioni.length ? r.correzioni.map((c) => c.nome).join(", ") : "nessuna") +
      (r.fascia ? ` → da € ${v(r.fascia[0])} a € ${v(r.fascia[1])}` : "") + (r.arredo ? `; arredo +${r.arredo}% sulla superficie principale` : "");
    const valore = $("venezia-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto);
    $("venezia-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto)}` : "il massimo";
    $("venezia-esito-minimo").textContent = euro(r.canone_minimo);
    $("venezia-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("venezia-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "venezia-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
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
    const byte = await StampaVenezia.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Scheda canone Venezia", s.locatore || "", s.zona ? "zona " + s.zona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("venezia-valore").dataset.modificato;
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Venezia)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Venezia", s.zona ? `zona ${s.zona}` : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaVenezia = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
