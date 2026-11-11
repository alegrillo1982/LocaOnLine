/*
 * La scheda del canone di Venezia in PDF. L'attestazione dell'accordo
 * (allegato 4) rimanda agli "elementi oggettivi contenuti negli allegati
 * Tab. 2 e scheda calcolo": pagina 1 la Tab. 2 con le caselle segnate,
 * pagina 2 la scheda di calcolo e l'attestazione di rispondenza, con i dati
 * dell'organizzazione in bianco.
 *
 *   StampaVenezia.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                         accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaVenezia = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 56, DX = 540;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Venezia - Tab. 2, scheda calcolo e attestazione");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const Y = (a) => H - a;
    let p;
    const tx = (t, x, a, { f = reg, sz = 10, c = NERO } = {}) => { p.drawText(String(t), { x, y: Y(a), size: sz, font: f, color: c }); return x + largo(t, f, sz); };
    const centro = (t, a, f, sz, sotto) => {
      const x = (L - largo(t, f, sz)) / 2; tx(t, x, a, { f, sz });
      if (sotto) p.drawLine({ start: { x, y: Y(a) - 2 }, end: { x: x + largo(t, f, sz), y: Y(a) - 2 }, thickness: 0.8, color: NERO });
    };
    const aCapo = (t, f, sz, w) => {
      const righe = []; let rr = "";
      for (const pa of String(t).split(" ")) { const pr = rr ? rr + " " + pa : pa; if (largo(pr, f, sz) > w && rr) { righe.push(rr); rr = pa; } else rr = pr; }
      if (rr) righe.push(rr); return righe;
    };
    const riga = (a, pezzi, x0 = SX, sz = 9.6) => {
      let x = x0;
      for (const pz of pezzi) {
        if (typeof pz === "string") { x = tx(pz, x, a, { sz }); continue; }
        p.drawText("…".repeat(Math.max(2, Math.floor(pz.w / largo("…", reg, sz)))), { x, y: Y(a), size: sz, font: reg, color: GRIGIO });
        if (pz.v) { let t = String(pz.v); while (t && largo(t, reg, sz) > pz.w - 2) t = t.slice(0, -1); tx(t, x + 1, a - 2, { sz, c: DATO }); }
        x += pz.w;
      }
    };
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    const marchio = Marchio ? await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }) : null;
    const piede = () => {
      const t = "Tab. 2, scheda calcolo e allegato 4 dell'Accordo territoriale per il Comune di Venezia (integrato il 28/07/2026), compilati con LocaOnLine";
      p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
      if (marchio) Marchio.disegna(doc, ris.PDFLib, p, marchio, { cx: L / 2, y: 14, campagna: "scheda_canone_venezia" });
    };

    // ------------------------------------------------------------ Tab. 2
    p = doc.addPage([L, H]);
    tx("TAB 2", SX, 60, { sz: 12 });
    centro("ELEMENTI OGGETTIVI", 60, reg, 12.5, true);
    centro("PER LA DETERMINAZIONE DELLA SUBFASCIA DI APPARTENENZA", 76, reg, 12.5, true);
    centro("DELL'APPARTAMENTO", 92, reg, 12.5, true);
    let a = 116;
    const titoli = { A: "Elementi di tipo A)", B: "Elementi di tipo B)", C: "Elementi di tipo C)", D: "Elementi di tipo D) (solo per appartamenti situati a Venezia)" };
    for (const g of ["A", "B", "C", "D"]) {
      tx(titoli[g], SX, a, { f: bold, sz: 10 }); a += 14;
      accordo.elementi[g].forEach((t, i) => {
        const si = !!((s.elementi || {})[g] || [])[i];
        const righe = aCapo("- " + t, reg, 9.6, DX - SX - 40);
        righe.forEach((rr, k) => tx(rr, SX + (k ? 8 : 0), a + k * 11.5, { sz: 9.6, c: si ? DATO : NERO, f: si ? bold : reg }));
        p.drawRectangle({ x: DX - 12, y: Y(a) - 1, width: 9, height: 9, borderColor: NERO, borderWidth: 0.8 });
        if (si) tx("X", DX - 10.6, a - 0.2, { f: bold, sz: 9, c: DATO });
        a += 11.5 * righe.length + 3.5;
      });
      a += 3;
    }
    tx("* Per locale cucina si intende anche il locale soggiorno-angolo cottura negli appartamenti con superficie calpestabile inferiore a 70 mq.", SX, a + 4, { sz: 7.8 });
    piede();

    // ------------------------------------------------------------ scheda calcolo e attestazione
    p = doc.addPage([L, H]);
    centro("SCHEDA CALCOLO", 54, bold, 12);
    a = 74;
    const nomi = ["inferiore", "intermedia", "superiore"];
    const sup = r.superficie;
    const voci = [
      ["Zona omogenea", r.zona ? `${r.zona[0]}${s.localita === "lido" ? " (Lido)" : s.localita === "venezia" ? " (Venezia e isole)" : " (terraferma)"}` : ""],
      ["Subfascia (Tab. 3)", r.zona ? `${nomi[r.sub.n]}: da € ${v(r.base[0])} a € ${v(r.base[1])} al mq annui` : ""],
      ...r.correzioni.map((c) => [c.nome, `min x ${v(c.kmin, 2)}  max x ${v(c.kmax, 2)}`]),
      ["Valori al mq annui applicabili", r.fascia ? `da € ${v(r.fascia[0])} a € ${v(r.fascia[1])}` : ""],
      ["Superficie utile / coefficiente K", sup ? `${v(sup.righe[0].mq)} mq x ${v(sup.K, 4)} = ${v(sup.supK)} mq` : ""],
      ["Superfici accessorie (Sup A)", sup ? `${v(sup.supA)} mq` : ""],
      ["Superficie convenzionale (Sup C)", sup ? `${v(sup.totale)} mq` : ""],
      ...(r.arredo ? [["Arredo (sulla sola Sup K)", `+${r.arredo}%`]] : []),
      ...(r.quota !== null ? [["Quota della porzione locata", `${v(r.quota * 100)}%`]] : []),
      ["Valore applicato al mq annuo", r.valore !== null ? `€ ${v(r.valore)}` : ""],
      ["Canone mensile minimo / massimo", r.canone_massimo !== null ? `€ ${v(r.canone_minimo)} / € ${v(r.canone_massimo)}` : ""],
      ["Canone mensile pattuito", r.canone_pattuito !== null ? `€ ${v(r.canone_pattuito)} (annuo € ${v(r.canone_pattuito * 12)})` : ""]];
    for (const [k, val] of voci) {
      tx(k, SX, a, { sz: 9.2 });
      if (val) { let t = val; while (largo(t, reg, 9.2) > DX - 260) t = t.slice(0, -1); tx(t, DX - largo(t, reg, 9.2), a, { sz: 9.2, c: DATO }); }
      p.drawLine({ start: { x: SX, y: Y(a) - 3 }, end: { x: DX, y: Y(a) - 3 }, thickness: 0.3, color: GRIGIO });
      a += 13.5;
    }
    a += 16;
    centro("ATTESTAZIONE DI RISPONDENZA EX D.M. 16/01/2017", a, reg, 11); a += 20;
    riga(a, ["L'Organizzazione ", { w: 100 }, ", firmataria dell'Accordo territoriale per il Comune di Venezia, depositato il ", { w: 60 }, ","]); a += 14;
    riga(a, ["in persona di ", { w: 140 }, ","]); a += 18;
    centro("PREMESSO CHE", a, reg, 10); a += 18;
    const ind = [s.indirizzo, s.piano ? `piano ${s.piano}` : "", s.interno ? `int. ${s.interno}` : ""].filter(Boolean).join(", ");
    riga(a, ["il sig. ", { w: 150, v: s.locatore }, " C.F. ", { w: 120, v: (s.locatore_cf || "").toUpperCase() }, " residente a ", { w: 70 }]); a += 14;
    riga(a, ["nella qualità di locatore dell'immobile/porzione di immobile sito a Venezia in ", { w: 180, v: ind }]); a += 18;
    riga(a, ["il sig. ", { w: 150, v: s.conduttore }, " C.F. ", { w: 120, v: (s.conduttore_cf || "").toUpperCase() }, " residente a ", { w: 70 }]); a += 14;
    riga(a, ["nella qualità di conduttore dello stesso immobile,"]); a += 18;
    for (const t of aCapo("con contratto stipulato con decorrenza il …………, registrato il ………… al n. ………… presso l'Agenzia delle Entrate …………/in corso di registrazione, essendo i termini non ancora scaduti, hanno presentato richiesta per l'attestazione ex D.M. 16/01/2017, dichiarano, sotto la loro responsabilità, gli elementi oggettivi contenuti negli allegati \"Tab. 2\" e \"scheda calcolo\" e di aver utilizzato uno dei tipi di contratti allegati all'accordo senza aver apportato modifica alcuna.", reg, 9.6, DX - SX)) { tx(t, SX, a, { sz: 9.6 }); a += 13; }
    a += 10;
    tx("Firma del locatore", SX + 30, a, { sz: 9.6 }); tx("Firma del conduttore", 360, a, { sz: 9.6 }); a += 26;
    for (const t of aCapo("TUTTO CIÒ PREMESSO, l'Organizzazione ……………, come sopra rappresentata sulla base degli elementi oggettivi dichiarati agli allegati sopracitati, anche ai fini dell'ottenimento di eventuali agevolazioni fiscali,", reg, 9.6, DX - SX)) { tx(t, SX, a, { sz: 9.6 }); a += 13; }
    a += 4; centro("ATTESTA", a, reg, 10); a += 16;
    for (const t of aCapo("che i contenuti economici e normativi del contratto corrispondono a quanto previsto dall'Accordo territoriale vigente per il Comune di Venezia depositato in data …………", reg, 9.6, DX - SX)) { tx(t, SX, a, { sz: 9.6 }); a += 13; }
    a += 12;
    tx("Il dichiarante p. l'Organizzazione", SX, a, { sz: 10 }); a += 22;
    tx("……………………………………", SX, a, { sz: 10 }); tx("……………………………………………", 340, a, { sz: 10 });
    piede();
    return doc.save();
  }

  return { creaPDF };
});
