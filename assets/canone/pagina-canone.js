/*
 * La pagina del canone concordato (canone-concordato.html): sceglie il
 * comune, carica il suo accordo e lo passa alla scheda (scheda.js) e al
 * contratto (modulo-contratto.js) con l'evento "accordo"; gestisce i due
 * passi e porta il canone dalla scheda al contratto.
 *
 * Gli accordi stanno in accordi/: indice.json elenca i comuni, ogni accordo
 * e' un file a se'. Per un comune nuovo basta aggiungere il file e la riga
 * nell'indice.
 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------ librerie solo quando servono
  // pdf-lib e fontkit (PDF) e docx (Word) pesano circa 2 MB: si scaricano al
  // primo PDF o Word, oppure in anticipo appena si inizia a compilare.
  const LIBRERIE = {
    "pdf-lib": "assets/canone/lib/pdf-lib.min.js",
    fontkit: "assets/canone/lib/fontkit.umd.min.js",
    docx: "assets/canone/lib/docx.iife.js",
  };
  const caricate = {};
  function script(nome) {
    if (!caricate[nome]) caricate[nome] = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = LIBRERIE[nome]; s.onload = ok;
      s.onerror = () => { delete caricate[nome]; ko(new Error("connessione assente, riprova")); };
      document.head.appendChild(s);
    });
    return caricate[nome];
  }
  window.caricaLibrerie = (cosa) => Promise.all(
    (cosa === "word" ? ["fontkit", "docx"] : ["pdf-lib", "fontkit"]).map(script));
  let anticipo = false;
  const inAnticipo = () => {
    if (anticipo) return;
    anticipo = true;
    window.caricaLibrerie("pdf").catch(() => {});
  };

  // ------------------------------------------------------------ accordi
  const sceltaComune = $("comune");
  let indice = null, attuale = null;      // attuale: il codice dell'accordo caricato

  /** "del 3 agosto", ma "dell'11 novembre" e "dell'8 giugno". */
  const del_ = (d) => (/^(8|11)\b/.test(d) ? `dell'${d}` : `del ${d}`);

  async function caricaAccordo(codice) {
    const voce = indice.comuni.find((c) => c.accordo === codice);
    $("accordo-in-uso").textContent = "Caricamento dell'accordo…";
    try {
      const r = await fetch(`accordi/${codice}.json`);
      if (!r.ok) throw new Error(r.status);
      const accordo = await r.json();
      const a = accordo.accordo;
      // Roma: data e protocollo del deposito; Milano: data di deposito non pubblicata
      const deposito = a.deposito_data ? `, depositato il ${a.deposito_data}` : "";
      $("accordo-in-uso").textContent = `Accordo ${del_(a.data_testo)}` +
        (a.integrazione_testo ? `, integrato il ${a.integrazione_testo}` : "") + deposito +
        (a.protocollo ? ` (prot. ${a.protocollo})` : "") + ".";
      // il PDF ufficiale, se e' stato caricato (link in accordi/indice.json)
      for (const [id, campo] of [["accordo-pdf", "pdf"], ["accordo-pdf-studenti", "pdf_studenti"]]) {
        const link = $(id);
        if (voce && voce[campo]) { link.href = voce[campo]; link.hidden = false; } else link.hidden = true;
      }
      $("fonte-accordo").textContent =
        `${a.titolo} ${del_(a.data_testo)}` + (a.integrazione_testo ? `, integrato il ${a.integrazione_testo}` : "") +
        deposito + (a.protocollo ? ` con prot. ${a.protocollo}` : "") +
        (a.ufficio ? ` (${a.ufficio})` : "") + (voce && voce.zone ? `: ${voce.zone} zone.` : ".");
      avvisoValidita(a);
      attuale = codice;
      if (document.activeElement !== $("comune-cerca")) mostraScelto();
      window.dispatchEvent(new CustomEvent("accordo", { detail: accordo }));
    } catch (e) {
      $("accordo-in-uso").textContent = "Accordo non caricato: controlla la connessione e ricarica la pagina.";
    }
  }

  /** Un accordo oltre la sua validita' (per Roma tre anni dal deposito)
   *  resta in vigore fino al nuovo, ma le fasce vanno rivalutate con
   *  l'ISTAT: la pagina usa i valori originali, quindi lo dice. */
  function avvisoValidita(a) {
    const box = $("avviso-validita");
    const oggi = new Date().toISOString().slice(0, 10);
    if (!a.valido_fino && a.avviso_validita) { box.innerHTML = a.avviso_validita; box.hidden = false; return; }
    if (!a.valido_fino || oggi <= a.valido_fino) { box.hidden = true; return; }
    const [aa, mm, gg] = a.valido_fino.split("-");
    box.innerHTML = `<strong>Accordo di ${a.comune} oltre la scadenza (${gg}/${mm}/${aa}).</strong> ` +
      "Resta in vigore finché non viene firmato quello nuovo, ma nel frattempo le fasce di oscillazione " +
      "vanno <strong>rivalutate con la variazione ISTAT</strong>. Qui trovi i valori originali dell'accordo: " +
      "chiedi all'associazione che vidima il contratto quelli aggiornati.";
    box.hidden = false;
  }

  const indicePronto = fetch("accordi/indice.json")
    .then((r) => r.json())
    .then((d) => {
      indice = d;
      const comuni = d.comuni.slice().sort((x, y) => x.comune.localeCompare(y.comune, "it"));
      sceltaComune.innerHTML = comuni.map((c) =>
        `<option value="${c.accordo}">${c.comune}${c.provincia ? " (" + c.provincia + ")" : ""}</option>`).join("");
      // ?comune=roma sceglie il comune dall'indirizzo della pagina
      const voluto = new URLSearchParams(location.search).get("comune");
      const trovato = voluto && comuni.find((c) => c.comune.toLowerCase() === voluto.toLowerCase());
      // senza ?comune= si parte da Roma (la citta' dei clienti), non dalla prima in ordine alfabetico
      const predefinito = comuni.find((c) => c.comune === "Roma") || comuni[0];
      sceltaComune.value = (trovato || predefinito).accordo;
      sceltaComune.dataset.prima = sceltaComune.value;
      return caricaAccordo(sceltaComune.value);
    })
    .catch(() => { $("accordo-in-uso").textContent = "Elenco dei comuni non caricato: ricarica la pagina."; });

  sceltaComune.addEventListener("change", () => {
    if (modificato && !confirm("Cambiando comune la scheda del canone riparte da capo. Continuare?")) {
      sceltaComune.value = sceltaComune.dataset.prima || sceltaComune.value;
      return;
    }
    sceltaComune.dataset.prima = sceltaComune.value;
    caricaAccordo(sceltaComune.value);
  });
  sceltaComune.addEventListener("focus", () => { sceltaComune.dataset.prima = sceltaComune.value; });

  // Il comune si scrive: un campo con i suggerimenti sotto. L'elenco #comune
  // resta, nascosto: tiene la scelta e fa partire il caricamento ("change").
  const cerca = $("comune-cerca"), trovati = $("comuni-trovati");
  const norma = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const etichetta = (c) => `${c.comune}${c.provincia ? " (" + c.provincia + ")" : ""}`;
  const mostraScelto = () => {
    const c = indice && indice.comuni.find((x) => x.accordo === sceltaComune.value);
    cerca.value = c ? etichetta(c) : "";
  };
  const chiudi = () => { trovati.hidden = true; trovati.innerHTML = ""; cerca.setAttribute("aria-expanded", "false"); };
  function suggerisci() {
    if (!indice) return;
    // finche' nel campo c'e' il comune gia' scelto, si vedono tutti
    const scelto = indice.comuni.find((x) => x.accordo === sceltaComune.value);
    const q = scelto && cerca.value === etichetta(scelto) ? "" : norma(cerca.value);
    const tutti = indice.comuni.slice().sort((x, y) => x.comune.localeCompare(y.comune, "it"));
    // prima i comuni che cominciano con quanto scritto, poi quelli che lo contengono
    // prima i comuni che cominciano con quanto scritto; da 3 lettere anche quelli che lo contengono ("reggio")
    const inizio = tutti.filter((c) => norma(c.comune).startsWith(q));
    const lista = !q ? tutti : q.length < 3 ? inizio : [...inizio, ...tutti.filter((c) => !inizio.includes(c) && norma(etichetta(c)).includes(q))];
    trovati.innerHTML = lista.length
      ? lista.slice(0, 10).map((c) => `<button type="button" role="option" data-accordo="${c.accordo}">${etichetta(c)}<small>accordo del ${c.sottoscritto}</small></button>`).join("")
      : '<p class="nessuna">Comune non ancora disponibile: <a href="#richiesta" class="text-[#2E7CF6] underline">chiedici di aggiungerlo</a>.</p>';
    trovati.hidden = false;
    cerca.setAttribute("aria-expanded", "true");
  }
  function scegli(accordo) {
    chiudi();
    if (accordo !== sceltaComune.value) {
      sceltaComune.dataset.prima = sceltaComune.value;
      sceltaComune.value = accordo;
      sceltaComune.dispatchEvent(new Event("change"));
    }
    mostraScelto();          // se il cambio e' stato annullato, torna il comune di prima
  }
  cerca.addEventListener("focus", () => { cerca.select(); suggerisci(); });
  cerca.addEventListener("input", suggerisci);
  cerca.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); const primo = trovati.querySelector("[data-accordo]"); if (primo) scegli(primo.dataset.accordo); }
    else if (e.key === "Escape") { chiudi(); mostraScelto(); cerca.blur(); }
  });
  trovati.addEventListener("mousedown", (e) => e.preventDefault());   // il clic arriva prima che il campo perda il fuoco
  trovati.addEventListener("click", (e) => { const b = e.target.closest("[data-accordo]"); if (b) scegli(b.dataset.accordo); });
  cerca.addEventListener("blur", () => setTimeout(() => { chiudi(); mostraScelto(); }, 150));

  // ------------------------------------------------------------ i due passi
  const passi = { scheda: [$("tab-scheda"), $("pannello-scheda")], contratto: [$("tab-contratto"), $("pannello-contratto")] };
  function mostra(quale, scorri = true) {
    for (const [nome, [tab, pannello]] of Object.entries(passi)) {
      const attivo = nome === quale;
      tab.setAttribute("aria-selected", attivo ? "true" : "false");
      pannello.hidden = !attivo;
    }
    // in cima ai due passi, sotto l'intestazione fissa del sito
    if (scorri) window.scrollTo({ top: $("tab-scheda").getBoundingClientRect().top + window.scrollY - 80 });
    inAnticipo();
    try { if (window.gtag) gtag("event", "canone_passo", { passo: quale }); } catch (e) { /* mai bloccare */ }
  }
  $("tab-scheda").addEventListener("click", () => mostra("scheda", false));
  $("tab-contratto").addEventListener("click", () => mostra("contratto", false));

  // dalla scheda al contratto: tipo, durata, canone pattuito, indirizzo, catasto
  $("usa-nel-contratto").addEventListener("click", () => {
    const u = window.SchedaCanone && window.SchedaCanone.ultimo();
    mostra("contratto");
    if (!u || !window.ModuloContratto) return;
    const conCanone = window.ModuloContratto.daScheda(u.scheda, u.r);
    $("contratto-stato").textContent = conCanone ? ""
      : "Canone non riportato: scrivilo qui sotto, o come «pattuito» nella scheda.";
  });

  // ------------------------------------------------------------ uscita
  // I dati non si salvano: prima di chiudere la pagina, un avviso.
  let modificato = false;
  // tutte le schede (Roma e le citta' con una scheda propria: form con id "scheda-…") e il contratto
  for (const f of document.querySelectorAll('form[id^="scheda-"], #modulo-contratto')) {
    f.addEventListener("input", () => { modificato = true; inAnticipo(); });
  }
  window.addEventListener("beforeunload", (e) => { if (modificato) { e.preventDefault(); e.returnValue = ""; } });

  // Per il salvataggio (salva-canone.js): scegliere l'accordo di un lavoro
  // salvato, passare da un passo all'altro, dire che e' tutto salvato.
  window.PaginaCanone = {
    async scegliAccordo(codice) {
      await indicePronto;
      if (!indice || !indice.comuni.some((c) => c.accordo === codice)) throw new Error("accordo non più disponibile: " + codice);
      sceltaComune.value = codice;
      sceltaComune.dataset.prima = codice;
      // gia' caricato: non si ricarica, altrimenti la scheda ripartirebbe da capo
      if (attuale !== codice) await caricaAccordo(codice);
    },
    mostra: (quale) => mostra(quale),
    passo: () => (passi.contratto[1].hidden ? "scheda" : "contratto"),
    segnaSalvato: () => { modificato = false; },
  };
})();
