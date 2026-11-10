/*
 * Il contratto su LocaOnLine (dal portale UPPI, senza salvataggio e senza
 * ricerca delle persone: i dati restano nel browser). Persone, immobile,
 * canone, calcoli automatici, PDF e Word.
 * Il testo lo fa Contratto (contratto.js), il PDF PdfContratto, il Word
 * WordContratto: qui solo il modulo.
 */
(function () {
  "use strict";
  const modulo = document.getElementById("modulo-contratto");
  const campo = (n) => modulo.elements[n];
  const val = (n) => (campo(n) ? String(campo(n).value || "").trim() : "");
  const numero = (s) => {
    s = String(s || "").trim().replace(/\s|€/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  let accordo = null;
  const ETICHETTE = { locatori: "Locatore", conduttori: "Conduttore", fideiussori: "Fideiussore" };

  const PREAVVISO = { agevolato: 6, studenti: 3, transitorio: 1, libero: 3, turistico: 1, comodato: 1 };
  const fineCalcolata = (d) => d.tipo === "studenti" ? Contratto.scadenza(d.decorrenza, 0, d.durata_mesi || 12)
    : (d.tipo === "transitorio" || d.tipo === "turistico") ? Contratto.fineTransitorio(d.decorrenza, d.durata_numero, d.durata_giorni)
    : d.tipo === "libero" ? Contratto.scadenza(d.decorrenza, 4)
    : d.tipo === "comodato" ? ""
    : Contratto.scadenza(d.decorrenza, d.durata_anni || 3);

  // ------------------------------------------------------------ codice fiscale

  const DISPARI = { 0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19,
    J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 };
  function cfValido(cf) {
    cf = String(cf || "").toUpperCase();
    if (/^\d{11}$/.test(cf)) {                       // partita IVA
      let s = 0;
      for (let i = 0; i < 11; i++) { let c = +cf[i]; if (i % 2) { c *= 2; if (c > 9) c -= 9; } s += c; }
      return s % 10 === 0;
    }
    if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
    let s = 0;
    for (let i = 0; i < 15; i++) {
      const c = cf[i];
      s += i % 2 === 0 ? DISPARI[c] : (/\d/.test(c) ? +c : c.charCodeAt(0) - 65);
    }
    return String.fromCharCode(65 + (s % 26)) === cf[15];
  }

  // ------------------------------------------------------------ persone

  function prendi(obj, percorso) { return percorso.split(".").reduce((o, k) => (o || {})[k], obj); }
  function metti(obj, percorso, v) {
    const k = percorso.split("."); let o = obj;
    k.slice(0, -1).forEach((x) => { o[x] = o[x] || {}; o = o[x]; });
    o[k[k.length - 1]] = v;
  }

  function tipoPersona(fs, tipo) {
    fs.dataset.tipo = tipo;
    fs.classList.toggle("giuridica", tipo === "giuridica");
  }

  function aggiungiPersona(ruolo, dati) {
    const box = modulo.querySelector(`.persone[data-ruolo="${ruolo}"]`);
    const fs = document.getElementById("modello-persona").content.firstElementChild.cloneNode(true);
    fs.dataset.ruolo = ruolo;
    fs.classList.toggle("conduttore", ruolo === "conduttori");
    box.appendChild(fs);
    tipoPersona(fs, (dati && dati.tipo) || "fisica");
    if (dati) scriviPersona(fs, dati, true);
    numeraPersone();
    return fs;
  }

  function numeraPersone() {
    modulo.querySelectorAll(".persone").forEach((box) => {
      const tutte = box.querySelectorAll(".persona");
      tutte.forEach((fs, i) => {
        fs.querySelector(".titolo-persona").textContent = ETICHETTE[box.dataset.ruolo] + (tutte.length > 1 ? ` ${i + 1}` : "");
        // locatori e conduttori: almeno uno, quindi niente "togli" se e' l'unico
        fs.querySelector(".togli").hidden = box.dataset.ruolo !== "fideiussori" && tutte.length === 1;
      });
    });
  }

  function leggiPersona(fs) {
    const p = { tipo: fs.dataset.tipo || "fisica" };
    fs.querySelectorAll("[data-campo]").forEach((c) => {
      const v = String(c.value || "").trim();
      if (v) metti(p, c.dataset.campo, c.dataset.campo === "cf" || c.dataset.campo === "rappresentante.cf" ? v.toUpperCase() : v);
    });
    return p;
  }

  /** Scrive i dati nella scheda: con "tutto", anche sui campi gia' scritti,
   *  tranne quelli che l'utente ha toccato a mano. */
  function scriviPersona(fs, dati, tutto) {
    if (dati.tipo) tipoPersona(fs, dati.tipo);
    fs.querySelectorAll("[data-campo]").forEach((c) => {
      const v = prendi(dati, c.dataset.campo);
      if (v === undefined || v === null || v === "") return;
      if (c.dataset.toccato && !tutto) return;
      // le caselle a scelta (sesso, documento) partono gia' impostate: si
      // aggiornano sempre, salvo che le abbia cambiate l'utente
      if (!tutto && c.tagName !== "SELECT" && String(c.value || "").trim() && !c.dataset.auto) return;
      c.value = v; c.dataset.auto = "1";
    });
  }

  /** Data di nascita e sesso dal codice fiscale (il luogo no: servirebbe
   *  l'elenco dei codici dei comuni). Per i codici con omocodia si leggono
   *  comunque le cifre sostituite. */
  const OMOCODIA = { L: 0, M: 1, N: 2, P: 3, Q: 4, R: 5, S: 6, T: 7, U: 8, V: 9 };
  const MESI_CF = "ABCDEHLMPRST";
  function daCodiceFiscale(cf) {
    const cifre = (t) => Number(t.split("").map((c) => (c in OMOCODIA ? OMOCODIA[c] : c)).join(""));
    const aa = cifre(cf.slice(6, 8)), mese = MESI_CF.indexOf(cf[8]) + 1;
    let gg = cifre(cf.slice(9, 11));
    if (!mese || !gg) return {};
    const sesso = gg > 40 ? "F" : "M";
    if (gg > 40) gg -= 40;
    const oggi = new Date().getFullYear() % 100;
    const anno = (aa > oggi ? 1900 : 2000) + aa;
    const due = (n) => String(n).padStart(2, "0");
    return { sesso, nascita_data: `${anno}-${due(mese)}-${due(gg)}` };
  }

  function controllaAmministratore(fs, input) {
    const cf = input.value.trim().toUpperCase(), esito = fs.querySelector(".esito-amministratore");
    input.value = cf;
    if (cf.length !== 16) { esito.textContent = ""; esito.className = "esito-cf esito-amministratore"; return; }
    if (!cfValido(cf)) { esito.textContent = "codice fiscale non valido: controlla"; esito.className = "esito-cf esito-amministratore errore"; return; }
    scriviPersona(fs, { rappresentante: daCodiceFiscale(cf) }, false);
    esito.textContent = "✓ valido: data di nascita e sesso dal codice fiscale"; esito.className = "esito-cf esito-amministratore trovato";
  }
  function controllaCf(fs, input) {
    const cf = input.value.trim().toUpperCase(), esito = fs.querySelector(".esito-cf");
    input.value = cf;
    if (cf.length !== 16 && cf.length !== 11) { esito.textContent = ""; esito.className = "esito-cf"; return; }
    tipoPersona(fs, cf.length === 11 ? "giuridica" : "fisica");
    if (!cfValido(cf)) { esito.textContent = cf.length === 11 ? "partita IVA non valida" : "codice fiscale non valido: controlla"; esito.className = "esito-cf errore"; return; }
    if (cf.length === 16) scriviPersona(fs, daCodiceFiscale(cf), false);
    esito.textContent = cf.length === 16 ? "✓ valido: data di nascita e sesso dal codice fiscale" : "✓ partita IVA valida";
    esito.className = "esito-cf trovato";
  }

  // ------------------------------------------------------------ unita' catastali

  function aggiungiUnita(dati) {
    const box = document.getElementById("unita-catastali");
    const u = document.getElementById("modello-unita").content.firstElementChild.cloneNode(true);
    box.appendChild(u);
    if (dati) u.querySelectorAll("[data-c]").forEach((c) => {
      const v = dati[c.dataset.c];
      if (!v) return;
      if (c.tagName === "SELECT" && ![...c.options].some((o) => o.value === v)) c.add(new Option(v, v));
      c.value = v;
    });
    return u;
  }

  // ------------------------------------------------------------ lettura e scrittura

  function leggi() {
    const persone = (ruolo) => [...modulo.querySelectorAll(`.persone[data-ruolo="${ruolo}"] .persona`)].map(leggiPersona);
    const accessori = [...modulo.querySelectorAll("input[name=acc]:checked")].map((c) => c.value);
    if (val("acc_altro")) accessori.push(val("acc_altro"));
    return {
      tipo: val("tipo") || "agevolato", cedolare: val("cedolare") !== "no", durata_anni: Number(val("durata_anni")) || 3,
      durata_mesi: Number(val("durata_mesi")) || 12, corso_studi: val("corso_studi"), universita: val("universita"),
      oneri_modo: (modulo.querySelector("input[name=oneri_modo]:checked") || {}).value || "amministratore",
      oneri_quota: val("oneri_quota"), utenze_acconto: numero(val("utenze_acconto")), subentro: val("subentro"),
      durata_numero: Number(val("durata_numero")) || 0, durata_giorni: Number(val("durata_giorni")) || 0,
      canone_mensile: numero(val("canone_mensile")), canone_modo: val("canone_modo") || "mensile", canone_totale: numero(val("canone_totale")),
      esigenza_di: (modulo.querySelector("input[name=esigenza_di]:checked") || {}).value || "locatore",
      motivo: campo("motivo").value.trim(), preavviso_mesi: Number(val("preavviso_mesi")) || null,
      fideiussione_periodo: val("fideiussione_periodo") || "annua",
      finalita: val("finalita"), abitazione_principale: val("abitazione_principale"),
      recesso_breve: !!(campo("recesso_breve") && campo("recesso_breve").checked),
      parentela: val("parentela"), durata_comodato: val("durata_comodato") || "indeterminata", spese_comodato: val("spese_comodato") || "comodatario",
      decorrenza: val("decorrenza"), scadenza: val("scadenza"),
      assistenza_locatore: { organizzazione: val("ass_loc_organizzazione"), persona: val("ass_loc_persona") },
      locatori: persone("locatori"), conduttori: persone("conduttori"), fideiussori: persone("fideiussori"),
      fideiussione_importo: numero(val("fideiussione_importo")),
      assistenza_conduttore: { organizzazione: val("ass_organizzazione"), persona: val("ass_persona") },
      immobile: {
        porzione: modulo.querySelector("input[name=porzione]:checked").value === "si", comune: val("comune"),
        via: val("via"), civico: val("civico"), piano: val("piano"), scala: val("scala"), interno: val("interno"),
        vani: val("vani"), descrizione: val("descrizione"), regolazione: val("regolazione"), accessori,
        ammobiliato: val("ammobiliato"), classe_energetica: val("classe_energetica").toUpperCase(),
        impianti_a_norma: val("impianti_a_norma") !== "no",
        catasto: [...document.querySelectorAll("#unita-catastali .unita-catastale")].map((u) => {
          const o = {}; u.querySelectorAll("[data-c]").forEach((c) => { if (c.value.trim()) o[c.dataset.c] = c.dataset.c === "rendita" ? numero(c.value) : c.value.trim(); });
          return o;
        }),
        millesimi: { proprieta: val("mm_proprieta"), riscaldamento: val("mm_riscaldamento"), acqua: val("mm_acqua"),
                     scale: val("mm_scale"), ascensore: val("mm_ascensore"), altre: val("mm_altre") },
      },
      canone_annuo: numero(val("canone_annuo")), rate: Number(val("rate")) || 12, pagamento: val("pagamento"),
      giorno_pagamento: Number(val("giorno_pagamento")) || null,
      iban: val("iban"), intestatario_conto: val("intestatario_conto"), pagamento_altro: val("pagamento_altro"), istat: val("istat"),
      deposito: { modo: modulo.querySelector("input[name=deposito_modo]:checked").value, importo: numero(val("deposito_importo")),
                  mensilita: val("deposito_mensilita") },
      altre_garanzie: val("altre_garanzie"), oneri_acconto: numero(val("oneri_acconto")), oneri_periodo: val("oneri_periodo"),
      conviventi: val("conviventi"), stato_immobile: val("stato_immobile"), visite: val("visite"),
      sublocazione: campo("sublocazione").checked, altre_clausole: campo("altre_clausole").value,
      firma: { luogo: val("firma_luogo"), data: val("firma_data") },
    };
  }

  function carica(d) {
    const metti = (n, v) => { if (campo(n) && v !== undefined && v !== null && v !== "") campo(n).value = v; };
    const it = (n) => (n === null || n === undefined || n === "" ? "" : String(n).replace(".", ","));
    metti("tipo", d.tipo); metti("cedolare", d.cedolare === false ? "no" : "si"); metti("durata_anni", d.durata_anni);
    metti("durata_mesi", d.durata_mesi); metti("corso_studi", d.corso_studi); metti("universita", d.universita);
    if (d.oneri_modo) modulo.querySelector(`input[name=oneri_modo][value="${d.oneri_modo}"]`).checked = true;
    metti("oneri_quota", d.oneri_quota); metti("utenze_acconto", it(d.utenze_acconto)); metti("subentro", d.subentro);
    metti("durata_numero", d.durata_numero); metti("durata_giorni", d.durata_giorni || ""); metti("motivo", d.motivo);
    metti("fideiussione_periodo", d.fideiussione_periodo); metti("finalita", d.finalita); metti("abitazione_principale", d.abitazione_principale);
    metti("parentela", d.parentela); campo("recesso_breve").checked = !!d.recesso_breve; metti("durata_comodato", d.durata_comodato); metti("spese_comodato", d.spese_comodato);
    metti("comune", (d.immobile || {}).comune);
    if (d.preavviso_mesi) { metti("preavviso_mesi", d.preavviso_mesi); if (d.preavviso_mesi !== PREAVVISO[d.tipo || "agevolato"]) campo("preavviso_mesi").dataset.toccato = "1"; }
    metti("canone_mensile", it(d.canone_mensile)); metti("canone_modo", d.canone_modo); metti("canone_totale", it(d.canone_totale));
    if (d.esigenza_di) modulo.querySelector(`input[name=esigenza_di][value="${d.esigenza_di}"]`).checked = true;
    if (d.rate) campo("rate").dataset.toccato = "1";
    metti("decorrenza", d.decorrenza); metti("scadenza", d.scadenza);
    const al = d.assistenza_locatore || {}; metti("ass_loc_organizzazione", al.organizzazione); metti("ass_loc_persona", al.persona);
    if (d.scadenza && d.decorrenza && d.scadenza !== fineCalcolata(d)) campo("scadenza").dataset.toccato = "1";
    for (const ruolo of ["locatori", "conduttori", "fideiussori"]) (d[ruolo] || []).forEach((p) => aggiungiPersona(ruolo, p));
    metti("fideiussione_importo", it(d.fideiussione_importo));
    const ac = d.assistenza_conduttore || {}; metti("ass_organizzazione", ac.organizzazione); metti("ass_persona", ac.persona);
    const i = d.immobile || {};
    modulo.querySelector(`input[name=porzione][value="${i.porzione ? "si" : "no"}"]`).checked = true;
    ["via", "civico", "piano", "scala", "interno", "vani", "descrizione", "regolazione", "ammobiliato", "classe_energetica"].forEach((k) => metti(k, i[k]));
    metti("impianti_a_norma", i.impianti_a_norma === false ? "no" : "si");
    const note = ["soffitta", "cantina", "autorimessa singola", "posto macchina in comune"];
    (i.accessori || []).forEach((a) => {
      const c = modulo.querySelector(`input[name=acc][value="${a}"]`);
      if (c) c.checked = true; else if (!note.includes(a)) metti("acc_altro", a);
    });
    (i.catasto || []).forEach((u) => aggiungiUnita(Object.assign({}, u, { rendita: it(u.rendita) })));
    const mm = i.millesimi || {};
    Object.entries({ proprieta: "mm_proprieta", riscaldamento: "mm_riscaldamento", acqua: "mm_acqua", scale: "mm_scale", ascensore: "mm_ascensore", altre: "mm_altre" })
      .forEach(([k, n]) => metti(n, mm[k]));
    metti("canone_annuo", it(d.canone_annuo)); metti("rate", d.rate); metti("pagamento", d.pagamento);
    metti("giorno_pagamento", d.giorno_pagamento);
    if (d.giorno_pagamento && d.giorno_pagamento !== Contratto.giornoPagamento(d.decorrenza)) campo("giorno_pagamento").dataset.toccato = "1";
    metti("iban", d.iban); metti("intestatario_conto", d.intestatario_conto); metti("pagamento_altro", d.pagamento_altro); metti("istat", d.istat);
    const dep = d.deposito || {};
    if (dep.modo) modulo.querySelector(`input[name=deposito_modo][value="${dep.modo}"]`).checked = true;
    metti("deposito_importo", it(dep.importo)); metti("deposito_mensilita", dep.mensilita);
    if (dep.mensilita) campo("deposito_mensilita").dataset.toccato = "1";
    metti("altre_garanzie", d.altre_garanzie); metti("oneri_acconto", it(d.oneri_acconto)); metti("oneri_periodo", d.oneri_periodo);
    metti("conviventi", d.conviventi); metti("stato_immobile", d.stato_immobile); metti("visite", d.visite);
    campo("sublocazione").checked = !!d.sublocazione; metti("altre_clausole", d.altre_clausole);
    const f = d.firma || {}; metti("firma_luogo", f.luogo); metti("firma_data", f.data);
  }

  // ------------------------------------------------------------ calcoli e controlli

  function aggiorna() {
    const d = leggi();
    // la fine dalla decorrenza, se non e' stata scritta a mano
    const s = campo("scadenza");
    if (!s.dataset.toccato && d.decorrenza) s.value = fineCalcolata(d);
    // il tipo di contratto: le parti del modulo che cambiano
    modulo.classList.toggle("tipo-agevolato", d.tipo === "agevolato");
    modulo.classList.toggle("tipo-studenti", d.tipo === "studenti");
    // turistico e transitorio hanno la stessa durata (mesi e giorni) e lo stesso canone
    const breve = d.tipo === "transitorio" || d.tipo === "turistico";
    modulo.classList.toggle("tipo-transitorio", breve);
    modulo.classList.toggle("tipo-esigenza", d.tipo === "transitorio");
    modulo.classList.toggle("tipo-turistico", d.tipo === "turistico");
    modulo.classList.toggle("tipo-libero", d.tipo === "libero");
    modulo.classList.toggle("tipo-comodato", d.tipo === "comodato");
    modulo.classList.toggle("comodato-determinato", d.tipo === "comodato" && d.durata_comodato === "determinata");
    modulo.classList.toggle("tipo-oneri-modo", d.tipo === "studenti" || d.tipo === "libero");
    modulo.classList.toggle("oneri-al-locatore", (d.tipo === "studenti" || d.tipo === "libero") && d.oneri_modo === "locatore");
    // nel comodato le parti si chiamano comodante e comodatario
    const comodato = d.tipo === "comodato";
    if (ETICHETTE.locatori !== (comodato ? "Comodante" : "Locatore")) {
      ETICHETTE.locatori = comodato ? "Comodante" : "Locatore"; ETICHETTE.conduttori = comodato ? "Comodatario" : "Conduttore";
      document.querySelector(".titolo-locatori").textContent = comodato ? "Comodanti" : "Locatori";
      document.querySelector(".titolo-conduttori").textContent = comodato ? "Comodatari" : "Conduttori";
      document.querySelector(".nome-locatore").textContent = comodato ? "comodante" : "locatore";
      document.querySelector(".nome-conduttore").textContent = comodato ? "comodatario" : "conduttore";
      numeraPersone();
    }
    document.querySelector(".etichetta-decorrenza").textContent = comodato ? "A partire dal" : "Decorrenza";
    document.querySelector(".etichetta-preavviso").textContent = comodato ? "Preavviso per la restituzione anticipata" : "Preavviso per il recesso del conduttore";
    // sotto i due mesi il recesso e' facoltativo: una casella, e la scelta del
    // preavviso solo se la si spunta
    const sottoDueMesi = Contratto.breveSenzaObbligo(d);
    document.querySelector(".nota-recesso").hidden = !sottoDueMesi;
    campo("preavviso_mesi").hidden = !Contratto.conRecesso(d);
    // il preavviso del recesso: proposto secondo il tipo, se non e' stato scelto
    const pv = campo("preavviso_mesi");
    if (!pv.dataset.toccato) pv.value = String(PREAVVISO[d.tipo] || 6);
    // il transitorio: canone mensile, i giorni finali in proporzione
    if (breve) {
      const k = Contratto.canoneTransitorio(d), c = (n) => "€ " + Lettere.cifre(n);
      const parti = [];
      if (k.mesi) parti.push(`${k.mesi} ${k.mesi === 1 ? "rata" : "rate"} da ${c(k.mensile)}`);
      if (k.giorni) parti.push(`${c(k.rataGiorni)} per ${k.giorni} ${k.giorni === 1 ? "giorno" : "giorni"}`);
      document.getElementById("calcolo-transitorio").textContent = k.totale ? `${parti.join(" + ")} = ${c(k.totale)} in tutto` : "—";
      modulo.classList.toggle("canone-totale", d.canone_modo === "totale");
      d.canone_mensile_calcolato = k.mensile;
    }
    modulo.querySelector('[data-ripristina="scadenza"]').hidden = !s.dataset.toccato;
    // il giorno di pagamento dalla decorrenza
    const gp = campo("giorno_pagamento");
    if (!gp.dataset.toccato) gp.value = d.decorrenza ? Contratto.giornoPagamento(d.decorrenza) : "";
    modulo.querySelector('[data-ripristina="giorno_pagamento"]').hidden = !gp.dataset.toccato;
    document.getElementById("testo-pagamento").textContent = "«" + Contratto.termineRata(Object.assign({}, d, { giorno_pagamento: Number(gp.value) || null })) + "»";
    // un locatore societa': niente cedolare
    const societa = d.locatori.some((p) => p.tipo === "giuridica"), ced = campo("cedolare");
    if (societa) ced.value = "no";
    ced.disabled = societa;
    modulo.querySelector(".nota-cedolare").hidden = !societa;
    // rata e mensilita' del deposito
    const rata = breve ? (d.canone_mensile_calcolato || null) : d.canone_annuo ? d.canone_annuo / (Number(campo("rate").value) || 12) : null;
    document.getElementById("rata").textContent = rata ? "€ " + Lettere.cifre(rata) : "—";
    const mens = campo("deposito_mensilita");
    if (!mens.dataset.toccato) mens.value = rata && d.deposito.importo ? String(Math.round((d.deposito.importo / rata) * 100) / 100).replace(".", ",") : "";
    // le parti che compaiono solo quando servono
    modulo.classList.toggle("con-porzione", d.immobile.porzione);
    modulo.classList.toggle("con-bonifico", d.pagamento === "bonifico");
    modulo.classList.toggle("con-altro", d.pagamento === "altro");
    modulo.classList.toggle("senza-cedolare", !d.cedolare);
    modulo.classList.toggle("con-deposito", d.deposito.modo !== "nessuno");
    modulo.classList.toggle("con-fideiussori", d.fideiussori.length > 0);
    // il riepilogo e gli avvisi
    const nome = (p) => p.tipo === "giuridica" ? p.denominazione : p.cognome;
    const loc = d.locatori.map(nome).filter(Boolean), con = d.conduttori.map(nome).filter(Boolean);
    document.getElementById("riepilogo-contratto").textContent =
      (loc.length || con.length) ? `${loc.join(", ") || "…"} → ${con.join(", ") || "…"}${rata ? " · € " + Lettere.cifre(rata) + " al mese" : ""}` : "";
    const avvisi = [];
    modulo.querySelectorAll(".persona").forEach((fs) => {
      const cf = fs.querySelector('[data-campo="cf"]').value.trim();
      if (cf && !cfValido(cf)) avvisi.push(`${fs.querySelector(".titolo-persona").textContent}: codice fiscale o partita IVA non valido.`);
    });
    if (!d.decorrenza) avvisi.push("Manca la decorrenza: nel contratto resterà una riga da compilare.");
    if (!d.canone_annuo && !breve && !comodato) avvisi.push("Manca il canone annuo.");
    if (comodato && d.durata_comodato === "determinata" && !d.scadenza) avvisi.push("Comodato a tempo determinato: manca la data di fine.");
    if (comodato && /padre|madre|figli|genitor/i.test(d.parentela))
      avvisi.push("Comodato a genitori o figli: registrato, può dare la riduzione del 50% della base imponibile IMU, se ricorrono i requisiti di legge (verificali prima della firma).");
    if (d.immobile.porzione && !d.immobile.regolazione) avvisi.push("Porzione di immobile: manca come ne è regolato l'utilizzo.");
    if (d.fideiussori.length && !d.fideiussione_importo) avvisi.push("Fideiussori: manca la somma garantita.");
    if (breve) {
      const mesi = d.durata_numero, giorni = d.durata_giorni;
      if (!mesi && !giorni) avvisi.push("Transitorio: manca la durata.");
      if (mesi > 18 || (mesi === 18 && giorni > 0)) avvisi.push("Transitorio: la durata non può superare i 18 mesi.");
      if (giorni >= 30) avvisi.push("Transitorio: 30 giorni o più sono un mese: aggiungilo ai mesi.");
      if (d.tipo === "transitorio" && !mesi && giorni && giorni <= 30) avvisi.push("Transitorio fino a 30 giorni: lo schema dell'accordo esclude per questi contratti alcune clausole; verifica il testo prima della firma.");
      if (d.canone_modo === "totale") {
        const k = Contratto.canoneTransitorio(d);
        if (!d.canone_totale) avvisi.push("Manca il canone totale.");
        else if (k.scarto) avvisi.push(`Il totale non si divide in rate uguali: ${k.mesi} rate da € ${Lettere.cifre(k.mensile)} fanno € ${Lettere.cifre(k.totale)}, € ${Lettere.cifre(Math.abs(k.scarto))} ${k.scarto > 0 ? "in meno" : "in più"}. Correggi il totale, oppure indica il canone al mese.`);
      } else if (!d.canone_mensile) avvisi.push("Manca il canone mensile.");
      if (d.tipo === "transitorio" && !d.motivo) avvisi.push("Transitorio: manca il motivo della transitorietà.");
      if (d.tipo === "transitorio" && d.esigenza_di === "parti" && !d.assistenza_conduttore.organizzazione) avvisi.push("Esigenza concordata dalle parti: manca l'organizzazione che assiste il conduttore.");
      if (d.tipo === "turistico" && !d.abitazione_principale) avvisi.push("Turistico: manca il comune dell'abitazione principale del conduttore.");
    }
    if (d.tipo === "studenti") {
      if (d.durata_mesi < 6 || d.durata_mesi > 36) avvisi.push("Studenti: la durata va da 6 a 36 mesi.");
      if (!d.corso_studi || !d.universita) avvisi.push("Studenti: mancano il corso di studi o l'università.");
      const mens = numero(campo("deposito_mensilita").value);     // appena ricalcolate qui sopra
      if (d.deposito.modo !== "nessuno" && mens && mens > 2) avvisi.push("Studenti: il deposito cauzionale non può superare le due mensilità.");
    }
    document.getElementById("avvisi-contratto").innerHTML = avvisi.map((a) => `<li>${a}</li>`).join("");
  }

  // ------------------------------------------------------------ eventi

  modulo.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.campo) { t.dataset.toccato = "1"; delete t.dataset.auto; }
    if (t.dataset.campo === "cf") { delete t.dataset.toccato; controllaCf(t.closest(".persona"), t); }
    if (t.dataset.campo === "rappresentante.cf") { delete t.dataset.toccato; controllaAmministratore(t.closest(".persona"), t); }
    if (t.name === "giorno_pagamento") { if (t.value.trim()) t.dataset.toccato = "1"; else delete t.dataset.toccato; }
    if (t.name === "rate") { if (t.value.trim()) t.dataset.toccato = "1"; else delete t.dataset.toccato; }
    if (t.name === "preavviso_mesi") t.dataset.toccato = "1";
    if (t.name === "scadenza") t.dataset.toccato = "1";
    if (t.name === "deposito_mensilita") { if (t.value.trim()) t.dataset.toccato = "1"; else delete t.dataset.toccato; }
    aggiorna();
  });
  modulo.addEventListener("change", (e) => {
    if (e.target.name === "preavviso_mesi") e.target.dataset.toccato = "1";
    aggiorna();
  });
  modulo.addEventListener("click", (e) => {
    const agg = e.target.closest("[data-aggiungi]");
    if (agg) {
      if (agg.dataset.aggiungi === "catasto") aggiungiUnita().querySelector("input").focus();
      else aggiungiPersona(agg.dataset.aggiungi).querySelector('[data-campo="cf"]').focus();
      aggiorna(); return;
    }
    const togli = e.target.closest(".togli");
    if (togli) { (togli.closest(".persona") || togli.closest(".unita-catastale")).remove(); numeraPersone(); aggiorna(); return; }
    const rip = e.target.closest('[data-ripristina="scadenza"], [data-ripristina="giorno_pagamento"]');
    if (rip) { delete campo(rip.dataset.ripristina).dataset.toccato; aggiorna(); }
  });

  const stato = document.getElementById("contratto-stato");
  // ------------------------------------------------------------ PDF e Word

  let risorse = null;
  async function prepara() {
    if (!accordo) throw new Error("accordo non ancora caricato");
    if (!risorse) {
      const prendi = (f) => fetch(f).then((r) => { if (!r.ok) throw new Error("file mancante: " + f); return r.arrayBuffer(); });
      const [regolare, grassetto, logo, icona, sansRegolare, sansGrassetto] = await Promise.all([prendi("assets/canone/caratteri/LiberationSerif-Regular.ttf"),
        prendi("assets/canone/caratteri/LiberationSerif-Bold.ttf"), prendi("assets/canone/logo-locaonline.png"),
        prendi("assets/canone/icona-locaonline.png"), prendi("assets/canone/caratteri/Carlito-Regular.ttf"),
        prendi("assets/canone/caratteri/Carlito-Bold.ttf")]);
      risorse = { regolare, grassetto, logo, icona, sansRegolare, sansGrassetto };
    }
    return Contratto.genera(leggi(), accordo, {});
  }
  const nomeFile = (est) => {
    const d = leggi(), nome = (p) => (p.tipo === "giuridica" ? p.denominazione : p.cognome) || "";
    return ["Contratto", d.locatori.map(nome).filter(Boolean).join(" "), d.conduttori.map(nome).filter(Boolean).join(" ")]
      .filter(Boolean).join(" - ").replace(/[\\/:*?"<>|]/g, "") + "." + est;
  };
  async function pdf() {
    if (window.caricaLibrerie) await window.caricaLibrerie("pdf");
    if (!window.PDFLib || !window.fontkit) throw new Error("la stampa non è ancora pronta, riprova tra un attimo");
    const blocchi = await prepara();
    const byte = await PdfContratto.crea({ PDFLib: window.PDFLib, fontkit: window.fontkit, ...risorse }, blocchi);
    return new Blob([byte], { type: "application/pdf" });
  }
  const scarica = (blob, nome) => {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  document.getElementById("contratto-scarica-pdf").addEventListener("click", async () => {
    traccia("contratto_pdf");
    try { scarica(await pdf(), nomeFile("pdf")); } catch (e) { stato.textContent = "PDF non creato: " + e.message; }
  });
  document.getElementById("contratto-apri-pdf").addEventListener("click", async () => {
    traccia("contratto_stampa");
    const finestra = window.open("", "_blank");
    try { const url = URL.createObjectURL(await pdf()); if (finestra) finestra.location.href = url; else location.href = url; }
    catch (e) { if (finestra) finestra.close(); stato.textContent = "PDF non creato: " + e.message; }
  });
  document.getElementById("scarica-word").addEventListener("click", async () => {
    traccia("contratto_word");
    try {
      if (window.caricaLibrerie) await window.caricaLibrerie("word");
      if (!window.docx) throw new Error("il Word non è ancora pronto, riprova tra un attimo");
      const blocchi = await prepara();
      // le misure vere del Times New Roman (Liberation Serif ha le stesse), per l'intestazione
      if (!risorse.misura && window.fontkit) {
        const fr = window.fontkit.create(new Uint8Array(risorse.regolare)), fb = window.fontkit.create(new Uint8Array(risorse.grassetto));
        risorse.misura = (testo, s, g) => { const f = g ? fb : fr; return f.layout(testo).glyphs.reduce((w, x) => w + x.advanceWidth, 0) / f.unitsPerEm * s; };
      }
      scarica(await WordContratto.crea(window.docx, new Uint8Array(risorse.logo), blocchi, risorse.misura,
        new Uint8Array(risorse.icona)), nomeFile("docx"));
    } catch (e) { stato.textContent = "Word non creato: " + e.message; }
  });

  // ------------------------------------------------------------ avvio
  // L'accordo lo carica la pagina (pagina-canone.js) con l'evento "accordo";
  // il Comune dell'immobile e il luogo della firma si propongono da lì.

  function traccia(evento) {
    try { if (window.gtag) gtag("event", evento, { tipo: val("tipo"), comune: accordo ? accordo.accordo.comune : "" }); } catch (e) { /* mai bloccare */ }
  }

  window.addEventListener("accordo", (e) => {
    const prima = accordo ? accordo.accordo.comune : "";
    accordo = e.detail;
    for (const n of ["comune", "firma_luogo"]) if (!val(n) || val(n) === prima) campo(n).value = accordo.accordo.comune || "";
    aggiorna();
  });

  /** Dalla scheda del canone: tipo, durata, canone, indirizzo e catasto. */
  function daScheda(s, r) {
    if (!s) return;
    campo("tipo").value = s.tipo;
    if (s.tipo === "agevolato") campo("durata_anni").value = String(s.durata_anni || 3);
    const mensile = r.canone_pattuito || null;
    const it = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
    if (mensile) {
      if (s.tipo === "transitorio") { campo("canone_modo").value = "mensile"; campo("canone_mensile").value = it(mensile); }
      else campo("canone_annuo").value = it(mensile * 12);
    }
    // "Via delle Sette Chiese 100" -> via e numero civico
    if (s.indirizzo && !val("via")) {
      const m = s.indirizzo.trim().match(/^(.*?)[\s,]+(?:n\.?\s*)?(\d+[a-zA-Z]?(?:\/\d+)?)$/);
      campo("via").value = m ? m[1] : s.indirizzo.trim();
      if (m && !val("civico")) campo("civico").value = m[2];
    }
    const c = s.catasto || {}, u = document.querySelector("#unita-catastali .unita-catastale");
    if (u) [["foglio", c.foglio], ["particella", c.particella], ["sub", c.subalterno]].forEach(([k, v]) => {
      const f = u.querySelector(`[data-c="${k}"]`); if (v && f && !f.value.trim()) f.value = v;
    });
    if (s.maggiorazioni && Number(String(s.maggiorazioni.ammobiliato || "").replace(",", ".")) > 0 && val("ammobiliato") === "no") campo("ammobiliato").value = "si";
    aggiorna();
    return !!mensile;
  }

  aggiungiPersona("locatori");
  aggiungiPersona("conduttori");
  aggiungiUnita({ descrizione: "" });
  numeraPersone(); aggiorna();
  /** Rimette nel modulo un contratto salvato: prima svuota tutto. */
  function ricarica(d) {
    modulo.reset();
    modulo.querySelectorAll(".persone").forEach((box) => { box.innerHTML = ""; });
    document.getElementById("unita-catastali").innerHTML = "";
    modulo.querySelectorAll("[data-toccato]").forEach((c) => delete c.dataset.toccato);
    carica(d || {});
    if (!modulo.querySelector('.persone[data-ruolo="locatori"] .persona')) aggiungiPersona("locatori");
    if (!modulo.querySelector('.persone[data-ruolo="conduttori"] .persona')) aggiungiPersona("conduttori");
    if (!document.querySelector("#unita-catastali .unita-catastale")) aggiungiUnita({ descrizione: "" });
    numeraPersone(); aggiorna();
  }

  /** Un titolo per l'elenco della dashboard: tipo, locatori e conduttori. */
  function titolo() {
    const d = leggi(), nome = (p) => (p.tipo === "giuridica" ? p.denominazione : p.cognome) || "";
    const tipo = (Contratto.MODELLI[d.tipo] || {}).nome || "Contratto";
    const loc = d.locatori.map(nome).filter(Boolean).join(", "), con = d.conduttori.map(nome).filter(Boolean).join(", ");
    return [tipo, (loc || con) ? `${loc || "…"} → ${con || "…"}` : "", d.immobile.via].filter(Boolean).join(" · ");
  }

  window.ModuloContratto = { daScheda, leggi, ricarica, titolo };
})();
