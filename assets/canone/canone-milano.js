/*
 * Il calcolo del canone concordato secondo l'Accordo locale per la citta' di
 * Milano del 27 luglio 2023 (con l'integrativo del 20 settembre 2023).
 * Dati in accordi/milano-2023-07-27.json. Nessuna dipendenza: gira nel
 * browser e con Node (prove).
 *
 *   CanoneMilano.calcola(accordo, scheda) -> risultato
 *
 * Come funziona l'accordo (punti 4.1 e 7):
 * - 5 zone, 3 sub-fasce per zona, valori ANNUI in €/mq (Allegato 2);
 * - sub-fascia dagli elementi A, B, C: 3 = tutti gli A, almeno un B e tre C;
 *   2 = tutti gli A e almeno un B; 1 = manca un A (o riscaldamento a stufe,
 *   cioe' A4 assente). Tutti gli A ma nessun B non e' previsto dall'accordo:
 *   sub-fascia 1, come nel calcolatore di Assoedilizia (firmataria);
 * - almeno 5 elementi D: si puo' applicare il massimo della sub-fascia;
 * - superficie catastale (DPR 138/98), accessori con i coefficienti del
 *   modello di attestazione, +10% fra 28 e 50 mq;
 * - correttivi su minimo e massimo: arredato fino a +15%, semi arredato
 *   +8%, durata oltre i 3 anni +3/5/8/10%, classe G -2%; "cumulabili":
 *   moltiplicati fra loro, come nel calcolatore di Assoedilizia;
 * - in alternativa (7.2) la singola stanza a canone mensile forfettario
 *   massimo: zona 2 € 600, 3 € 500, 4 € 450, 5 € 400 (zona 1 esclusa).
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneMilano = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const numero = (x) => {
    if (x === null || x === undefined) return null;
    const s = String(x).trim().replace(/\s/g, "");
    if (!s) return null;
    // "1.234,56" e "1234,56" all'italiana, "1234.56" all'inglese
    const n = Number(/,/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s);
    return Number.isFinite(n) ? n : null;
  };
  const cent = (n) => Math.round(n * 100) / 100;
  const virgola = (n, c = 2) => (n === null || n === undefined ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  const zona = (accordo, codice) => accordo.zone.find((z) => z.codice === String(codice || "")) || null;

  /** Gli anni della maggiorazione di durata: 4, 5, 6 o "oltre 6" (7). */
  const percentualeDurata = (accordo, anni) => {
    const d = accordo.regole.correttivi.durata;
    return d[String(Math.min(7, Number(anni) || 3))] || 0;
  };

  function sottofascia(accordo, el) {
    const conta = {};
    for (const tipo of ["A", "B", "C", "D"]) conta[tipo] = accordo.elementi[tipo].filter(([k]) => !!el[k]).length;
    const tuttiA = conta.A === accordo.elementi.A.length;
    let n = 1, motivo;
    if (!tuttiA) motivo = "manca almeno un elemento di tipo A";
    else if (conta.B >= 1 && conta.C >= 3) { n = 3; motivo = "tutti gli A, almeno un B e tre C"; }
    else if (conta.B >= 1) { n = 2; motivo = "tutti gli A e almeno un B"; }
    else motivo = "tutti gli A ma nessun B";
    return { n, motivo, conta, non_previsto: tuttiA && conta.B === 0 };
  }

  function calcola(accordo, s) {
    const R = accordo.regole, avvisi = [];
    const z = zona(accordo, s.zona);
    const el = s.elementi || {};
    const sf = sottofascia(accordo, el);
    const r = { zona: z, subfascia: sf.n, subfascia_motivo: sf.motivo, conteggi: sf.conta, avvisi,
      modo: s.modo === "stanza" ? "stanza" : "mq", fascia: null, righe: [], totale: null, piccoli: null,
      fattori: [], fattore: 1, fascia_corretta: null, canone_min_annuo: null, canone_max_annuo: null,
      canone_massimo: null, canone_massimo_annuo: null, massimo_con_D: sf.conta.D >= R.elementi_D_per_massimo,
      stanza_massimo: null, canone_pattuito: null, canone_pattuito_annuo: null };

    // ------------------------------------------------ stanza a corpo (7.2)
    const annuo = numero(s.canone_annuo);
    if (r.modo === "stanza") {
      const tutte = accordo.elementi.stanze.every(([k]) => !!(s.stanze || {})[k]);
      if (!z) avvisi.push("Scegli la zona.");
      else if (!R.stanze[z.codice]) avvisi.push(`In zona ${z.codice} il canone forfettario per stanza non è previsto (punto 7.2): usa il calcolo a metro quadro (7.1).`);
      else {
        r.stanza_massimo = R.stanze[z.codice];
        r.canone_massimo = r.stanza_massimo; r.canone_massimo_annuo = r.stanza_massimo * 12;
      }
      if (!tutte) avvisi.push("Per il canone forfettario della stanza servono tutte e tre le caratteristiche indicate (punto 7.2).");
      if (annuo !== null) {
        r.canone_pattuito_annuo = annuo; r.canone_pattuito = cent(annuo / 12);
        if (r.canone_massimo_annuo && annuo > r.canone_massimo_annuo + 0.005)
          avvisi.push(`Il canone convenuto supera il massimo forfettario della stanza (€ ${virgola(r.stanza_massimo)} al mese).`);
      }
      return r;
    }

    // --------------------------------------------------------- superficie
    const sup = s.superfici || {};
    let totale = 0, qualcosa = false;
    for (const riga of R.superficie.righe) {
      if (riga.solo_parziale && !s.parziale) continue;
      const mq = numero(sup[riga.chiave]);
      const conv = mq === null ? null : mq * riga.coeff;
      if (conv !== null) { totale += conv; qualcosa = true; }
      r.righe.push({ chiave: riga.chiave, etichetta: riga.etichetta, coeff: riga.coeff, mq, convenzionale: conv === null ? null : cent(conv) });
    }
    const app = numero(sup.appartamento), P = R.superficie.piccoli;
    if (app !== null && app >= P.da && app <= P.a) {
      r.piccoli = cent(app * P.coeff); totale += app * P.coeff;
    }
    r.righe.push({ chiave: "piccoli", etichetta: P.etichetta, coeff: P.coeff, mq: r.piccoli === null ? null : app, convenzionale: r.piccoli });
    r.totale = qualcosa ? cent(totale) : null;

    // ------------------------------------------------- fascia e correttivi
    if (!z) avvisi.push("Scegli la zona: la trovi dall'indirizzo con i collegamenti qui sopra.");
    else r.fascia = z.fasce[sf.n - 1].slice();
    const C = R.correttivi;
    const aggiungi = (nome, perc) => { if (perc) { r.fattori.push({ nome, percento: perc }); r.fattore *= 1 + perc / 100; } };
    if (s.arredo === "completo") aggiungi("arredato", C.arredato);
    else if (s.arredo === "semi") aggiungi("semi arredato", C.semi_arredato);
    if (s.tipo === "agevolato") {
      const anni = Number(s.durata_anni) || 3;
      aggiungi(anni >= 7 ? "durata oltre 6 anni" : `durata ${anni} anni`, percentualeDurata(accordo, anni));
    }
    if (s.classe_G) aggiungi("classe energetica G", C.classe_G);
    if (r.fascia) {
      r.fascia_corretta = r.fascia.map((x) => cent(x * r.fattore));
      if (r.totale) {
        r.canone_min_annuo = cent(r.totale * r.fascia[0] * r.fattore);
        r.canone_max_annuo = cent(r.totale * r.fascia[1] * r.fattore);
        r.canone_massimo_annuo = r.canone_max_annuo;
        r.canone_massimo = cent(r.canone_max_annuo / 12);
      }
    }

    // -------------------------------------------------------------- avvisi
    if (sf.non_previsto)
      avvisi.push("Ci sono tutti gli elementi A ma nessun elemento B: l'accordo non prevede il caso. La scheda usa la sub-fascia 1 (come il calcolatore di Assoedilizia): fallo confermare dall'associazione.");
    if (r.fascia && !r.massimo_con_D)
      avvisi.push(`Il massimo della sub-fascia si può applicare solo con almeno ${R.elementi_D_per_massimo} elementi di tipo D (qui ${sf.conta.D}): senza, il canone va tenuto sotto il massimo.`);
    if (qualcosa && app === null) avvisi.push("Inserisci la superficie catastale dell'appartamento.");
    if (annuo !== null) {
      r.canone_pattuito_annuo = annuo; r.canone_pattuito = cent(annuo / 12);
      if (r.canone_max_annuo !== null && annuo > r.canone_max_annuo + 0.005)
        avvisi.push(`Il canone convenuto supera il massimo della sub-fascia (€ ${virgola(r.canone_max_annuo)} l'anno).`);
      else if (r.canone_min_annuo !== null && annuo < r.canone_min_annuo - 0.005) {
        const minZona = z && r.totale ? cent(r.totale * z.fasce[0][0] * r.fattore) : null;
        avvisi.push(minZona !== null && annuo < minZona - 0.005
          ? "Il canone è sotto il minimo della zona: è possibile solo con l'assistenza di un'organizzazione della proprietà e di un sindacato degli inquilini (accordo integrativo del 20 settembre 2023)."
          : "Il canone è sotto il minimo della sub-fascia: l'accordo lo consente, se le parti sono d'accordo.");
      }
    }
    return r;
  }

  return { calcola, zona, percentualeDurata, sottofascia, numero, virgola };
});
