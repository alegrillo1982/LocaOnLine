/*
 * La scheda del canone per l'accordo metropolitano di Bologna (2024): il
 * modulo #scheda-bologna, che riproduce l'"Attestazione bilaterale di
 * rispondenza" (allegato 14). Si attiva con un accordo "modello":
 * "bologna-2024". Calcolo in canone-bologna.js, PDF in stampa-bologna.js.
 */
(function () {
  "use strict";
  const MODELLO = "bologna-2024";
  const modulo = document.getElementById("scheda-bologna");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneBologna.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "indirizzo", "foglio", "particella", "subalterno",
    "mq_conduttore", "mq_altri", "mq_comuni", "canone_mensile"];
  const SCELTE = ["durata_anni", "zona", "vani", "fonte_sup", "arredo", "energia"];
  const SPUNTE = ["con_cantina", "porzione", "pregio", "deposito", "recesso"];
  const SUP = [["alloggio", "Alloggio (100%, meno 10% o 5% se dalla visura)"], ["autorimessa", "Autorimessa C6 in uso esclusivo (50%)"],
    ["posto_auto", "Posto auto esclusivo (20%)"], ["terrazzo", "Terrazzo o balcone esclusivo, se oltre 10 mq (10%)"],
    ["verde", "Area verde esclusiva, se oltre 10 mq (10%)"]];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  function costruisci() {
    const R = accordo.regole;
    campo("zona").innerHTML = '<option value="">scegli…</option>' + R.zone.map(([k, n]) => `<option value="${k}">${testo(n)}</option>`).join("");
    campo("vani").innerHTML = '<option value="">scegli…</option>' + R.vani.map(([k, n]) => `<option value="${k}">${testo(n)}</option>`).join("");
    $("bologna-elementi").innerHTML = accordo.elementi.map((d, i) =>
      `<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1}</b> ${testo(d)}</span></label>`).join("");
    $("bologna-superfici").innerHTML = SUP.map(([k, et]) => `
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
    s.citta = "BOLOGNA";
    const valore = $("bologna-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const [k] of SUP) s.superfici[k] = campo("sup_" + k).value.trim();
    s.elementi = [...modulo.querySelectorAll("input[name=el]")].map((c) => c.checked);
    s.catasto = { foglio: s.foglio, particella: s.particella, subalterno: s.subalterno };
    const M = accordo.regole.maggiorazioni;
    s.maggiorazioni = { ammobiliato: s.arredo ? String(s.arredo === "nuovo" ? M.arredo_nuovo : M.arredo) : "" };
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
    modulo.querySelectorAll("input[name=el]").forEach((x, i) => { x.checked = !!(d.elementi || [])[i]; });
    const valore = $("bologna-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneBologna.calcola(accordo, s);
    ultimo = { scheda: s, r };
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("tipo-transitorio", s.tipo === "transitorio");
    modulo.classList.toggle("porzione", s.porzione);
    modulo.classList.toggle("da-catastale", s.fonte_sup !== "interna");
    const sup = r.superficie;
    for (const [k] of SUP) {
      const td = modulo.querySelector(`[data-sup="${k}"]`), riga = sup && sup.righe.find((x) => x.chiave === k);
      td.textContent = riga && riga.mq ? v(riga.convenzionale) : "—";
    }
    $("bologna-totale").textContent = sup ? v(sup.totale) : "—";
    $("bologna-sup-nota").textContent = sup && sup.quota !== null ? `Superficie locata: ${v(sup.locata)} mq.` : "";
    $("bologna-conteggio").textContent = `· ${r.elementi} su ${accordo.elementi.length}`;
    $("bologna-esito-fascia").textContent = r.fascia
      ? `${r.zona[1]}, ${r.vani[1]}, fascia ${r.fascia_nome} (${r.elementi} parametri): da € ${v(r.fascia[0])} a € ${v(r.fascia[1])} al mq l'anno`
      : `fascia ${r.fascia_nome} (${r.elementi} parametri)`;
    $("bologna-esito-magg").textContent = r.maggiorazioni.length
      ? r.maggiorazioni.map((m) => `${m.nome} +${m.percento}%`).join(", ") + (r.maggiorazioni.length > 1 ? ` = +${r.percento}%` : "") +
        (r.fascia_magg ? ` → da € ${v(r.fascia_magg[0])} a € ${v(r.fascia_magg[1])}` : "")
      : "nessuna";
    const valore = $("bologna-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto);
    $("bologna-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto)}` : "il massimo della fascia";
    $("bologna-esito-minimo").textContent = euro(r.canone_minimo);
    $("bologna-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("bologna-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "bologna-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
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
    const byte = await StampaBologna.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Attestazione canone Bologna", s.locatore || "", s.zona ? "zona " + s.zona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("bologna-valore").dataset.modificato;
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Bologna)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Bologna", r.zona ? r.zona[1].toLowerCase() : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaBologna = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
