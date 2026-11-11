/*
 * La scheda del canone di Firenze in PDF. I modelli di attestazione
 * dell'accordo del 3/7/2025 (allegati B e C) non sono pubblicati: il
 * prospetto segue gli articoli 4-15 dell'accordo (zona, tipologia,
 * superficie convenzionale, maggiorazioni, canone), con lo spazio per le
 * firme delle parti e dell'organizzazione che attesta. Una pagina A4.
 *
 *   StampaFirenze.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                         accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaFirenze = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 48, DX = 547;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Firenze - Scheda di determinazione del canone");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4), FONDO = rgb(0.93, 0.93, 0.93);
    const p = doc.addPage([L, H]);
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const SZ = 9.2;
    const tx = (t, x, a, { f = reg, sz = SZ, c = NERO } = {}) => { p.drawText(String(t), { x, y: Y(a), size: sz, font: f, color: c }); return x + largo(t, f, sz); };
    const dx = (t, x, a, o = {}) => tx(t, x - largo(t, o.f || reg, o.sz || SZ), a, o);
    const riga = (a, pezzi, x0 = SX) => {
      let x = x0;
      for (const pz of pezzi) {
        if (typeof pz === "string") { x = tx(pz, x, a); continue; }
        p.drawLine({ start: { x, y: Y(a) - 1.5 }, end: { x: x + pz.w, y: Y(a) - 1.5 }, thickness: 0.5, color: NERO });
        if (pz.v) { let t = String(pz.v); while (t && largo(t, reg, SZ) > pz.w - 3) t = t.slice(0, -1); tx(t, x + 2, a + -0.5, { c: DATO }); }
        x += pz.w;
      }
    };
    const titolo = (t, a) => { p.drawRectangle({ x: SX, y: Y(a + 4), width: DX - SX, height: 14, color: FONDO }); tx(t, SX + 4, a, { f: bold, sz: 9.5 }); };
    const casella = (x, a, si) => { p.drawRectangle({ x, y: Y(a) - 0.5, width: 7.5, height: 7.5, borderColor: NERO, borderWidth: 0.6 }); if (si) tx("X", x + 1.4, a - 0.3, { f: bold, sz: 7.5, c: DATO }); return x + 12; };

    let t = "SCHEDA DI DETERMINAZIONE DEL CANONE";
    tx(t, (L - largo(t, bold, 12)) / 2, 50, { f: bold, sz: 12 });
    t = "Accordo territoriale sulle locazioni abitative applicabile nel Comune di Firenze e Comuni limitrofi, sottoscritto il 03/07/2025";
    tx(t, (L - largo(t, reg, 8.6)) / 2, 64, { sz: 8.6 });
    let a = 84;
    const tipo = s.tipo || "agevolato";
    let x = SX;
    for (const [k, et] of [["agevolato", "agevolato (art. 2 c. 3 L. 431/98)"], ["transitorio", "transitorio (art. 5 c. 1)"], ["studenti", "studenti universitari (art. 5 c. 2)"]]) {
      x = casella(x, a, tipo === k); x = tx(et, x, a) + 16;
    }
    a += 18;
    riga(a, ["Locatore ", { w: 180, v: s.locatore }, "  C.F. ", { w: 120, v: (s.locatore_cf || "").toUpperCase() }]); a += 15;
    riga(a, ["Conduttore ", { w: 170, v: s.conduttore }, "  C.F. ", { w: 120, v: (s.conduttore_cf || "").toUpperCase() }]); a += 15;
    riga(a, ["Immobile in Firenze, ", { w: 200, v: s.indirizzo }, "  Fg. ", { w: 34, v: s.foglio }, " Part. ", { w: 40, v: s.particella }, " Sub. ", { w: 30, v: s.subalterno }]); a += 20;

    titolo("1. ZONA E TIPOLOGIA (artt. 4, 5 e 8)", a); a += 17;
    riga(a, ["Zona omogenea ", { w: 110, v: r.zona ? r.zona[1] : "" }, "  microzone ", { w: 140, v: r.zona ? r.zona[2] : "" }]); a += 15;
    riga(a, ["Tipologia ", { w: 26, v: r.tipologia.tipo }, "  ", { w: 360, v: r.tipologia.perche }]); a += 13;
    const car = s.caratteristiche || [];
    x = SX; tx("Caratteristiche art. 8 b):", x, a, { sz: 8.4 }); x += 104;
    "abcdefg".split("").forEach((l, i) => { x = casella(x, a, !!car[i]); x = tx(l, x, a, { sz: 8.4 }) + 8; });
    x += 10; x = casella(x, a, !!s.recente); tx("ultimati negli ultimi 10 anni, art. 8 a)", x, a, { sz: 8.4 }); a += 13;
    const el = s.elementi || [];
    x = SX; tx("Elementi per il tipo A:", x, a, { sz: 8.4 }); x += 104;
    for (let i = 0; i < 12; i++) { x = casella(x, a, !!el[i]); x = tx(String(i + 1), x, a, { sz: 8.4 }) + 6; }
    a += 15;
    riga(a, ["Fascia di oscillazione: minimo € ", { w: 50, v: r.fascia ? v(r.fascia[0]) : "" }, "  massimo € ", { w: 50, v: r.fascia ? v(r.fascia[1]) : "" }, " al mq al mese"]); a += 20;

    titolo("2. SUPERFICIE CONVENZIONALE (art. 6)", a); a += 17;
    const sup = r.superficie, voce = (k) => (sup ? sup.righe.find((y) => y.chiave === k) : null);
    const VOCI = [["utile", "A - superficie interna utile (altezza almeno 240 cm)", "100%"], ["basse", "A1 - aree interne con altezza tra 180 e 240 cm", "30%"],
      ["autorimessa", "B - autorimesse singole o box auto", "50%"], ["attico", "C - lastrici solari esclusivi all'attico", "25% / 5%"],
      ["posto_esclusivo", "D - posti auto in area di proprietà esclusiva del locatore", "30%"], ["posto_coperto", "E - posto auto assegnato in autorimessa comune coperta", "25%"],
      ["posto_scoperto", "F - posto auto assegnato in spazio comune scoperto", "20%"], ["posto_rotazione", "G - posto auto a rotazione in spazio comune scoperto", "5%"],
      ["balconi", "H - balconi, terrazze, lastrici non all'attico, cantine", "25%"], ["scoperta", "I - superficie scoperta esclusiva (corti, giardini)", "10% / 2%"]];
    tx("mq", 372, a - 17, { sz: 7.5, c: GRIGIO }); tx("mq conv.", 510, a - 17, { sz: 7.5, c: GRIGIO });
    for (const [k, et, pc] of VOCI) {
      const y = voce(k);
      tx(et, SX, a, { sz: 8.6 }); tx(pc, 400, a, { sz: 8.6 });
      if (y && y.mq) { dx(v(y.mq), 390, a, { sz: 8.6, c: DATO }); dx(v(y.convenzionale), DX, a, { sz: 8.6, c: DATO }); }
      a += 11.5;
    }
    if (sup && sup.totale !== sup.lorda) { tx(`Somma ${v(sup.lorda)} mq; ${sup.note.join(" ")}`, SX, a, { sz: 8, c: DATO }); a += 11.5; }
    tx("TOTALE SUPERFICIE CONVENZIONALE mq", 300, a, { f: bold }); if (sup) dx(v(sup.totale), DX, a, { f: bold, c: DATO }); a += 20;

    titolo("3. MAGGIORAZIONI (artt. 9-13, applicate una sull'altra, art. 10)", a); a += 17;
    if (!r.maggiorazioni.length) { tx("nessuna", SX, a, { c: DATO }); a += 12; }
    for (const m of r.maggiorazioni) { tx(m.nome, SX, a, { c: DATO }); dx(`+${v(m.percento, m.percento % 1 ? 1 : 0)}%`, DX, a, { c: DATO }); a += 12; }
    if (r.maggiorazioni.length > 1) { tx("coefficiente complessivo", SX, a); dx(`x ${v(r.fattore, 4)}`, DX, a, { c: DATO }); a += 12; }
    a += 8;

    titolo("4. CANONE", a); a += 17;
    riga(a, ["Valore al mq al mese: minimo € ", { w: 50, v: r.fascia_magg ? v(r.fascia_magg[0], 3) : "" }, "  massimo € ", { w: 50, v: r.fascia_magg ? v(r.fascia_magg[1], 3) : "" }, "  applicato € ", { w: 50, v: r.valore !== null ? v(r.valore, 3) : "" }]); a += 15;
    if (r.porzione) { riga(a, ["Porzione (art. 15): mq esclusivi locati ", { w: 40, v: v(r.porzione.mq) }, " su mq esclusivi totali ", { w: 40, v: v(r.porzione.totale) }, "; canone intero € ", { w: 60, v: v(r.canone_intero) }]); a += 15; }
    riga(a, ["Canone mensile massimo € ", { w: 70, v: v(r.canone_massimo) }, "   Canone mensile pattuito € ", { w: 70, v: r.canone_pattuito !== null ? v(r.canone_pattuito) : "" }]); a += 15;
    riga(a, ["Canone annuo pattuito € ", { w: 80, v: r.canone_pattuito !== null ? v(r.canone_pattuito * 12) : "" }, "   Durata ", { w: 70, v: tipo === "agevolato" ? `${s.durata_anni || 3} + 2 anni` : "" }]); a += 24;

    const testo = "Le parti dichiarano che i dati sopra esposti sono veritieri e sono stati da loro forniti dopo aver preso visione dell'Accordo territoriale.";
    tx(testo, SX, a, { sz: 8.6 }); a += 26;
    riga(a, ["Il locatore ", { w: 170 }, "       Il conduttore ", { w: 170 }]); a += 26;
    riga(a, ["Data ", { w: 90 }, "     Timbro e firma dell'organizzazione che attesta ", { w: 160 }]); a += 22;

    if (r.canone_massimo !== null) {
      p.drawText("Calcolo di LocaOnLine: i modelli di attestazione dell'accordo (allegati B e C) non sono pubblicati; questo prospetto segue gli artt. 4-15.", { x: SX, y: Y(a), size: 7.2, font: reg, color: GRIGIO });
    }
    t = "Scheda per l'Accordo territoriale di Firenze e Comuni limitrofi (sottoscritto il 03/07/2025), compilata con LocaOnLine";
    p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    if (Marchio) Marchio.disegna(doc, ris.PDFLib, p,
      await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }),
      { cx: L / 2, y: 14, campagna: "scheda_canone_firenze" });
    return doc.save();
  }

  return { creaPDF };
});
