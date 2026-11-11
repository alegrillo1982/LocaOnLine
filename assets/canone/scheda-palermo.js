/*
 * La scheda del canone per l'accordo di Palermo (2020): il modulo
 * #scheda-palermo, che riproduce l'"Attestazione di rispondenza"
 * (allegato E). Si attiva con un accordo "modello": "palermo-2020".
 * Calcolo in canone-palermo.js, PDF in stampa-palermo.js.
 */
(function () {
  "use strict";
  const MODELLO = "palermo-2020";
  const modulo = document.getElementById("scheda-palermo");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanonePalermo.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "citta", "indirizzo", "piano", "interno",
    "arredato_perc", "storico_perc", "canone_mensile"];
  const SUP = [["vani", "Superficie calpestabile appartamento (vani principali, bagni, ripostigli, ingressi, corridoi, verande autorizzate)"],
    ["accessori_comunicanti", "Vani accessori comunicanti: soffitte, cantine, mezzanini, box (50%)"],
    ["accessori_non", "Vani accessori non comunicanti (25%)"],
    ["balconi", "Balconi e terrazze comunicanti (30% fino a 25 mq, 10% oltre)"],
    ["balconi_non", "Balconi e terrazze non comunicanti (15% fino a 25 mq, 5% oltre)"],
    ["scoperta", "Area scoperta di pertinenza esclusiva (10% fino ai mq dei vani, 2% oltre)"]];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  function costruisci() {
    campo("microzona").innerHTML = '<option value="">scegli…</option>' + accordo.regole.microzone.map(([n, nome]) =>
      `<option value="${n}">${n} – ${testo(nome)}</option>`).join("");
    $("palermo-elementi").innerHTML = accordo.elementi.map((d, i) =>
      `<label><input type="checkbox" name="el" value="${i}"> <span><b class="codice">${i + 1}</b> ${testo(d)}</span></label>`).join("");
    $("palermo-superfici").innerHTML = SUP.map(([k, et]) => `
      <tr data-riga="${k}">
        <th scope="row">${testo(et)}</th>
        <td><input type="text" class="campo-numero" name="sup_${k}" inputmode="decimal" aria-label="${testo(et)}, mq"></td>
        <td class="risultato" data-sup="${k}">—</td>
      </tr>`).join("");
  }

  function leggi() {
    const s = { modello: MODELLO, tipo: radio("tipo"), durata_anni: Number(campo("durata_anni").value),
      microzona: campo("microzona").value, epoca: campo("epoca").value, arredato: campo("arredato").checked, storico: campo("storico").checked };
    for (const k of TESTI) s[k] = campo(k).value.trim();
    const valore = $("palermo-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const [k] of SUP) s.superfici[k] = campo("sup_" + k).value.trim();
    s.elementi = [...modulo.querySelectorAll("input[name=el]")].map((c) => c.checked);
    s.catasto = { foglio: "", particella: "", subalterno: "" };
    s.maggiorazioni = { ammobiliato: s.arredato ? (s.arredato_perc || "15") : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const c = modulo.querySelector(`input[name=tipo][value="${d.tipo}"]`); if (c) c.checked = true;
    if (d.durata_anni) campo("durata_anni").value = String(d.durata_anni);
    campo("microzona").value = d.microzona || ""; campo("epoca").value = d.epoca || "";
    campo("arredato").checked = !!d.arredato; campo("storico").checked = !!d.storico;
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    for (const [k] of SUP) campo("sup_" + k).value = (d.superfici || {})[k] || "";
    modulo.querySelectorAll("input[name=el]").forEach((x, i) => { x.checked = !!(d.elementi || [])[i]; });
    const valore = $("palermo-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    ricalcola();
  }

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanonePalermo.calcola(accordo, s);
    ultimo = { scheda: s, r };
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("con-arredato", s.arredato);
    modulo.classList.toggle("con-storico", s.storico);
    const sup = r.superficie;
    for (const [k] of SUP) {
      const td = modulo.querySelector(`[data-sup="${k}"]`), riga = sup && sup.righe.find((x) => x.chiave === k);
      td.textContent = riga && riga.mq ? v(riga.convenzionale) : "—";
    }
    $("palermo-totale").textContent = sup ? v(sup.totale) : "—";
    $("palermo-sup-nota").textContent = sup && sup.totale !== sup.lorda ? `Prima delle correzioni per la metratura: ${v(sup.lorda)} mq.` : "";
    $("palermo-conteggio").textContent = `· ${r.elementi} su 17`;
    $("palermo-esito-zona").textContent = r.microzona ? `${r.microzona[0]} – ${r.microzona[1]}: da € ${v(r.fascia_base[0])} a € ${v(r.fascia_base[1])} al mq` : "scegli la microzona";
    $("palermo-esito-fascia").textContent = r.fascia
      ? `${r.sub}^ (${r.elementi} elementi), epoca ${r.epoca_perc > 0 ? "+" : ""}${r.epoca_perc}%: da € ${v(r.fascia[0], 3)} a € ${v(r.fascia[1], 3)}`
      : `${r.sub}^ (${r.elementi} elementi)`;
    const valore = $("palermo-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto, 3);
    $("palermo-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto, 3)}` : "il massimo della sub-fascia";
    $("palermo-esito-base").textContent = r.canone_base === null ? "—" : `${euro(r.canone_base)} al mese`;
    $("palermo-esito-aumento").textContent = r.aumento ? `${r.aumento.nome} +${v(r.aumento.percento, r.aumento.percento % 1 ? 1 : 0)}% → ${euro(r.canone)}` : "nessuno";
    $("palermo-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("palermo-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  modulo.addEventListener("input", (e) => {
    if (e.target.id === "palermo-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
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
    const byte = await StampaPalermo.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Attestazione canone Palermo", s.locatore || "", s.microzona ? "microzona " + s.microzona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete $("palermo-valore").dataset.modificato;
    campo("citta").value = (accordo.accordo.comune || "").toUpperCase();
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Palermo)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Palermo", s.microzona ? `microzona ${s.microzona}` : "microzona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaPalermo = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
