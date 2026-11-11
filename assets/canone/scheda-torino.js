/*
 * La scheda del canone per l'accordo di Torino (2022, aggiornato 2024): il
 * modulo #scheda-torino, che riproduce l'"Attestazione di congruità"
 * (allegato 9). Si attiva con un accordo "modello": "torino-2024".
 * Calcolo in canone-torino.js, PDF in stampa-torino.js; zona dall'elenco
 * viario (allegato 1, accordi/torino-2024-04-15-stradario.json).
 */
(function () {
  "use strict";
  const MODELLO = "torino-2024";
  const modulo = document.getElementById("scheda-torino");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneTorino.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "conduttore", "conduttore_cf", "citta", "indirizzo", "mq_esclusivi", "mq_condivisi",
    "inquilini", "servizi_extra", "canone_mensile"];
  const CASELLE = ["parziale", "minori", "servizio_interno", "edisu", "arredo_acquistato", "senza_deposito", "recesso_3_mesi", "elementi_9"];
  const radio = (nome) => (modulo.querySelector(`input[name=${nome}]:checked`) || {}).value || "";

  // ------------------------------------------------------------- costruzione
  function costruisci() {
    $("torino-elementi").innerHTML = accordo.elementi.map(([k, gruppo, d, punti]) =>
      `<label><input type="checkbox" name="el" value="${k}"${gruppo ? ` data-gruppo="${gruppo}"` : ""}> <span><b class="codice">${k})</b> ${testo(d)} <small>(${v(punti, punti % 1 ? 1 : 0)} ${punti === 1 ? "punto" : "punti"})</small></span></label>`).join("");
    $("torino-elementi-studenti").innerHTML = accordo.elementi_studenti.map((d, i) =>
      `<label><input type="checkbox" name="els" value="${i}"> <span><b class="codice">${i + 1}.</b> ${testo(d)}</span></label>`).join("");
    $("torino-superfici").innerHTML = accordo.regole.superficie.map((r) => `
      <tr data-riga="${r.chiave}">
        <th scope="row">${testo(r.etichetta)}</th>
        <td><input type="text" class="campo-numero" name="sup_${r.chiave}" inputmode="decimal" aria-label="${testo(r.etichetta)}, mq"></td>
        <td class="coeff">${v(r.coeff * 100, 0)}%</td>
        <td class="risultato" data-sup="${r.chiave}">—</td>
      </tr>`).join("");
  }

  // ------------------------------------------- zona dall'elenco viario
  let righe = null, caricamento = null;
  const norma = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`´]/g, "'").toLowerCase()
    .replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const TIPI = new Set(["via", "corso", "c.so", "piazza", "p.za", "p.zza", "largo", "viale", "v.le", "strada", "str.", "vicolo", "piazzale", "p.le", "lungo", "lungodora", "galleria", "passaggio", "piazzetta", "salita", "borgata", "vic."]);
  function prepara() {
    if (caricamento || !accordo.stradario) return caricamento;
    caricamento = fetch("accordi/" + accordo.stradario).then((r) => r.json()).then((d) => {
      righe = d.righe.map(([nome, zona]) => {
        // il nome della via e' la parte prima del tratto ("dal n°…", "numeri…", "i n°…")
        const m = nome.match(/\s+(?=(dal\b|da\s+ang|numeri\b|i\s+n[°.\s]|c'è\b|esiste\b|lato\b|rimanent[ei]\b|restant[ei]\b|tutti\b|n°|n\.\s*\d|\d))/i);
        const via = m ? nome.slice(0, m.index) : nome;
        return { nome, zona, n: norma(via), tratto: m ? nome.slice(m.index).trim() : "" };
      });
    }).catch(() => { caricamento = null; });
    return caricamento;
  }
  /** Le parole della via (senza "via", "corso"… e senza il numero civico). */
  function parole(indirizzo) {
    return norma(indirizzo).replace(/,/g, " ").split(" ").filter((p) => p && !TIPI.has(p) && !/^\d+[a-z]?(\/\d+)?$/.test(p) && p !== "n." && p !== "n");
  }
  const SINONIMI = { "c.so": "corso", "p.za": "piazza", "p.zza": "piazza", "p.le": "piazzale", "v.le": "viale", "str.": "strada", "vic.": "vicolo" };
  const tipoDi = (w) => { w = SINONIMI[w] || w; return TIPI.has(w) ? w : ""; };
  /** Il tipo della riga dell'elenco: quello fra parentesi ("(piazza)", "(c.so)"), altrimenti via. */
  function tipoRiga(r) {
    const m = r.nome.toLowerCase().match(/\(\s*(?:p\.le e via|[a-z.]+)/);
    const w = m ? m[0].replace(/^\(\s*/, "").split(" ")[0] : "via";
    return tipoDi(w) || "via";
  }

  /** Il civico e' compreso esplicitamente nel tratto? Legge le forme piu' comuni
   *  dell'elenco viario: "dal n° 5 al n° 33", "dal n. 4 alla fine", "i n° 1, 2, 3",
   *  "tutti i numeri pari/dispari". Le parti "restanti/rimanenti" non contano qui. */
  const RESTO = /\b(?:i |tutti i )?(?:restant[ei]|rimanent[ei])\b(?: numeri)?(?: pari)?(?: e)?(?: dispari)?/g;
  function esplicito(tratto, c) {
    const t = norma(tratto).replace(RESTO, " ");
    let si = false;
    for (const m of t.matchAll(/dal?\s*(?:n(?:umero)?\s*[°.]?\s*)?(\d+)\s*(?:bis\s*)?(?:al\s*(?:n(?:umero)?\s*[°.]?\s*)?(\d+)|alla fine)/g)) {
      const da = +m[1], a = m[2] ? +m[2] : Infinity;
      if (c >= da && c <= a && c % 2 === da % 2) si = true;
    }
    for (const m of t.matchAll(/(?:\bi|numeri|\bil|\bcon i)\s+n?[°.]?\s*((?:\d+\s*(?:,|e|-)\s*)*\d+)/g))
      if (m[1].split(/\s*(?:,|e|-)\s*/).map(Number).includes(c)) si = true;
    if (/numeri dispari(?!\s*dal)/.test(t) && c % 2 === 1) si = true;
    if (/numeri pari(?!\s*dal)/.test(t) && c % 2 === 0) si = true;
    return si;
  }
  /** La riga "restanti numeri (pari/dispari)" vale per il civico? */
  function resto(tratto, c) {
    const m = norma(tratto).match(RESTO);
    if (!m) return false;
    const f = m.join(" "), pari = /pari/.test(f), dispari = /dispari/.test(f);
    return (!pari && !dispari) || (pari && c % 2 === 0) || (dispari && c % 2 === 1);
  }

  function zonaDaIndirizzo(aggiorna = true) {
    const box = $("torino-vie"), esito = $("torino-zona-indirizzo"), sel = campo("zona");
    if (!righe) { const p = prepara(); if (p) p.then(() => righe && zonaDaIndirizzo(aggiorna)); return; }
    box.hidden = true; box.innerHTML = ""; esito.innerHTML = "";
    const pp = parole(campo("indirizzo").value);
    const togliAuto = () => { if (aggiorna && sel.dataset.auto) { sel.value = ""; delete sel.dataset.auto; } };
    if (!pp.length || pp.join("").length < 2) { togliAuto(); return; }
    // parole intere del nome della via (non "Panizza" o "Podgora" per "Nizza" o "Po")
    const esc = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parola = (n, p) => new RegExp(`(^|[\\s'.-])${esc(p)}($|[\\s'.-])`).test(n);
    let trovate = righe.filter((r) => pp.every((p) => parola(r.n, p)));
    // se il nome coincide esattamente con qualche via, solo quelle
    const senzaTipi = (n) => n.split(" ").filter((w) => w && !TIPI.has(w)).join(" ");
    const esatte = trovate.filter((r) => senzaTipi(r.n) === pp.join(" "));
    if (esatte.length) trovate = esatte;
    // il tipo scritto (via, corso, piazza…) sceglie fra vie con lo stesso nome
    const tipoScritto = tipoDi(norma(campo("indirizzo").value).split(" ")[0]);
    if (tipoScritto) { const stessoTipo = trovate.filter((r) => tipoRiga(r) === tipoScritto); if (stessoTipo.length) trovate = stessoTipo; }
    trovate = trovate.slice(0, 12);
    // con il numero civico, il tratto giusto (se uno solo lo comprende)
    const civ = parseInt((norma(campo("indirizzo").value).match(/(\d+)\s*[a-z]?(\/\d+)?\s*$/) || [])[1], 10);
    if (civ && trovate.length > 1) {
      const nelTratto = trovate.filter((r) => r.tratto && esplicito(r.tratto, civ));
      // basta che le righe che comprendono il civico portino tutte alla stessa zona
      const unaZona = (l) => l.length && new Set(l.map((r) => r.zona)).size === 1;
      if (unaZona(nelTratto)) trovate = nelTratto;
      else if (!nelTratto.length) { const altri = trovate.filter((r) => r.tratto && resto(r.tratto, civ)); if (unaZona(altri)) trovate = altri; }
    }
    if (!trovate.length) { togliAuto(); esito.textContent = "Via non trovata nell'elenco viario: controlla come è scritta, o scegli la zona."; return; }
    const zone = [...new Set(trovate.map((r) => r.zona))];
    if (zone.length === 1) {
      if (aggiorna && (!sel.value || sel.dataset.auto)) { sel.value = zone[0]; sel.dataset.auto = "1"; }
      esito.innerHTML = `<b>Zona ${testo(accordo.zone[zone[0]] || zone[0])}</b> secondo l'elenco viario (${testo(trovate[0].nome)}${trovate.length > 1 ? " e altre righe" : ""})` +
        (sel.value && sel.value !== zone[0] ? ` <span class="avviso-zona">· hai scelto ${testo(accordo.zone[sel.value] || sel.value)}</span>` : "");
      return;
    }
    togliAuto();
    esito.textContent = "La via è divisa fra più zone secondo i numeri civici: scegli la riga giusta.";
    box.innerHTML = trovate.map((r) => `<button type="button" role="option" data-zona="${r.zona}">${testo(r.nome)} <small>zona ${testo(accordo.zone[r.zona] || r.zona)}</small></button>`).join("");
    box.hidden = false;
  }

  // --------------------------------------------------------------- lettura
  function leggi() {
    const s = { modello: MODELLO, tipo: radio("tipo"), arredo: radio("arredo"), durata_anni: Number(campo("durata_anni").value),
      zona: campo("zona").value, area_pregio: campo("area_pregio").value, classe: campo("classe").value };
    for (const k of TESTI) s[k] = campo(k).value.trim();
    for (const k of CASELLE) s[k] = campo(k).checked;
    const valore = $("torino-valore");
    s.valore_mq = valore.dataset.modificato ? valore.value.trim() : "";
    s.superfici = {};
    for (const r of accordo.regole.superficie) s.superfici[r.chiave] = campo("sup_" + r.chiave).value.trim();
    s.elementi = {};
    modulo.querySelectorAll("input[name=el]").forEach((c) => { s.elementi[c.value] = c.checked; });
    s.elementi_studenti = [...modulo.querySelectorAll("input[name=els]")].map((c) => c.checked);
    s.correttivi = { nuovo_8_anni: campo("c_nuovo_8_anni").value.trim(), ristrutturato: campo("c_ristrutturato").value.trim() };
    s.catasto = { foglio: "", particella: "", subalterno: "" };
    s.maggiorazioni = { ammobiliato: s.arredo === "completo" || s.arredo === "camera" ? "10" : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const metti = (nome, val) => { const c = modulo.querySelector(`input[name=${nome}][value="${val}"]`); if (c) c.checked = true; };
    metti("tipo", d.tipo); metti("arredo", d.arredo || "no");
    if (d.durata_anni) campo("durata_anni").value = String(d.durata_anni);
    for (const k of ["zona", "area_pregio", "classe"]) campo(k).value = d[k] || "";
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    for (const k of CASELLE) campo(k).checked = !!d[k];
    for (const r of accordo.regole.superficie) campo("sup_" + r.chiave).value = (d.superfici || {})[r.chiave] || "";
    modulo.querySelectorAll("input[name=el]").forEach((c) => { c.checked = !!(d.elementi || {})[c.value]; });
    modulo.querySelectorAll("input[name=els]").forEach((c, i) => { c.checked = !!(d.elementi_studenti || [])[i]; });
    campo("c_nuovo_8_anni").value = (d.correttivi || {}).nuovo_8_anni || "";
    campo("c_ristrutturato").value = (d.correttivi || {}).ristrutturato || "";
    const valore = $("torino-valore");
    if (d.valore_mq) { valore.value = d.valore_mq; valore.dataset.modificato = "1"; } else delete valore.dataset.modificato;
    delete campo("zona").dataset.auto;
    zonaDaIndirizzo(false);
    ricalcola();
  }

  // -------------------------------------------------------------- calcolo
  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneTorino.calcola(accordo, s);
    ultimo = { scheda: s, r };
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("tipo-studenti", s.tipo === "studenti");
    modulo.classList.toggle("parziale", s.parziale && s.tipo !== "agevolato");
    modulo.classList.toggle("con-pregio", s.zona === "P");
    for (const riga of r.righe) {
      const td = modulo.querySelector(`[data-sup="${riga.chiave}"]`);
      if (td) td.textContent = riga.convenzionale === null ? "—" : v(riga.convenzionale);
    }
    $("torino-totale").textContent = r.superficie === null ? "—" : v(r.superficie);
    $("torino-mq").textContent = r.mq_convenzionali === null ? "" : r.piccoli_perc
      ? `Alloggio di ${v(r.superficie)} mq: maggiorazione dei mq del ${r.piccoli_perc}% → ${v(r.mq_convenzionali)} mq convenzionali.`
      : r.minimo_80 ? `Fra 67 e 80 mq la metratura convenzionale non può essere inferiore a 80,4 mq.` : "";
    $("torino-punti").textContent = `· ${v(r.punti, r.punti % 1 ? 1 : 0)} punti, ${r.elementi} dotazioni`;
    $("torino-punti-studenti").textContent = s.tipo === "studenti" ? `· ${r.elementi} su 7` : "";
    $("torino-esito-fascia").textContent = r.fascia
      ? (r.pregio && !r.zona_calcolo ? `Pregio (senza sub-fasce): da € ${v(r.fascia[0])} a € ${v(r.fascia[1])}`
        : `Zona ${accordo.zone[r.zona_calcolo]}, ${r.sub}^ sub-fascia: da € ${v(r.fascia[0])} a € ${v(r.fascia[1])}`)
      : "scegli la zona";
    $("torino-esito-mq").textContent = r.mq_convenzionali === null ? "—" : `${v(r.mq_convenzionali)} mq`;
    const valore = $("torino-valore");
    if (!valore.dataset.modificato) valore.value = r.valore_proposto === null ? "" : v(r.valore_proposto);
    $("torino-valore-nota").textContent = r.valore_proposto === null ? "" : valore.dataset.modificato ? `massimo ${v(r.valore_proposto)}` : "il massimo della fascia";
    $("torino-esito-base").textContent = r.canone_base === null ? "—" : `${euro(r.canone_base)} al mese`;
    $("torino-esito-correttivi").textContent = r.correttivi.length
      ? r.correttivi.map((c) => `${c.nome} ${c.percento > 0 ? "+" : "−"}${v(Math.abs(c.percento), c.percento % 1 ? 1 : 0)}%`).join(", ") +
        ` = ${r.totale_perc >= 0 ? "+" : "−"}${v(Math.abs(r.totale_perc), r.totale_perc % 1 ? 1 : 0)}% → ${euro(r.canone)}`
      : "nessuna";
    $("torino-esito-massimo").textContent = euro(r.canone_massimo);
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("torino-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  let attesa = null;
  modulo.addEventListener("input", (e) => {
    if (e.target.id === "torino-valore") { if (e.target.value.trim()) e.target.dataset.modificato = "1"; else delete e.target.dataset.modificato; }
    if (e.target.name === "indirizzo") { clearTimeout(attesa); attesa = setTimeout(() => { zonaDaIndirizzo(); ricalcola(); }, 250); }
    ricalcola();
  });
  modulo.addEventListener("change", (e) => {
    const t = e.target;
    // nei gruppi di alternative (1, 4, 5, 6, 7) una casella sola
    if (t.name === "el" && t.checked && t.dataset.gruppo)
      modulo.querySelectorAll(`input[name=el][data-gruppo="${t.dataset.gruppo}"]`).forEach((c) => { if (c !== t) c.checked = false; });
    if (t.name === "zona") { delete t.dataset.auto; zonaDaIndirizzo(false); }
    ricalcola();
  });
  modulo.addEventListener("focusin", (e) => { if (e.target.name === "indirizzo") prepara(); });
  modulo.addEventListener("click", (e) => {
    const b = e.target.closest("#torino-vie [data-zona]");
    if (!b) return;
    const sel = campo("zona");
    sel.value = b.dataset.zona; sel.dataset.auto = "1";
    $("torino-vie").hidden = true;
    $("torino-zona-indirizzo").innerHTML = `<b>Zona ${testo(accordo.zone[b.dataset.zona])}</b> secondo l'elenco viario (${testo(b.textContent.replace(/zona .*$/, "").trim())})`;
    ricalcola();
  });

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
    const byte = await StampaTorino.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Attestazione canone Torino", s.locatore || "", s.zona ? "zona " + s.zona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
  };

  // ---------------------------------------------------------------- avvio
  window.addEventListener("accordo", (e) => {
    const nostro = e.detail && e.detail.accordo && e.detail.accordo.modello === MODELLO;
    modulo.hidden = !nostro;
    if (!nostro) { accordo = null; ultimo = null; return; }
    accordo = e.detail;
    costruisci();
    modulo.reset();
    delete campo("zona").dataset.auto;
    delete $("torino-valore").dataset.modificato;
    $("torino-vie").hidden = true; $("torino-zona-indirizzo").innerHTML = "";
    campo("citta").value = (accordo.accordo.comune || "").toUpperCase();
    ricalcola();
  });

  const api = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Torino)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Torino", s.zona ? `zona ${accordo.zone[s.zona] || s.zona}` : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  window.SchedaTorino = api;
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
