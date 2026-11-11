/*
 * La scheda del canone di Bologna in PDF: l'allegato 14 dell'Accordo
 * metropolitano (depositato il 28/03/2024), "Attestazione bilaterale di
 * rispondenza ex D.M. 16/01/2017", compilata con i dati della scheda. I dati
 * delle organizzazioni e della registrazione restano in bianco. Una pagina A4.
 *
 *   StampaBologna.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                         accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaBologna = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 40, DX = 555;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));
  const data = (s) => String(s || "").replace(/\./g, "/");

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Bologna - Attestazione bilaterale di rispondenza");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const p = doc.addPage([L, H]);
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const SZ = 8.6;
    const A = accordo.accordo, dep = data(A.deposito_data), vigore = "01/04/2024", firma = "27/03/2024";

    /** Una riga di testo fisso e campi sottolineati (blu il valore). */
    const riga = (a, pezzi, x0 = SX + 4, sz = SZ) => {
      // se la riga non sta nel riquadro: prima si accorciano i campi, poi il carattere
      const fisso = (z) => pezzi.reduce((t, pz) => t + (typeof pz === "string" ? largo(pz, reg, z) : 0), 0);
      const campi = pezzi.reduce((t, pz) => t + (typeof pz === "string" ? 0 : pz.w), 0), posto = DX - 4 - x0;
      if (fisso(sz) + campi > posto) {
        const k = Math.max(0.45, (posto - fisso(sz)) / campi);
        // un campo con un valore resta largo almeno quanto il valore
        pezzi = pezzi.map((pz) => (typeof pz === "string" ? pz : { ...pz, w: Math.max(pz.w * k, pz.v ? largo(String(pz.v), reg, sz) + 5 : 0) }));
        const campi2 = pezzi.reduce((t, pz) => t + (typeof pz === "string" ? 0 : pz.w), 0);
        while (fisso(sz) + campi2 > posto && sz > 6.5) sz -= 0.2;
      }
      let x = x0;
      for (const pz of pezzi) {
        if (typeof pz === "string") { p.drawText(pz, { x, y: Y(a), size: sz, font: reg, color: NERO }); x += largo(pz, reg, sz); continue; }
        p.drawLine({ start: { x, y: Y(a) - 1.5 }, end: { x: x + pz.w, y: Y(a) - 1.5 }, thickness: 0.5, color: NERO });
        const val = pz.v === undefined || pz.v === null ? "" : String(pz.v);
        if (val) { let t = val; while (t && largo(t, reg, sz) > pz.w - 2) t = t.slice(0, -1); p.drawText(t, { x: x + 2, y: Y(a) + 0.5, size: sz, font: reg, color: DATO }); }
        x += pz.w;
      }
      return x;
    };
    const centro = (t, a, f = reg, sz = 9.5) => p.drawText(t, { x: (L - largo(t, f, sz)) / 2, y: Y(a), size: sz, font: f, color: NERO });
    const scatola = (a1, a2) => p.drawRectangle({ x: SX, y: Y(a2), width: DX - SX, height: a2 - a1, borderColor: NERO, borderWidth: 0.8 });
    const linea = (a) => p.drawLine({ start: { x: SX, y: Y(a) }, end: { x: DX, y: Y(a) }, thickness: 0.8, color: NERO });

    // ------------------------------------------------------------ premesse
    scatola(46, 538);
    centro("ATTESTAZIONE BILATERALE DI RISPONDENZA EX D.M. 16/01/2017", 58);
    let a = 75; const P = 16;
    riga(a, ["L'organizzazione ", { w: 60 }, ", in persona di ", { w: 90 }, ", e l'Organizzazione ", { w: 80 }, ", in persona di ", { w: 90 }, ", firmatarie"]); a += P;
    riga(a, ["dell'accordo territoriale per la Città Metropolitana Bolognese per il Comune di ", { w: 56, v: "BOLOGNA" }, " depositato il ", { w: 56, v: dep }, " ed in vigore dal ", { w: 56, v: vigore }]); a += P;
    centro("premesso che:", a, reg, SZ); a += P;
    riga(a, ["I Sig./ri ", { w: 150, v: s.locatore }, " C.F. ", { w: 120, v: (s.locatore_cf || "").toUpperCase() }, " residente a ", { w: 120 }, " e"]); a += P;
    riga(a, [{ w: 130 }, " C.F. ", { w: 110 }, " residente a ", { w: 110 }, ", altri proprietari intervenuti C.F.:"]); a += P;
    riga(a, [{ w: 90 }, ", nella loro qualità di locatori degli immobili/porzione di immobili siti a BOLOGNA, in ", { w: 128, v: s.indirizzo }, ", identificati"]); a += P;
    riga(a, ["al FG.", { w: 40, v: s.foglio }, " / ", { w: 40, v: s.particella }, " / ", { w: 34, v: s.subalterno }, " / ", { w: 34 }, " RC. ", { w: 46 }, " ed al FG.", { w: 34 }, " / ", { w: 34 }, " / ", { w: 30 }, " / ", { w: 30 }, " RC. ", { w: 34 }]); a += P;
    riga(a, [{ w: 50 }, " hanno stipulato un contratto di locazione con i Sig.ri ", { w: 150, v: s.conduttore }, ", C.F. ", { w: 110, v: (s.conduttore_cf || "").toUpperCase() }, ", e"]); a += P;
    riga(a, [{ w: 110 }, ", C.F. ", { w: 110 }, " registrato il ", { w: 44 }, " al n. ", { w: 34 }, " serie ", { w: 20 }, " presso l'Agenzia delle Entrate di"]); a += P;
    riga(a, [{ w: 44 }, " identificativo telematico ", { w: 70 }, " oppure in corso di registrazione essendo i termini non ancora scaduti; hanno presentato richiesta per"]); a += P;
    riga(a, ["l'attestazione ex D.M. 16/01/2017, dichiarando sotto la loro responsabilità, i seguenti elementi:"]); a += 7;

    // ------------------------------------------------------------ parametri e calcolo
    linea(a); a += 11;
    p.drawText("PARAMETRI", { x: SX + 4, y: Y(a), size: SZ, font: reg, color: NERO });
    p.drawText("CALCOLO DEL CANONE", { x: 330, y: Y(a), size: SZ, font: reg, color: NERO }); a += 4;
    linea(a); a += 11;
    const passo = 11.3, inizio = a;
    const BREVI = ["Tipologia A1-A2-A3-A7-A8-A9", "Autorimessa singola", "Posto auto esclusivo accatastato",
      "PT, PR, 1°piano o superiori con ascensore, piano seminterrato con area esclusiva collegata", "Riscaldamento autonomo o con contacalorie",
      "Porta blindata o sistema di allarme o cancello di sicurezza", "Doppi vetri 80% finestre", "Condizionamento", "Area verde condominiale",
      "Area verde esclusiva", "Doppio servizio", "Interventi di risparmio energetico", "Cantina o soffitta", "Cortile con possibilità di parcheggio",
      "Balcone o terrazzo o lastrico solare", "Anno costruzione alloggio post 1/1/2013", "Impianto fotovoltaico o pannelli solari", "Superamento barriere architettoniche"];
    BREVI.forEach((t, i) => {
      const si = !!(s.elementi || [])[i];
      p.drawText(si ? "1" : "0", { x: SX + 4, y: Y(inizio + i * passo), size: SZ, font: si ? bold : reg, color: si ? DATO : NERO });
      p.drawText(t, { x: SX + 12, y: Y(inizio + i * passo), size: SZ, font: reg, color: NERO });
    });
    const sup = r.superficie, voce = (k) => (sup ? sup.righe.find((x) => x.chiave === k) : null);
    const perc = (k) => { const m = r.maggiorazioni.filter((x) => x.chiave === k).reduce((t, x) => t + x.percento, 0); return `${m} %`; };
    const energia = (cls) => (s.energia === cls ? perc("energia") : "0 %");
    const mqv = (k) => { const x = voce(k); return x && x.mq ? v(x.mq) : ""; };
    const durata = s.tipo === "agevolato" ? `${s.durata_anni || 3}` : "";
    const destra = [
      [r.zona ? (r.zona[0] === "pregio" ? "Pregio" : r.zona[0]) : "", "Zona"], [r.vani ? r.vani[1] : "", "Vani"], [String(r.elementi), "N.elementi di qualità"],
      [r.fascia ? v(r.fascia[1]) : "", "Tariffa massima"], [r.fascia ? v(r.fascia[0]) : "", "Tariffa minima"],
      [perc("pregio"), "Maggiorazione pregio"], [perc("arredo"), "Maggiorazione arredo"], [perc("durata"), "Maggiorazione durata 3+2"],
      [perc("recesso"), "Maggiorazione recesso"], [perc("deposito"), "Maggiorazione deposito"],
      [energia("ab"), "Maggiorazione qualità energetica AB"], [energia("cd"), "Maggiorazione qualità energetica CD"], [`${r.percento} %`, "Totale maggiorazioni"],
      [sup ? v(voce("alloggio").convenzionale) : "", "Mq. Alloggio"], [mqv("autorimessa"), "Mq. Autorimessa"], [mqv("posto_auto"), "Mq. Box/posto auto"],
      [mqv("terrazzo"), "Mq.terrazzo"], [mqv("verde"), "Mq.area verde"], [sup ? v(sup.locata) : "", "Totale superficie convenzionale"],
      [durata ? `${durata} +2` : "", "Durata concordata"], [v(r.canone_minimo), "Canone mensile minimo"], [v(r.canone_massimo), "Canone mensile massimo"],
      [r.canone_pattuito !== null ? v(r.canone_pattuito) : "", "Canone mensile concordato"]];
    destra.forEach(([val, et], i) => {
      const aa = inizio + i * passo;
      if (val) p.drawText(val, { x: 404 - largo(val, reg, SZ), y: Y(aa), size: SZ, font: reg, color: DATO });
      p.drawText(et, { x: 410, y: Y(aa), size: SZ, font: reg, color: NERO });
    });
    a = inizio + destra.length * passo - 4;
    linea(a); a += 12;
    riga(a, ["Sig.ri ", { w: 120 }, " e ", { w: 120 }, " Firma ", { w: 140 }], SX + 80); a += 3;

    // ------------------------------------------------------------ presa visione e attestazione
    scatola(a, a + 34); a += 13;
    riga(a, ["I Sig.ri ", { w: 110 }, " e ", { w: 110 }, " dichiarano di aver preso visione e di essere stato informato sul contenuto"]); a += 14;
    riga(a, ["dell'Accordo territoriale sottoscritto il ", { w: 56, v: firma }, " ed in vigore dal ", { w: 56, v: vigore }, ". Firma ", { w: 140 }]); a += 15;
    const t0 = a;
    a += 13;
    riga(a, ["Tutto ciò premesso, le Organizzazioni ", { w: 60 }, " e ", { w: 120 }, ", come sopra rappresentate, sotto la propria responsabilità e sulla"]); a += 13;
    riga(a, ["base degli elementi oggettivi sopra dichiarati, anche ai fini dell'ottenimento di eventuali agevolazioni fiscali, ATTESTANO che i contenuti economici e"]); a += 13;
    riga(a, ["normativi del contratto sopra descritto corrispondono a quanto previsto dall'Accordo territoriale vigente per la Città Metropolitana Bolognese per il"]); a += 13;
    riga(a, ["Comune di ", { w: 56, v: "BOLOGNA" }, " depositato in data ", { w: 56, v: dep }, " ed in vigore dal ", { w: 56, v: vigore }, "."]); a += 5;
    linea(a); a += 11;
    p.drawText("p. l'Organizzazione", { x: SX + 4, y: Y(a), size: SZ, font: reg, color: NERO });
    p.drawText("p. l'Organizzazione", { x: 300, y: Y(a), size: SZ, font: reg, color: NERO }); a += 4;
    linea(a); a += 11;
    riga(a, ["I sottoscritti ", { w: 120 }, " e ", { w: 120 }, " autorizzano il trattamento dei dati personali ai sensi del Decreto"]); a += 10;
    riga(a, ["Legislativo 30 giugno 2003, n.196 (Codice in materia di protezione dei dati personali)."]); a += 4;
    linea(a); a += 11;
    p.drawText("data", { x: SX + 4, y: Y(a), size: SZ, font: reg, color: NERO });
    p.drawText("Firma", { x: 280, y: Y(a), size: SZ, font: reg, color: NERO }); a += 4;
    scatola(t0, a);
    a += 12;

    // ------------------------------------------------------------ porzione
    const porz = sup && sup.quota !== null;
    scatola(a, a + 28); a += 11;
    riga(a, ["A superficie conduttore Mq. ", { w: 34, v: porz ? s.mq_conduttore : "" }, " - B superficie locatore o altri Mq. ", { w: 34, v: porz ? s.mq_altri : "" },
      " - C superficie delle parti comuni Mq. ", { w: 34, v: porz ? s.mq_comuni : "" }]); a += 12;
    riga(a, ["Quota percentuale superficie conduttore ", { w: 40, v: porz ? v(sup.quota * 100) + " %" : sup ? "100,00 %" : "" },
      " e superficie convenzionale a disposizione conduttore Mq. ", { w: 50, v: sup ? v(sup.locata) : "" }]); a += 20;

    // il riepilogo del calcolo, in grigio: non fa parte del modello
    if (r.fascia && r.canone_massimo !== null) {
      const g = (t) => { p.drawText(t, { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO }); a += 9.5; };
      g("Calcolo di LocaOnLine (non fa parte del modello):");
      g(`${r.zona[1]}, ${r.vani[1]}, fascia ${r.fascia_nome} (${r.elementi} parametri): da € ${v(r.fascia[0])} a € ${v(r.fascia[1])} al mq l'anno` +
        (r.percento ? `; maggiorazioni +${r.percento}%: da € ${v(r.fascia_magg[0])} a € ${v(r.fascia_magg[1])}` : "") + ".");
      g(`Superficie convenzionale ${v(sup.locata)} mq; valore applicato € ${v(r.valore)} al mq l'anno = € ${v(r.canone)} al mese (minimo € ${v(r.canone_minimo)}, massimo € ${v(r.canone_massimo)}).`);
    }
    const t = `Allegato 14 dell'Accordo applicabile nel territorio metropolitano di Bologna (depositato il ${dep}, P.G. 20926), compilato con LocaOnLine`;
    p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    if (Marchio) Marchio.disegna(doc, ris.PDFLib, p,
      await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }),
      { cx: L / 2, y: 14, campagna: "scheda_canone_bologna" });
    return doc.save();
  }

  return { creaPDF };
});
