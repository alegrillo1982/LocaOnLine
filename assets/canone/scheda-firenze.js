/*
 * La scheda del canone per l'accordo di Firenze (2025): il modulo
 * #scheda-firenze. I modelli di attestazione (allegati B e C) non sono
 * pubblicati: la scheda e il PDF seguono gli articoli 4-15 dell'accordo.
 * Si attiva con un accordo "modello": "firenze-2025". Calcolo in
 * canone-firenze.js, PDF in stampa-firenze.js.
 */
(function () {
  "use strict";
  const MODELLO = "firenze-2025";
  const modulo = document.getElementById("scheda-firenze");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneFirenze.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "indirizzo", "foglio", "particella", "subalterno",
    "mq_porzione", "mq_esclusivi", "arredo_perc", "studenti_perc", "canone_mensile"];
  const SCELTE = ["durata_anni", "zona", "arredo", "energia", "pregio"];
  const SPUNTE = ["studio", "recente", "porzione"];
  const SUP = [["utile", "Superficie interna utile (altezza almeno 240 cm)"], ["basse", "Parti con altezza tra 180 e 240 cm (30%)"],
    ["autorimessa", "Autorimessa singola o box (50%)"], ["attico", "Lastrico solare esclusivo all'attico (25%, oltre i mq dell'alloggio 5%)"],
    ["posto_esclusivo", "Posto auto in area di proprietà esclusiva del locatore (30%)"], ["posto_coperto", "Posto auto assegnato in autorimessa comune coperta (25%)"],
    ["posto_scoperto", "Posto auto assegnato in spazio comune scoperto (20%)"], ["posto_rotazione", "Posto auto a rotazione in spazio comune scoperto (5%)"],
    ["balconi", "Balconi, terrazze, lastrici non all'attico, cantine (25%)"], ["scoperta", "Area scoperta esclusiva: corti, giardini (10%, oltre i mq dell'alloggio 2%)"]];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  function costruisci() {
    const R = accordo.regole;
    campo("zona").innerHTML = '<option value="">scegli…</option>' + R.zone.map(([k, n, mz]) => `<option value="${k}">${testo(n)} · microzone ${mz}</option>`).join("");
    $("firenze-caratteristiche").innerHTML = R.caratteristiche_b.map((d, i) =>
      `<label><input type="checkbox" name="car" value="${i}"> <span>${testo(d)}</span></label>`).join("");
    $("firenze-elementi").innerHTML = accordo.elementi.map((d, i) =>
      `<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1}</b> ${testo(d)}</span></label>`).join("");
    $("firenze-superfici").innerHTML = SUP.map(([k, et]) => `
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
    for (const k of SPUNTE) s[k] = campo(k).checked;
    for (const k of TESTI) s[k] = campo(k).value.trim();
    s.citta = "FIRENZE";
    const valore = $("firenze-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const [k] of SUP) s.superfici[k] = campo("sup_" + k).value.trim();
    s.caratteristiche = [...modulo.querySelectorAll("input[name=car]")].map((c) => c.checked);
    s.elementi = [...modulo.querySelectorAll("input[name=el]")].map((c) => c.checked);
    s.catasto = { foglio: s.foglio, particella: s.particella, subalterno: s.subalterno };
    s.maggiorazioni = { ammobiliato: s.arredo ? String(s.arredo_perc || accordo.regole.arredo[s.arredo]) : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const c = modulo.querySelector(`input[name=tipo][value="${d.tipo}"]`); if (c) c.checked = true;
    for (const k of SCELTE) if (d[k] !== undefined && d[k] !== null) campo(k).value = String(d[k]);
    for (const k of SPUNTE) campo(k).checked = !!d[k];
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    for (const [k] of SUP) campo("sup_" + k).value = (d.superfici || {})[k] || "";
    modulo.querySelectorAll("input[name=car]").forEach((x, i) => { x.checked = !!(d.caratteristiche || [])[i]; });
    modulo.querySelectorAll("input[name=el]").forEach((x, i) => { x.checked = !!(d.elementi || [])[i]; });
    const valore = $("firenze-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneFirenze.calcola(accordo, s);
    ultimo = { scheda: s, r };
    for (const t of ["agevolato", "transitorio", "studenti"]) modulo.classList.toggle("tipo-" + t, s.tipo === t);
    modulo.classList.toggle("porzione", s.porzione);
    modulo.classList.toggle("con-arredo", !!s.arredo);
    const sup = r.superficie;
    for (const [k] of SUP) {
      const td = modulo.querySelector(`[data-sup="${k}"]`), riga = sup && sup.righe.find((x) => x.chiave === k);
      td.textContent = riga && riga.mq ? v(riga.convenzionale) : "—";
    }
    $("firenze-totale").textContent = sup ? v(sup.totale) : "—";
    $("firenze-sup-nota").textContent = sup && sup.totale !== sup.lorda ? `Prima della correzione per gli alloggi piccoli: ${v(sup.lorda)} mq.` : "";
    $("firenze-zona-nota").textContent = r.zona ? `${r.zona[1]}: ${r.zona[3]}.` : "Le microzone sono quelle catastali del Comune di Firenze (art. 4).";
    $("firenze-tipologia").textContent = `· tipo ${r.tipologia.tipo}`;
    $("firenze-conteggio").textContent = `· ${(s.elementi || []).filter(Boolean).length} su 12`;
    $("firenze-esito-fascia").textContent = r.fascia ? `${r.zona[1]}, tipo ${r.tipologia.tipo} (${r.tipologia.perche}): da € ${v(r.fascia[0])} a € ${v(r.fascia[1])} al mq al mese` : `tipo ${r.tipologia.tipo}`;
    $("firenze-esito-magg").textContent = r.maggiorazioni.length
      ? r.maggiorazioni.map((m) => `${m.nome} +${v(m.percento, m.percento % 1 ? 1 : 0)}%`).join(" × ") + (r.maggiorazioni.length > 1 ? ` = +${v((r.fattore - 1) * 100)}%` : "") +
        (r.fascia_magg ? ` → da € ${v(r.fascia_magg[0], 3)} a € ${v(r.fascia_magg[1], 3)}` : "")
      : "nessuna";
    const valore = $("firenze-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto, 3);
    $("firenze-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto, 3)}` : "il massimo";
    $("firenze-esito-canone").textContent = r.canone === null ? "—" : `${euro(r.canone)}${r.porzione ? ` (intero appartamento ${euro(r.canone_intero)})` : ""}`;
    $("firenze-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("firenze-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "firenze-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
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
    const byte = await StampaFirenze.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Scheda canone Firenze", s.locatore || "", ultimo.r.zona ? ultimo.r.zona[1] : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("firenze-valore").dataset.modificato;
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Firenze)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Firenze", r.zona ? r.zona[1].toLowerCase() : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaFirenze = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
