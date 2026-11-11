/*
 * La scheda del canone di Milano in PDF: il modello "Richiesta di
 * attestazione bilaterale" dell'Accordo locale 2023 (pagine 17-19 del PDF
 * pubblicato da Milano Abitare), compilato con i dati della scheda.
 * La parte finale ("ATTESTANO") resta in bianco: la firmano le associazioni.
 *
 * Gira nel browser e con Node (prove). pdf-lib + fontkit, Liberation Serif
 * (stesse misure del Times New Roman del modello).
 *
 *   StampaMilano.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                        accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaMilano = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 62, DX = 540;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));
  const data = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || "") ? iso.split("-").reverse().join("/") : iso || "");

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo locale Milano 2023 - Richiesta di attestazione bilaterale");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const pagine = [];
    let p = null, alto = 0;                   // alto: distanza dal bordo superiore
    const nuova = () => { p = doc.addPage([L, H]); pagine.push(p); alto = 56; };
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);

    const scrivi = (t, x, a, { f = reg, sz = 10, col = NERO, centro = false } = {}) => {
      t = String(t ?? ""); if (!t) return 0;
      const w = largo(t, f, sz);
      p.drawText(t, { x: centro ? x - w / 2 : x, y: Y(a), size: sz, font: f, color: col });
      return w;
    };
    /** Un dato su una riga da riempire: la riga e, sopra, il valore (blu). */
    const spazio = (x1, x2, a, valore, sz = 10) => {
      p.drawLine({ start: { x: x1, y: Y(a + 1.5) }, end: { x: x2, y: Y(a + 1.5) }, thickness: 0.5, color: NERO });
      let t = String(valore ?? "");
      while (t && largo(t, reg, sz) > x2 - x1 - 4) t = t.slice(0, -1);
      if (t) scrivi(t, x1 + 2, a, { sz, col: DATO });
    };
    const casella = (x, a, segnata, lato = 7.5) => {
      p.drawRectangle({ x, y: Y(a), width: lato, height: lato, borderColor: NERO, borderWidth: 0.6 });
      if (segnata) {
        const m = 1.5;
        p.drawLine({ start: { x: x + m, y: Y(a) + m }, end: { x: x + lato - m, y: Y(a) + lato - m }, thickness: 1, color: DATO });
        p.drawLine({ start: { x: x + m, y: Y(a) + lato - m }, end: { x: x + lato - m, y: Y(a) + m }, thickness: 1, color: DATO });
      }
    };
    /** Le righe di un testo che sta in una larghezza; le parti in grassetto con **…**. */
    const righe = (t, w, sz, f = reg) => {
      const parole = String(t).split(/\s+/), out = [];
      let riga = "";
      for (const pa of parole) {
        const prova = riga ? riga + " " + pa : pa;
        if (largo(prova, f, sz) > w && riga) { out.push(riga); riga = pa; } else riga = prova;
      }
      if (riga) out.push(riga);
      return out;
    };
    const paragrafo = (t, x, w, sz = 10, f = reg, interlinea = 1.25) => {
      for (const riga of righe(t, w, sz, f)) { scrivi(riga, x, alto, { f, sz }); alto += sz * interlinea; }
    };

    // ===================================================== pagina 1
    nuova();
    scrivi("ACCORDO LOCALE PER LA CITTA' DI MILANO - 2023", L / 2, alto, { f: bold, sz: 12.5, centro: true }); alto += 16;
    scrivi("RICHIESTA DI ATTESTAZIONE BILATERALE", L / 2, alto, { f: bold, sz: 12.5, centro: true }); alto += 30;

    const parte = (prima, nome, cf, comune, via, ruolo) => {
      let x = SX + scrivi(prima, SX, alto);
      spazio(x + 3, 300, alto, nome); scrivi("C.F.", 306, alto);
      spazio(328, DX, alto, (cf || "").toUpperCase()); alto += 17;
      scrivi("residente a", SX, alto); spazio(SX + 52, 230, alto, comune);
      scrivi(", Via", 232, alto); spazio(256, 400, alto, via);
      scrivi(`in qualità di ${ruolo}`, 405, alto); alto += 20;
    };
    parte("I sottoscritti, Sig./ra", s.locatore, s.locatore_cf, s.locatore_comune, s.locatore_via, "locatore");
    parte("e  Sig./ra", s.conduttore, s.conduttore_cf, s.conduttore_comune, s.conduttore_via, "conduttore");
    alto += 4;
    scrivi("richiedono l'attestazione relativa alla seguente locazione ed allo scopo comunicano:", SX, alto); alto += 24;

    let x = SX + scrivi("IMMOBILE LOCATO", SX, alto, { f: bold }) + scrivi(" in", SX + largo("IMMOBILE LOCATO", bold, 10), alto);
    spazio(x + 2, x + 58, alto, s.citta); x += 60;
    x += scrivi(", Via", x, alto); spazio(x + 2, x + 128, alto, s.indirizzo); x += 132;
    x += scrivi("piano", x, alto); spazio(x + 2, x + 22, alto, s.piano); x += 26;
    x += scrivi("Fg", x, alto); spazio(x + 2, x + 22, alto, (s.catasto || {}).foglio); x += 25;
    x += scrivi(", mapp", x, alto); spazio(x + 2, x + 24, alto, (s.catasto || {}).particella); x += 27;
    x += scrivi(", sub", x, alto); spazio(x + 2, Math.max(DX, x + 26), alto, (s.catasto || {}).subalterno);
    alto += 22;
    x = SX + scrivi("TIPOLOGIA DEL CONTRATTO:", SX, alto, { f: bold }) + 8;
    for (const [val, nome] of [["agevolato", "Abitativo"], ["studenti", "Studenti Universitari"], ["transitorio", "Transitorio"]]) {
      casella(x, alto, s.tipo === val); x += 12; x += scrivi(nome, x, alto) + 14;
    }
    alto += 22;
    x = SX + scrivi("DURATA DEL CONTRATTO", SX, alto, { f: bold }) + scrivi(": dal", SX + largo("DURATA DEL CONTRATTO", bold, 10), alto);
    spazio(x + 4, x + 130, alto, data(s.dal)); scrivi("al", x + 140, alto); spazio(x + 154, x + 280, alto, data(s.al));
    alto += 24;
    scrivi("CARATTERISTICHE IMMOBILE:", SX, alto, { f: bold }); alto += 6;

    // la tabella SI/NO degli elementi
    const XSI = DX - 50, XNO = DX - 25, W = XSI - SX - 8, SZ = 8.6;
    const bordo = (a1, a2) => {
      for (const xx of [SX, XSI, XNO, DX]) p.drawLine({ start: { x: xx, y: Y(a1) }, end: { x: xx, y: Y(a2) }, thickness: 0.5, color: NERO });
      p.drawLine({ start: { x: SX, y: Y(a2) }, end: { x: DX, y: Y(a2) }, thickness: 0.5, color: NERO });
    };
    p.drawLine({ start: { x: SX, y: Y(alto) }, end: { x: DX, y: Y(alto) }, thickness: 0.5, color: NERO });
    scrivi("CARATTERISTICA", (SX + XSI) / 2, alto + 10, { f: bold, sz: 9, centro: true });
    scrivi("SI", (XSI + XNO) / 2, alto + 10, { f: bold, sz: 9, centro: true });
    scrivi("NO", (XNO + DX) / 2, alto + 10, { f: bold, sz: 9, centro: true });
    bordo(alto, alto + 14); alto += 14;
    const el = s.elementi || {};
    for (const t of ["A", "B", "C", "D"]) for (const [k, desc] of accordo.elementi[t]) {
      const rr = righe(`${k} ${desc}`, W, SZ);
      const h = rr.length * SZ * 1.18 + 4;
      if (alto + h > H - 50) { nuova(); }
      const a0 = alto;
      rr.forEach((riga, i) => {
        // il codice in grassetto, come nel modello
        if (i === 0) { const wk = scrivi(k, SX + 3, a0 + 2 + SZ, { f: bold, sz: SZ }); scrivi(riga.slice(k.length), SX + 3 + wk, a0 + 2 + SZ, { sz: SZ }); }
        else scrivi(riga, SX + 3, a0 + 2 + SZ + i * SZ * 1.18, { sz: SZ });
      });
      const centro = a0 + h / 2 + 3;
      scrivi(el[k] ? "X" : "", (XSI + XNO) / 2, centro, { f: bold, sz: 9, col: DATO, centro: true });
      scrivi(el[k] ? "" : "X", (XNO + DX) / 2, centro, { f: bold, sz: 9, col: DATO, centro: true });
      bordo(a0, a0 + h); alto = a0 + h;
    }

    // ===================================================== pagina 2
    nuova();
    scrivi("SUPERFICIE", L / 2, alto, { f: bold, sz: 10, centro: true }); alto += 8;
    const C1 = 360, C2 = 420, C3 = 470;
    const rigaTab = (a, cols, f = reg, colDati = DATO) => {
      const h = 15;
      for (const xx of [SX, C1, C2, C3, DX]) p.drawLine({ start: { x: xx, y: Y(a) }, end: { x: xx, y: Y(a + h) }, thickness: 0.5, color: NERO });
      p.drawLine({ start: { x: SX, y: Y(a + h) }, end: { x: DX, y: Y(a + h) }, thickness: 0.5, color: NERO });
      const [a1, b, c, d] = cols;
      scrivi(a1, SX + 3, a + 11, { f, sz: 9 });
      scrivi(b, C1 + 3, a + 11, { sz: 9, col: colDati }); scrivi(c, C2 + 3, a + 11, { sz: 9 }); scrivi(d, C3 + 3, a + 11, { sz: 9, col: colDati });
      return a + h;
    };
    p.drawLine({ start: { x: SX, y: Y(alto) }, end: { x: DX, y: Y(alto) }, thickness: 0.5, color: NERO });
    alto = rigaTab(alto, ["Da visura catastale mq", "Mq.", "Coeff.", "Sup"], reg, NERO);
    const sup = {}; for (const rg of r.righe || []) sup[rg.chiave] = rg;
    const parziale = !!s.parziale;
    for (const rg of accordo.regole.superficie.righe) {
      const q = sup[rg.chiave] || {};
      const coeff = rg.solo_parziale ? "" : v(rg.coeff);
      alto = rigaTab(alto, [rg.etichetta, q.mq === null || q.mq === undefined ? "" : v(q.mq), coeff,
        q.convenzionale === null || q.convenzionale === undefined || (rg.solo_parziale && !parziale) ? "" : v(q.convenzionale)]);
    }
    const pic = sup.piccoli || {};
    alto = rigaTab(alto, [accordo.regole.superficie.piccoli.etichetta, pic.convenzionale ? v(pic.mq) : "", v(accordo.regole.superficie.piccoli.coeff), pic.convenzionale ? v(pic.convenzionale) : ""]);
    alto = rigaTab(alto, ["", "", "", ""]);
    scrivi("TOTALE", (SX + C1) / 2, alto - 4, { sz: 9, centro: true });
    if (r.totale && r.modo !== "stanza") scrivi(v(r.totale), C3 + 3, alto - 4, { sz: 9, col: DATO });
    alto += 20;

    const siNo = (a, si) => { casella(430, a, si === true); scrivi("SI", 441, a); casella(470, a, si === false); scrivi("NO", 481, a); };
    const mq = r.modo !== "stanza";
    x = SX + scrivi("ALLOGGIO COMPLETAMENTE ARREDATO:", SX, alto, { f: bold }); scrivi(" (aumento fino ad un max del 15%)", x, alto, { f: bold, sz: 8.5 });
    siNo(alto, mq ? s.arredo === "completo" : null); alto += 14;
    x = SX + scrivi("ALLOGGIO SEMI ARREDATO:", SX, alto, { f: bold }); scrivi(" (aumento fino ad un max del 8%)", x, alto, { f: bold, sz: 8.5 });
    siNo(alto, mq ? s.arredo === "semi" : null); alto += 26;
    scrivi("MAGGIORAZIONE DURATA CONTRATTUALE:", SX, alto, { f: bold }); alto += 20;
    const anni = s.tipo === "agevolato" && mq ? Number(s.durata_anni) || 3 : 0;
    const durate = [[4, "per durata di 4 anni del 3%"], [5, "per durata di 5 anni del 5%"], [6, "per durata di 6 anni dell'8%"], [7, "per durata di un numero superiore ai 6 del 10%"]];
    durate.forEach(([n, t], i) => {
      const xx = i % 2 ? 300 : SX, aa = alto + Math.floor(i / 2) * 14;
      casella(xx, aa, anni === n); scrivi(t, xx + 12, aa);
    });
    alto += 36;
    x = SX + scrivi("CLASSE ENERGETICA “G”:", SX, alto, { f: bold });
    scrivi(" riduzione nei valori minimi e massimi del 2%", x, alto);
    siNo(alto, mq ? !!s.classe_G : null); alto += 24;
    const annuo = s.canone_annuo ? "€ " + v(r.canone_pattuito_annuo) : "";
    x = SX + scrivi("Canone annuo convenuto €", SX, alto); spazio(x + 4, x + 140, alto, mq ? annuo.replace("€ ", "") : ""); alto += 30;

    scrivi("IN ALTERNATIVA:", SX, alto, { f: bold }); alto += 13;
    scrivi("ELEMENTI PER LA DETERMINAZIONE A CORPO DEL CANONE DELLE STANZE:", SX, alto, { f: bold }); alto += 8;
    p.drawLine({ start: { x: SX, y: Y(alto) }, end: { x: DX, y: Y(alto) }, thickness: 0.5, color: NERO });
    scrivi("CARATTERISTICA", (SX + XSI) / 2, alto + 10, { f: bold, sz: 9, centro: true });
    scrivi("SI", (XSI + XNO) / 2, alto + 10, { f: bold, sz: 9, centro: true });
    scrivi("NO", (XNO + DX) / 2, alto + 10, { f: bold, sz: 9, centro: true });
    bordo(alto, alto + 14); alto += 14;
    for (const [k, desc] of accordo.elementi.stanze) {
      const rr = righe(desc, W, SZ), h = rr.length * SZ * 1.18 + 4, a0 = alto;
      rr.forEach((riga, i) => scrivi(riga, SX + 3, a0 + 2 + SZ + i * SZ * 1.18, { sz: SZ }));
      const segno = r.modo === "stanza" ? !!(s.stanze || {})[k] : null;
      if (segno !== null) {
        scrivi(segno ? "X" : "", (XSI + XNO) / 2, a0 + h / 2 + 3, { f: bold, sz: 9, col: DATO, centro: true });
        scrivi(segno ? "" : "X", (XNO + DX) / 2, a0 + h / 2 + 3, { f: bold, sz: 9, col: DATO, centro: true });
      }
      bordo(a0, a0 + h); alto = a0 + h;
    }
    alto += 22;
    x = SX + scrivi("Zona omogenea", SX, alto); spazio(x + 4, x + 110, alto, s.zona ? s.zona : ""); alto += 22;
    x = SX + scrivi("Canone annuo convenuto €", SX, alto); spazio(x + 4, x + 140, alto, !mq ? annuo.replace("€ ", "") : ""); alto += 30;

    // la dichiarazione, con i nomi
    const nomeL = s.locatore || "", nomeC = s.conduttore || "";
    x = SX + scrivi("Il sig.", SX, alto); spazio(x + 8, x + 190, alto, nomeL); scrivi("locatore e il sig.", x + 196, alto);
    spazio(x + 280, DX, alto, nomeC); alto += 15;
    paragrafo("conduttore dichiarano che i dati sopra comunicati sono stati dagli stessi rilevati e verificati. Pertanto, " +
      "riconoscendo che l'Attestazione sarà rilasciata, secondo quanto previsto dal D.M. 16/01/2017, sulla base di quanto " +
      "dichiarato dagli stessi, sollevando espressamente l'Organizzazione ______________________ e l'Organizzazione " +
      "______________________ da qualsiasi responsabilità derivante da errori, omissioni o asseverazioni non veritiere ai dati " +
      "dichiarati nel presente atto.", SX, DX - SX, 10);
    alto += 26;
    scrivi("Il dichiarante", SX, alto); scrivi("Il dichiarante", 380, alto); alto += 26;
    spazio(SX, SX + 150, alto, ""); spazio(380, DX, alto, "");

    // il riepilogo del calcolo, in grigio: non fa parte del modello
    alto = Math.max(alto + 26, H - 112);
    const nota = [];
    if (r.modo === "stanza") {
      if (r.stanza_massimo) nota.push(`stanza a canone forfettario (punto 7.2), zona ${s.zona}: massimo € ${v(r.stanza_massimo)} al mese`);
    } else if (r.fascia && r.totale) {
      nota.push(`zona ${s.zona}, sub-fascia ${r.subfascia} (${r.subfascia_motivo}); elementi D: ${r.conteggi.D}`);
      nota.push(`valori annui da € ${v(r.fascia[0])} a € ${v(r.fascia[1])} al mq` +
        (r.fattori.length ? `, correttivi ${r.fattori.map((f) => `${f.percento > 0 ? "+" : "−"}${Math.abs(f.percento)}%`).join(" × ")}` : "") +
        `; canone annuo da € ${v(r.canone_min_annuo)} a € ${v(r.canone_max_annuo)} su ${v(r.totale)} mq`);
    }
    if (nota.length) {
      scrivi("Calcolo di LocaOnLine (non fa parte del modello):", SX, alto, { sz: 7.5, col: GRIGIO }); alto += 10;
      for (const t of nota) { for (const rg of righe(t, DX - SX, 7.5)) { scrivi(rg, SX, alto, { sz: 7.5, col: GRIGIO }); alto += 9.5; } }
    }

    // ===================================================== pagina 3
    nuova();
    scrivi("Tutto ciò premesso", L / 2, alto + 30, { f: bold, centro: true }); alto += 60;
    const lr = (prima) => { x = SX + scrivi(prima, SX, alto); spazio(x + 2, x + 120, alto, ""); x += 124; x += scrivi(", in persona di", x, alto); spazio(x + 6, DX - 12, alto, ""); };
    lr("L'Organizzazione"); scrivi("e", DX - 6, alto); alto += 15;
    lr("l'Organizzazione"); alto += 15;
    paragrafo("firmatarie dell'Accordo territoriale per il Comune di Milano, sulla base degli elementi oggettivi sopra dichiarati, " +
      "anche ai fini dell'ottenimento di eventuali agevolazioni fiscali,", SX, DX - SX, 10);
    alto += 14;
    scrivi("ATTESTANO", L / 2, alto, { f: bold, centro: true }); alto += 24;
    x = SX + scrivi("che i contenuti economici, che rientrano nei valori da", SX, alto); spazio(x + 4, x + 90, alto, "");
    scrivi("a", x + 96, alto); spazio(x + 106, DX, alto, ""); alto += 15;
    paragrafo("della zona di appartenenza dell'immobile (zona ___), ovvero, i contenuti economici della locazione di singola stanza, " +
      "forfettariamente determinata, e normativi del contratto, corrispondono a quanto previsto dall'Accordo territoriale vigente " +
      "per il Comune di Milano, depositato in data ______________________.", SX, DX - SX, 10);
    alto += 14;
    x = SX + scrivi("Milano, il", SX, alto); spazio(x + 6, x + 140, alto, "");
    alto += 40;
    scrivi("L'Organizzazione proprietari", SX + 20, alto); scrivi("L'Organizzazione conduttori", 360, alto);

    // in fondo a ogni pagina: la nota e l'invito di LocaOnLine
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    const marchio = Marchio ? await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }) : null;
    pagine.forEach((pg, i) => {
      const t = `Modello dell'Accordo locale per la città di Milano 2023 (integrato il 20 settembre 2023), compilato con LocaOnLine · pagina ${i + 1} di ${pagine.length}`;
      pg.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 42, size: 6.5, font: reg, color: GRIGIO });
      if (marchio) Marchio.disegna(doc, ris.PDFLib, pg, marchio, { cx: L / 2, y: 14, campagna: "scheda_canone_milano" });
    });
    return doc.save();
  }

  return { creaPDF };
});
