/*
 * La scheda del canone per l'accordo di Bari (2024): il modulo #scheda-bari,
 * che riproduce la scheda della zona dell'allegato 1 (elementi per la
 * determinazione della fascia e fasce di oscillazione). Si attiva con un
 * accordo "modello": "bari-2024". Calcolo in canone-bari.js, PDF in
 * stampa-bari.js.
 */
(function () {
  "use strict";
  const MODELLO = "bari-2024";
  const modulo = document.getElementById("scheda-bari");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneBari.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "indirizzo", "foglio", "particella", "subalterno", "mq_porzione", "canone_mensile"];
  const SCELTE = ["durata_anni", "zona", "arredo", "energia"];
  const SPUNTE = ["pregio", "porzione"];
  const SUP = [["utile", "Superficie utile (non catastale)"], ["basse", "Vani con altezza sotto 170 cm (50%)"], ["autorimessa", "Autorimessa singola a uso esclusivo (50%)"],
    ["posto_auto", "Posto auto a uso esclusivo (25%)"], ["accessori", "Balconi, terrazze, cortili, cantine, soffitte e simili (25%)"],
    ["scoperta", "Superficie scoperta a uso esclusivo (15%)"], ["verde", "Verde condominiale, quota millesimale (10%)"]];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";
  const soglie = (z) => z[3].map((f, i, a) => {
    const fino = i ? a[i - 1][1] - 1 : null;
    return `${f[0]}: ${f[1] && fino !== null ? (f[1] === fino ? `${f[1]}` : `da ${f[1]} a ${fino}`) : f[1] ? `da ${f[1]}` : `fino a ${fino}`} elementi`;
  }).join(" · ");

  function costruisci() {
    const R = accordo.regole;
    campo("zona").innerHTML = '<option value="">scegli…</option>' + R.zone.map((z) => `<option value="${z[0]}">${z[0]} · ${testo(z[1])}</option>`).join("");
    $("bari-elementi").innerHTML = accordo.elementi.map((d, i) =>
      `<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1}</b> ${testo(d)}</span></label>`).join("");
    $("bari-superfici").innerHTML = SUP.map(([k, et]) => `
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
    s.citta = "BARI";
    const valore = $("bari-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const [k] of SUP) s.superfici[k] = campo("sup_" + k).value.trim();
    s.elementi = [...modulo.querySelectorAll("input[name=el]")].map((c) => c.checked);
    s.catasto = { foglio: s.foglio, particella: s.particella, subalterno: s.subalterno };
    s.maggiorazioni = { ammobiliato: s.arredo ? (s.arredo === "totale" ? "20" : "10") : "" };
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
    const valore = $("bari-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneBari.calcola(accordo, s);
    ultimo = { scheda: s, r };
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("porzione", s.porzione);
    modulo.classList.toggle("con-pregio", !!(r.zona && r.zona[4]));
    const sup = r.superficie;
    for (const [k] of SUP) {
      const td = modulo.querySelector(`[data-sup="${k}"]`), riga = sup && sup.righe.find((x) => x.chiave === k);
      td.textContent = riga && riga.mq ? v(riga.convenzionale) : "—";
    }
    $("bari-totale").textContent = sup ? v(sup.totale) : "—";
    $("bari-sup-nota").textContent = sup && sup.totale !== sup.lorda ? `Prima delle correzioni: ${v(sup.lorda)} mq.` : "";
    $("bari-zona-nota").textContent = r.zona ? `Zona ${r.zona[0]} ${r.zona[1]}: fogli ${r.zona[2]}.` : "La zona si trova dal foglio di mappa catastale (è nella visura).";
    $("bari-pregio-testo").textContent = r.zona && r.zona[4] ? `Zona di pregio: ${r.zona[4]} (fascia A)` : "Zona di pregio";
    $("bari-soglie").textContent = r.zona ? `Fasce della zona ${r.zona[0]}: ${soglie(r.zona)}.` : "";
    $("bari-conteggio").textContent = `· ${r.elementi} su ${accordo.elementi.length}`;
    $("bari-esito-fascia").textContent = r.fascia
      ? `${r.zona[1]}, fascia ${r.fascia[0]} (${r.elementi} elementi${r.promossa ? `, ${r.promossa}` : ""}): da € ${v(r.fascia[2])} a € ${v(r.fascia[3])} al mq al mese` : "scegli la zona";
    $("bari-esito-magg").textContent = r.maggiorazioni.length
      ? r.maggiorazioni.map((m) => `${m.nome} +${m.percento}%`).join(" × ") + (r.maggiorazioni.length > 1 ? ` = +${v((r.fattore - 1) * 100)}%` : "") +
        (r.fascia_magg ? ` → da € ${v(r.fascia_magg[0], 3)} a € ${v(r.fascia_magg[1], 3)}` : "")
      : "nessuna";
    const valore = $("bari-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto, 3);
    $("bari-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto, 3)}` : "il massimo della fascia";
    $("bari-esito-minimo").textContent = euro(r.canone_minimo);
    $("bari-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("bari-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "bari-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
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
    const byte = await StampaBari.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Scheda canone Bari", s.locatore || "", s.zona ? "zona " + s.zona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("bari-valore").dataset.modificato;
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Bari)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Bari", r.zona ? `zona ${r.zona[0]} ${r.zona[1]}` : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaBari = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
