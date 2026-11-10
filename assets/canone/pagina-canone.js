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
  let indice = null;

  async function caricaAccordo(codice) {
    const voce = indice.comuni.find((c) => c.accordo === codice);
    $("accordo-in-uso").textContent = "Caricamento dell'accordo…";
    try {
      const r = await fetch(`accordi/${codice}.json`);
      if (!r.ok) throw new Error(r.status);
      const accordo = await r.json();
      const a = accordo.accordo;
      $("accordo-in-uso").textContent =
        `Accordo del ${a.data_testo}, depositato il ${a.deposito_data} (prot. ${a.protocollo}).`;
      $("fonte-accordo").textContent =
        `${a.titolo} del ${a.data_testo}, depositato il ${a.deposito_data} con prot. ${a.protocollo}` +
        (a.ufficio ? ` (${a.ufficio})` : "") + (voce && voce.zone ? `: ${voce.zone} zone.` : ".");
      window.dispatchEvent(new CustomEvent("accordo", { detail: accordo }));
    } catch (e) {
      $("accordo-in-uso").textContent = "Accordo non caricato: controlla la connessione e ricarica la pagina.";
    }
  }

  fetch("accordi/indice.json")
    .then((r) => r.json())
    .then((d) => {
      indice = d;
      const comuni = d.comuni.slice().sort((x, y) => x.comune.localeCompare(y.comune, "it"));
      sceltaComune.innerHTML = comuni.map((c) =>
        `<option value="${c.accordo}">${c.comune}${c.provincia ? " (" + c.provincia + ")" : ""}</option>`).join("");
      // ?comune=roma sceglie il comune dall'indirizzo della pagina
      const voluto = new URLSearchParams(location.search).get("comune");
      const trovato = voluto && comuni.find((c) => c.comune.toLowerCase() === voluto.toLowerCase());
      if (trovato) sceltaComune.value = trovato.accordo;
      caricaAccordo(sceltaComune.value);
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
  for (const id of ["scheda-canone", "modulo-contratto"]) {
    $(id).addEventListener("input", () => { modificato = true; inAnticipo(); });
  }
  window.addEventListener("beforeunload", (e) => { if (modificato) { e.preventDefault(); e.returnValue = ""; } });
})();
