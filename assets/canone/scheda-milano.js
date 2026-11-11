/*
 * La scheda del canone per l'accordo di Milano (2023): il modulo
 * #scheda-milano, che riproduce la "Richiesta di attestazione bilaterale".
 * Si attiva quando la pagina carica un accordo con "modello": "milano-2023";
 * con gli altri accordi resta nascosta e lavora scheda.js (Roma).
 *
 * Calcolo in canone-milano.js, PDF in stampa-milano.js. Verso il resto della
 * pagina (salvataggio, contratto, barra in basso) espone le stesse funzioni
 * della scheda di Roma: window.SchedaMilano, usata da SchedaCanone.
 */
(function () {
  "use strict";
  const MODELLO = "milano-2023";
  const modulo = document.getElementById("scheda-milano");
  if (!modulo) return;
  const campo = (nome) => modulo.elements[nome];
  const $ = (id) => document.getElementById(id);
  const v = (n, c = 2) => CanoneMilano.virgola(n, c);
  const euro = (n) => (n === null || n === undefined ? "—" : "€ " + v(n));
  const testo = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let accordo = null, ultimo = null;

  const TESTI = ["locatore", "locatore_cf", "locatore_comune", "locatore_via", "conduttore", "conduttore_cf",
    "conduttore_comune", "conduttore_via", "citta", "indirizzo", "piano", "foglio", "particella", "subalterno",
    "dal", "al", "canone_annuo"];

  // ------------------------------------------------------------- costruzione

  function costruisci() {
    const E = accordo.elementi;
    const gruppi = [["A", "Elementi di tipo A"], ["B", "Elementi di tipo B"], ["C", "Elementi di tipo C"],
      ["D", `Elementi di tipo D <small>(con almeno ${accordo.regole.elementi_D_per_massimo} si applica il massimo della sub-fascia)</small>`]];
    $("milano-elementi").innerHTML = gruppi.map(([t, titolo]) => `
      <h3 class="sotto">${titolo}</h3>
      <div class="caselle colonna elementi">${E[t].map(([k, d]) =>
        `<label><input type="checkbox" name="el" value="${k}"> <span><b class="codice">${k}</b> ${testo(d)}</span></label>`).join("")}</div>`).join("");
    $("milano-stanze").innerHTML = E.stanze.map(([k, d]) =>
      `<label><input type="checkbox" name="stanza" value="${k}"> <span>${testo(d)}</span></label>`).join("");
    $("milano-superfici").innerHTML = accordo.regole.superficie.righe.map((r) => `
      <tr data-riga="${r.chiave}"${r.solo_parziale ? ' class="solo-parziale"' : ""}>
        <th scope="row">${testo(r.etichetta)}</th>
        <td><input type="text" class="campo-numero" name="sup_${r.chiave}" inputmode="decimal" aria-label="${testo(r.etichetta)}, mq da visura"></td>
        <td class="coeff">${v(r.coeff)}</td>
        <td class="risultato" data-sup="${r.chiave}">—</td>
      </tr>`).join("") + `
      <tr data-riga="piccoli">
        <th scope="row">${testo(accordo.regole.superficie.piccoli.etichetta)}</th>
        <td class="risultato" data-sup-mq="piccoli">—</td>
        <td class="coeff">${v(accordo.regole.superficie.piccoli.coeff)}</td>
        <td class="risultato" data-sup="piccoli">—</td>
      </tr>`;
    const zona = campo("zona");
    zona.innerHTML = '<option value="">scegli…</option>' + accordo.zone.map((z) =>
      `<option value="${z.codice}">${z.nome} (${z.colore} sulla mappa)</option>`).join("");
    $("milano-cerca-zona").innerHTML = (accordo.stradario ? "La zona si imposta da sola quando scrivi via e numero civico. " : "") + "Puoi controllarla sulla " + (accordo.cerca_zona || []).map((l) =>
      `<a href="${testo(l.url)}" target="_blank" rel="noopener" class="text-[#2E7CF6] underline">${testo(l.nome)}</a>`).join(" · ");
  }

  // ------------------------------------------- zona dall'indirizzo (stradario)
  // Lo stradario dell'accordo (allegato, 52.762 indirizzi): via -> zona, o per
  // le vie divise fra piu' zone, zona -> numeri civici. Si scarica al primo uso.
  let stradario = null, caricamento = null, indice = null;
  const norma = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'").toUpperCase().replace(/\s+/g, " ").trim();
  const TIPI = /^(VIA|VIALE|PIAZZA|PIAZZALE|PIAZZETTA|LARGO|CORSO|VICOLO|GALLERIA|PASSAGGIO|BASTIONI|STRADA|SITO|ALZAIA|CAVALCAVIA|FORO|GIARDINO|SOTTOPASSO|RIPA|PARCO|P\.ZA|P\.LE|V\.LE|C\.SO)\s+/;
  function prepara() {
    if (caricamento || !accordo.stradario) return caricamento;
    caricamento = fetch("accordi/" + accordo.stradario).then((r) => r.json()).then((d) => {
      stradario = d.vie;
      indice = Object.keys(stradario).map((via) => ({ via, intera: norma(via), nome: norma(via).replace(TIPI, "") }));
    }).catch(() => { caricamento = null; });
    return caricamento;
  }
  /** "Via Paolo Sarpi 12" -> { via: "VIA PAOLO SARPI", civico: "12" } */
  function dividi(testoIndirizzo) {
    const t = norma(testoIndirizzo).replace(/,/g, " ").replace(/\s+/g, " ");
    const m = t.match(/^(.*?)\s+(?:N\.?\s*)?(\d+\s*[A-Z]?(?:\/\d+[A-Z]?)?)$/);
    return m ? { via: m[1], civico: m[2].replace(/\s+/g, "") } : { via: t, civico: "" };
  }
  const SIGLE = { "C.SO": "CORSO", "P.ZA": "PIAZZA", "P.ZZA": "PIAZZA", "P.LE": "PIAZZALE", "V.LE": "VIALE", "V.": "VIA", "L.GO": "LARGO" };
  function trovaVie(via) {
    if (!via) return [];
    const parole = via.split(" ");
    if (SIGLE[parole[0]]) { parole[0] = SIGLE[parole[0]]; via = parole.join(" "); }
    const intera = indice.filter((x) => x.intera === via);
    if (intera.length) return intera;
    const esatta = indice.filter((x) => x.nome === via);
    if (esatta.length) return esatta;
    const senza = via.replace(TIPI, "");
    return indice.filter((x) => x.nome.includes(senza)).slice(0, 8);
  }
  function zonaDaIndirizzo(aggiornaSelezione = true) {
    const box = $("milano-vie"), esito = $("milano-zona-indirizzo"), sel = campo("zona");
    // la zona messa in automatico si toglie se l'indirizzo non la determina piu'
    const togliAuto = () => { if (aggiornaSelezione && sel.dataset.auto) { sel.value = ""; delete sel.dataset.auto; } };
    if (!stradario) { prepara() && prepara().then(() => stradario && zonaDaIndirizzo(aggiornaSelezione)); return; }
    const { via, civico } = dividi(campo("indirizzo").value);
    box.hidden = true; box.innerHTML = ""; esito.innerHTML = "";
    if (via.length < 3) { togliAuto(); return; }
    const trovate = trovaVie(via);
    if (trovate.length !== 1) {
      togliAuto();
      if (!trovate.length) { esito.textContent = "Via non trovata nello stradario dell'accordo: controlla come è scritta, o scegli la zona dalla mappa."; return; }
      box.innerHTML = trovate.map((x) => `<button type="button" role="option" data-via="${testo(x.via)}">${testo(x.via)}</button>`).join("");
      box.hidden = false;
      return;
    }
    const nome = trovate[0].via, voce = stradario[nome];
    let zona = null, nota = "";
    if (typeof voce === "number") zona = String(voce);
    else if (civico) {
      for (const [z, elenco] of Object.entries(voce)) if (elenco.split(" ").includes(civico)) zona = z;
      if (!zona) {
        nota = `il civico ${civico} non è nell'elenco: la via è divisa fra le zone ${Object.keys(voce).join(", ")}.`;
        // i civici vicini sullo stesso lato (pari o dispari): se sono nella stessa zona, la suggerisce
        const n = parseInt(civico, 10);
        if (n) {
          let sotto = null, sopra = null;
          for (const [z, elenco] of Object.entries(voce)) for (const c of elenco.split(" ")) {
            const k = parseInt(c, 10);
            if (!k || k % 2 !== n % 2) continue;
            if (k <= n && (!sotto || k > sotto.k)) sotto = { k, c, z };
            if (k >= n && (!sopra || k < sopra.k)) sopra = { k, c, z };
          }
          if (sotto && sopra && sotto.z === sopra.z) nota += ` I civici vicini (${sotto.c} e ${sopra.c}) sono in zona ${sotto.z}: probabilmente è quella, controlla sulla mappa.`;
          else nota += " Controlla sulla mappa.";
        } else nota += " Controlla sulla mappa.";
      }
    } else nota = `la via è divisa fra le zone ${Object.keys(voce).join(", ")}: scrivi anche il numero civico.`;
    if (!zona) { togliAuto(); esito.innerHTML = `<b>${testo(nome)}</b>: ${testo(nota)}`; return; }
    if (aggiornaSelezione && (!sel.value || sel.dataset.auto)) { sel.value = zona; sel.dataset.auto = "1"; }
    const diversa = sel.value && sel.value !== zona;
    esito.innerHTML = `<b>Zona ${zona}</b> secondo lo stradario dell'accordo (${testo(nome)}${civico ? " " + testo(civico) : ""})` +
      (diversa ? ` <span class="avviso-zona">· hai scelto la zona ${testo(sel.value)}</span>` : "");
  }

  // --------------------------------------------------------------- lettura

  function leggi() {
    const s = { modello: MODELLO };
    s.tipo = modulo.querySelector("input[name=tipo]:checked").value;
    s.modo = modulo.querySelector("input[name=modo]:checked").value;
    s.arredo = modulo.querySelector("input[name=arredo]:checked").value;
    s.durata_anni = Number(campo("durata_anni").value);
    s.parziale = campo("parziale").checked;
    s.classe_G = campo("classe_G").checked;
    for (const k of TESTI) s[k] = campo(k).value.trim();
    s.zona = campo("zona").value;
    s.catasto = { foglio: s.foglio, particella: s.particella, subalterno: s.subalterno };
    s.elementi = {};
    modulo.querySelectorAll("input[name=el]").forEach((c) => { s.elementi[c.value] = c.checked; });
    s.stanze = {};
    modulo.querySelectorAll("input[name=stanza]").forEach((c) => { s.stanze[c.value] = c.checked; });
    s.superfici = {};
    for (const r of accordo.regole.superficie.righe) s.superfici[r.chiave] = campo("sup_" + r.chiave).value.trim();
    // per il contratto (stesse chiavi della scheda di Roma)
    s.maggiorazioni = { ammobiliato: s.arredo === "completo" ? "15" : s.arredo === "semi" ? "8" : "" };
    return s;
  }

  function carica(d) {
    if (!d || !accordo) return;
    modulo.reset();
    const radio = (nome, val) => { const c = modulo.querySelector(`input[name=${nome}][value="${val}"]`); if (c) c.checked = true; };
    radio("tipo", d.tipo); radio("modo", d.modo); radio("arredo", d.arredo || "no");
    if (d.durata_anni) campo("durata_anni").value = String(d.durata_anni);
    campo("parziale").checked = !!d.parziale; campo("classe_G").checked = !!d.classe_G;
    for (const k of TESTI) if (d[k] !== undefined && d[k] !== null) campo(k).value = d[k];
    campo("zona").value = d.zona || "";
    modulo.querySelectorAll("input[name=el]").forEach((c) => { c.checked = !!(d.elementi || {})[c.value]; });
    modulo.querySelectorAll("input[name=stanza]").forEach((c) => { c.checked = !!(d.stanze || {})[c.value]; });
    for (const r of accordo.regole.superficie.righe) campo("sup_" + r.chiave).value = (d.superfici || {})[r.chiave] || "";
    delete campo("zona").dataset.auto;
    zonaDaIndirizzo(false);
    ricalcola();
  }

  // -------------------------------------------------------------- calcolo

  function ricalcola() {
    if (!accordo) return;
    const s = leggi(), r = CanoneMilano.calcola(accordo, s);
    ultimo = { scheda: s, r };
    modulo.classList.toggle("tipo-agevolato", s.tipo === "agevolato");
    modulo.classList.toggle("modo-stanza", s.modo === "stanza");
    modulo.classList.toggle("parziale", s.parziale);

    const c = r.conteggi;
    $("milano-conteggi").textContent = `· A ${c.A}/4 · B ${c.B}/3 · C ${c.C}/9 · D ${c.D}/10`;
    for (const riga of r.righe) {
      const td = modulo.querySelector(`[data-sup="${riga.chiave}"]`);
      if (td) td.textContent = riga.convenzionale === null ? "—" : v(riga.convenzionale);
    }
    modulo.querySelector('[data-sup-mq="piccoli"]').textContent = r.piccoli === null ? "—" : v(r.righe.find((x) => x.chiave === "piccoli").mq);
    $("milano-totale").textContent = r.totale === null ? "—" : v(r.totale);

    const z = r.zona;
    $("milano-esito-zona").textContent = z ? `${z.nome} (${z.colore})` : "scegli la zona";
    $("milano-esito-subfascia").textContent = `${r.subfascia} · ${r.subfascia_motivo}`;
    $("milano-esito-fascia").textContent = r.fascia ? `da ${v(r.fascia[0])} a ${v(r.fascia[1])}` : "—";
    $("milano-esito-correttivi").textContent = r.fattori.length
      ? r.fattori.map((f) => `${f.nome} ${f.percento > 0 ? "+" : "−"}${Math.abs(f.percento)}%`).join(" × ") +
        (r.fascia_corretta ? ` → da ${v(r.fascia_corretta[0])} a ${v(r.fascia_corretta[1])} €/mq` : "")
      : "nessuno";
    $("milano-esito-annuo").textContent = r.canone_min_annuo === null ? "—"
      : `da ${euro(r.canone_min_annuo)} a ${euro(r.canone_max_annuo)} (${v(r.totale)} mq)`;
    $("milano-esito-massimo").textContent = euro(r.canone_massimo) + (r.modo === "mq" && r.canone_massimo !== null && !r.massimo_con_D ? " (con almeno 5 elementi D)" : "");
    $("milano-mensile").textContent = r.canone_pattuito === null ? "" : `= ${euro(r.canone_pattuito)} al mese`;
    $("barra-massimo").textContent = euro(r.canone_massimo);
    $("milano-avvisi").innerHTML = r.avvisi.map((a) => `<li>${testo(a)}</li>`).join("");
  }

  let attesa = null;
  modulo.addEventListener("input", (e) => {
    if (e.target.name === "indirizzo") { clearTimeout(attesa); attesa = setTimeout(() => { zonaDaIndirizzo(); ricalcola(); }, 250); }
    ricalcola();
  });
  modulo.addEventListener("change", (e) => {
    if (e.target.name === "zona") { delete e.target.dataset.auto; zonaDaIndirizzo(false); }
    ricalcola();
  });
  modulo.addEventListener("focusin", (e) => { if (e.target.name === "indirizzo") prepara(); });
  modulo.addEventListener("click", (e) => {
    const b = e.target.closest("#milano-vie [data-via]");
    if (!b) return;
    const { civico } = dividi(campo("indirizzo").value);
    campo("indirizzo").value = b.dataset.via + (civico ? " " + civico : " ");
    campo("indirizzo").focus();
    zonaDaIndirizzo(); ricalcola();
  });

  // ------------------------------------------------------------------ PDF
  let risorse = null;
  async function creaPDF() {
    if (window.caricaLibrerie) await window.caricaLibrerie("pdf");
    if (!ultimo || !window.PDFLib || !window.fontkit) throw new Error("la stampa non è ancora pronta, riprova tra un attimo");
    if (!risorse) {
      const prendi = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error("file mancante: " + f); return r.arrayBuffer(); });
      const [regolare, grassetto, icona] = await Promise.all([prendi("assets/canone/caratteri/LiberationSerif-Regular.ttf"),
        prendi("assets/canone/caratteri/LiberationSerif-Bold.ttf"),
        fetch("assets/canone/icona-locaonline.png").then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)]);
      const [sansRegolare, sansGrassetto] = await Promise.all([prendi("assets/canone/caratteri/Carlito-Regular.ttf"), prendi("assets/canone/caratteri/Carlito-Bold.ttf")]);
      risorse = { regolare, grassetto, icona, sansRegolare, sansGrassetto };
    }
    const byte = await StampaMilano.creaPDF({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, accordo, ultimo.scheda, ultimo.r);
    return new Blob([byte], { type: "application/pdf" });
  }
  const nomePDF = () => {
    const s = ultimo.scheda;
    return ["Scheda canone Milano", s.locatore || "", s.zona ? "zona " + s.zona : ""].filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + ".pdf";
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
    $("milano-vie").hidden = true; $("milano-zona-indirizzo").innerHTML = "";
    campo("citta").value = (accordo.accordo.comune || "").toUpperCase();
    ricalcola();
  });

  const api = window.SchedaMilano = {
    attiva: () => !!accordo,
    ultimo: () => ultimo, accordo: () => accordo, carica, creaPDF, nomePDF,
    leggi: () => (accordo ? leggi() : null),
    titolo: () => {
      if (!ultimo) return "Scheda del canone (Milano)";
      const s = ultimo.scheda, r = ultimo.r;
      return ["Milano", s.zona ? `zona ${s.zona}` : "zona da scegliere", s.indirizzo,
              r.canone_massimo ? `max € ${v(r.canone_massimo)}` : ""].filter(Boolean).join(" · ");
    },
  };
  (window.SchedeCitta = window.SchedeCitta || []).push(api);
})();
