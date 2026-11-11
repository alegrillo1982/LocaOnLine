/*
 * La scheda del canone per l'accordo di Genova (2025): il modulo
 * #scheda-genova, che riproduce la "Scheda per la determinazione del canone"
 * (allegato 4). Si attiva con un accordo "modello": "genova-2025".
 * Calcolo in canone-genova.js, PDF in stampa-genova.js.
 */
(function () {
  "use strict";
  const MODELLO = "genova-2025";
  const modulo = document.getElementById("scheda-genova");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneGenova.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "citta", "indirizzo", "piano", "interno",
    "mq", "pertinenze", "mq_porzione", "mq_comuni", "canone_mensile"];
  const SCELTE = ["durata_anni", "zona", "fonte_sup", "arredo", "vincolo"];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  function costruisci() {
    campo("zona").innerHTML = '<option value="">scegli…</option>' + accordo.regole.zone.map(([c, min, max]) =>
      `<option value="${c}">${c} · da ${v(min)} a ${v(max)} €/mq l'anno</option>`).join("");
    $("genova-elementi").innerHTML = accordo.elementi.map((d, i) =>
      `<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1}</b> ${testo(d)}${i === 1 || i === 3 ? " *" : ""}</span></label>`).join("");
  }

  function leggi() {
    const s = { modello: MODELLO, tipo: radio("tipo"), porzione: radio("porzione") === "1" };
    for (const k of SCELTE) s[k] = campo(k).value;
    s.durata_anni = Number(s.durata_anni) || 3;
    for (const k of TESTI) s[k] = campo(k).value.trim();
    const valore = $("genova-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.elementi = [...modulo.querySelectorAll("input[name=el]")].map((c) => c.checked);
    s.catasto = { foglio: "", particella: "", subalterno: "" };
    s.maggiorazioni = { ammobiliato: s.arredo ? String(accordo.regole.arredo[s.arredo]) : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    for (const n of ["tipo", "porzione"]) {
      const val = n === "porzione" ? (d.porzione ? "1" : "") : d.tipo;
      const c = modulo.querySelector(`input[name=${n}][value="${val}"]`); if (c) c.checked = true;
    }
    for (const k of SCELTE) if (d[k] !== undefined && d[k] !== null) campo(k).value = String(d[k]);
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    modulo.querySelectorAll("input[name=el]").forEach((x, i) => { x.checked = !!(d.elementi || [])[i]; });
    const valore = $("genova-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneGenova.calcola(accordo, s);
    ultimo = { scheda: s, r };
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("porzione", s.porzione);
    modulo.classList.toggle("da-ape", s.fonte_sup === "ape");
    const sup = r.superficie;
    $("genova-mq").textContent = sup ? v(sup.calcolo) : "—";
    $("genova-sup-nota").textContent = sup && !sup.porzione && sup.calcolo !== sup.base ? `Prima delle correzioni: ${v(sup.base)} mq.` : "";
    $("genova-conteggio").textContent = `· ${r.elementi} su ${accordo.elementi.length}`;
    $("genova-esito-zona").textContent = r.zona ? `${r.zona[0]}: da € ${v(r.zona[1])} a € ${v(r.zona[2])} al mq l'anno` : "scegli la zona";
    $("genova-esito-fascia").textContent = r.fascia
      ? `${r.sub}^ (${r.elementi} elementi): da € ${v(r.fascia[0])} a € ${v(r.fascia[1])}` : `${r.sub}^ (${r.elementi} elementi)`;
    $("genova-esito-magg").textContent = r.maggiorazioni.length
      ? r.maggiorazioni.map((m) => `${m.nome} +${m.percento}%`).join(", ") + (r.maggiorazioni.length > 1 ? ` = +${r.percento}%` : "") +
        (r.fascia_magg ? ` → da € ${v(r.fascia_magg[0], 3)} a € ${v(r.fascia_magg[1], 3)}` : "")
      : "nessuna";
    const valore = $("genova-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto, 3);
    $("genova-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto, 3)}` : "il massimo della sottofascia";
    $("genova-esito-annuo").textContent = r.canone_annuo === null ? "—"
      : `${euro(r.canone_annuo)} (minimo della zona ${euro(r.annuo_minimo_zona)}, massimo ${euro(r.annuo_massimo)})`;
    $("genova-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("genova-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "genova-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
    ricalcola();
  });
  modulo.addEventListener("change", ricalcola);

  let risorse = null;
  async function creaPDF() {
    if (window.caricaLibrerie) await window.caricaLibrerie("pdf");
    if (!ultimo || !window.PDFLib || !window.fontkit) throw new Error("la stampa non è ancora pronta, riprova tra un attimo");
    if (!risorse) {
      const prendi = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error("file mancante: " + f); return r.arrayBuffer(); });
      const [icona, sansRegolare, sansGrassetto] = await Promise.all([
        fetch("assets/canone/icona-locaonline.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
        prendi("assets/canone/caratteri/Carlito-Regular.ttf"), prendi("assets/canone/caratteri/Carlito-Bold.ttf")]);
      risorse = { icona, sansRegolare, sansGrassetto };
    }
    const byte = await StampaGenova.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Scheda canone Genova", s.locatore || "", s.zona ? "zona " + s.zona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("genova-valore").dataset.modificato;
    campo("citta").value = (accordo.accordo.comune || "").toUpperCase();
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Genova)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Genova", s.zona ? `zona ${s.zona}` : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaGenova = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
