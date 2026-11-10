/*
 * La scheda di calcolo del canone (Allegato 2/B) in PDF, disegnata come
 * l'originale dell'accordo territoriale e compilata con i dati.
 *
 * Gira nel browser (portale UPPI, LocaOnLine) e con Node (prove). Usa pdf-lib
 * con fontkit e il carattere Carlito (stesse misure del Calibri della scheda
 * originale, licenza SIL OFL).
 *
 *   CanoneStampa.creaPDF({ PDFLib, fontkit, regolare, grassetto }, accordo, scheda, risultato)
 *     -> Promise<Uint8Array>
 *
 * Coordinate: in punti, dall'alto (come si misurano sulla scheda); la
 * conversione al sistema del PDF (dal basso) e' in "y()".
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.CanoneStampa = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LARGHEZZA = 595.28, ALTEZZA = 841.89;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" : Number(n).toFixed(c).replace(".", ","));

  async function creaPDF(risorse, accordo, scheda, r) {
    const { PDFDocument, rgb } = risorse.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(risorse.fontkit);
    const reg = await doc.embedFont(risorse.regolare, { subset: false });
    const bold = await doc.embedFont(risorse.grassetto, { subset: false });
    const pagina = doc.addPage([LARGHEZZA, ALTEZZA]);
    doc.setTitle("Scheda di calcolo del canone");
    doc.setCreator("LocaOnLine - locaonline.it");

    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.35, 0.35, 0.35);
    const y = (alto) => ALTEZZA - alto;
    const largo = (t, f, s) => f.widthOfTextAtSize(String(t), s);

    // ----------------------------------------------------- primitive
    const testo = (t, x, alto, { f = reg, s = 9, colore = NERO, centro = false, destra = false, sottolinea = false } = {}) => {
      t = String(t ?? "");
      if (!t) return 0;
      const w = largo(t, f, s);
      const x0 = centro ? x - w / 2 : destra ? x - w : x;
      pagina.drawText(t, { x: x0, y: y(alto), size: s, font: f, color: colore });
      if (sottolinea) pagina.drawLine({ start: { x: x0, y: y(alto) - 1.4 }, end: { x: x0 + w, y: y(alto) - 1.4 }, thickness: 0.5, color: colore });
      return w;
    };
    const linea = (x1, a1, x2, a2, spessore = 0.6) =>
      pagina.drawLine({ start: { x: x1, y: y(a1) }, end: { x: x2, y: y(a2) }, thickness: spessore, color: NERO });
    const riquadro = (x, alto, w, h, spessore = 0.6) =>
      pagina.drawRectangle({ x, y: y(alto + h), width: w, height: h, borderColor: NERO, borderWidth: spessore });
    const casella = (x, alto, lato, segnata) => {
      riquadro(x, alto, lato, lato, 0.7);
      if (segnata) {          // la X
        const m = lato * 0.2;
        linea(x + m, alto + m, x + lato - m, alto + lato - m, 1.1);
        linea(x + m, alto + lato - m, x + lato - m, alto + m, 1.1);
      }
    };
    // un dato scritto su uno spazio: centrato nello spazio, appena sopra la riga
    const dato = (t, x1, x2, alto, s = 9.5) => {
      t = String(t ?? "");
      if (!t) return;
      let size = s;
      while (size > 6 && largo(t, bold, size) > x2 - x1 - 2) size -= 0.5;
      testo(t, (x1 + x2) / 2, alto - 1.2, { f: bold, s: size, colore: DATO, centro: true });
    };
    const spazio = (x1, x2, alto) => linea(x1, alto, x2, alto, 0.5);

    const sup = r.superfici || {}, d = scheda || {}, m = d.maggiorazioni || {};

    // ----------------------------------------------------- intestazione
    testo("Allegato 2/B", 70, 62, { s: 10 });
    testo("SCHEDA DI CALCOLO DEL CANONE DELL'ACCORDO TERRITORIALE", 313, 87, { f: bold, s: 10.5, centro: true });
    const t1 = "DEL COMUNE DI ROMA DEL ", t2 = " E DM 16 GENNAIO 2017";
    const wBlank = 74, w1 = largo(t1, bold, 10.5), w2 = largo(t2, bold, 10.5);
    let x = 313 - (w1 + wBlank + w2) / 2;
    testo(t1, x, 99, { f: bold, s: 10.5 }); x += w1;
    spazio(x, x + wBlank, 100); dato(accordo.accordo.data_testo, x, x + wBlank, 100, 9);
    testo(t2, x + wBlank, 99, { f: bold, s: 10.5 });

    // tipo di contratto
    casella(176, 106, 11, d.tipo === "agevolato");
    let xc = 192 + testo("Contratto: ", 192, 115, { s: 9.5 });
    spazio(xc, xc + 12, 116); dato(d.tipo === "agevolato" ? String(d.durata_anni || 3) : "", xc, xc + 12, 116);
    testo("+2", xc + 13, 115, { s: 9.5 });
    casella(268, 106, 11, d.tipo === "studenti");
    testo("Studenti universitari", 283, 115, { s: 9.5 });
    casella(369, 106, 11, d.tipo === "transitorio");
    testo("Transitorio", 385, 115, { s: 9.5 });

    // parti
    testo("LOCATORE:", 73, 128, { s: 8 }); spazio(132, 543, 130); dato(d.locatore, 132, 543, 130);
    testo("CONDUTTORE:", 73, 145, { s: 8 }); spazio(132, 543, 147); dato(d.conduttore, 132, 543, 147);
    testo("Città:", 74, 163, { s: 8 }); spazio(100, 163, 166); dato(d.citta, 100, 163, 166, 8.5);
    testo("Via/Piazza", 168, 165, { s: 7.5 }); spazio(208, 304, 166); dato(d.indirizzo, 208, 304, 166, 8);
    testo("COD. ZONA", 310, 165, { s: 7.5 }); spazio(355, 404, 166); dato(d.zona, 355, 404, 166);
    testo("Id. catastale:", 409, 165, { s: 7.5 });
    const cat = d.catasto || {};
    spazio(452, 548, 167);
    testo("F", 452, 165, { s: 7 }); dato(cat.foglio, 457, 482, 166, 8);
    testo("P", 485, 165, { s: 7 }); dato(cat.particella, 490, 514, 166, 8);
    testo("S", 517, 165, { s: 7 }); dato(cat.subalterno, 522, 548, 166, 8);

    testo("Tutte le informazioni necessarie per determinare il calcolo del canone sono state fornite dalle parti.", 310, 191, { s: 10.5, centro: true });

    // ----------------------------------------------------- superfici
    testo("CALCOLO DELLA SUPERFICIE CONVENZIONALE", 66, 202, { s: 7, sottolinea: true });
    const SX = 69, DX = 552, C1 = 262, C2 = 332, C3 = 475, TOP = 205, RIGA = 10;
    const rs = accordo.regole.superficie;
    riquadro(SX, TOP, DX - SX, RIGA * 10);
    for (const cx of [C1, C2, C3]) linea(cx, TOP, cx, TOP + RIGA * 10);
    linea(SX, TOP + RIGA * 4, DX, TOP + RIGA * 4);
    for (let i = 5; i < 10; i++) linea(SX, TOP + RIGA * i, DX, TOP + RIGA * i);
    for (let i = 1; i < 4; i++) linea(C1, TOP + RIGA * i, DX, TOP + RIGA * i, 0.3);
    const etichette = ["Autorimessa e/o posto auto esclusivo Zona Pregio", "Autorimessa e/o posto auto esclusivo",
      "Posto auto in autorimessa comune", "Balconi, terrazze, cantine e simili", "Superficie scoperta in godimento esclusivo",
      "Sup. verde condominiale (Sup. tot. cond / MM.Tab A)"];
    testo("Superficie calpestabile appartamento:", SX + 3, TOP + 8, { s: 7.5 });
    etichette.forEach((e, i) => testo(e, SX + 3, TOP + RIGA * (4 + i) + 7.8, { s: 7.5 }));
    const sottorighe = [`<46 (x ${v(rs.fino_46.coeff)} fino a ${v(rs.fino_46.massimo)} mq.)`,
      `46-70 (x ${v(rs.da_46_a_70.coeff)} fino a ${v(rs.da_46_a_70.massimo)} mq.)`, "70-120",
      `>120 (possibilità di diminuzione fino a – ${rs.oltre_120_riduzione_massima * 100}%)`];
    const coeffRighe = [`x ${v(rs.box_pregio)}`, `x ${v(rs.box)}`,
      `x ${v(r.pregio ? rs.posto_auto_comune_pregio : rs.posto_auto_comune)}`, `x ${v(rs.balconi_cantine)}`,
      `x ${v(rs.scoperta_esclusiva)}`, `x ${v(rs.verde_condominiale)}`];
    for (let i = 0; i < 10; i++) {
      const alto = TOP + RIGA * i + 7.8;
      testo("= mq", C1 + 3, alto, { s: 7.5 });
      testo(i < 4 ? sottorighe[i] : coeffRighe[i - 4], C2 + 3, alto, { s: 7.5 });
      testo("= mq", C3 + 3, alto, { s: 7.5 });
    }
    // i valori: l'appartamento nella sottoriga della sua metratura
    const app = sup.appartamento || {};
    if (app.netta) {
      const n = app.netta, k = n < 46 ? 0 : n <= 70 ? 1 : n < 120 ? 2 : 3;
      const alto = TOP + RIGA * k + 8;
      testo(v(n), C2 - 3, alto, { f: bold, s: 8, colore: DATO, destra: true });
      testo(v(app.applicata), DX - 3, alto, { f: bold, s: 8, colore: DATO, destra: true });
    }
    const valoriRighe = [r.pregio ? sup.box : null, r.pregio ? null : sup.box, sup.posto_comune, sup.balconi, sup.scoperta, sup.verde];
    valoriRighe.forEach((s, i) => {
      if (!s || !s.netta) return;
      const alto = TOP + RIGA * (4 + i) + 8;
      testo(v(s.netta), C2 - 3, alto, { f: bold, s: 8, colore: DATO, destra: true });
      testo(v(s.applicata), DX - 3, alto, { f: bold, s: 8, colore: DATO, destra: true });
    });
    testo("TOTALE SUPERFICIE CONVENZIONALE Mq.", 309, 318, { f: bold, s: 8 });
    spazio(445, 540, 320); dato(r.totale ? v(r.totale) : "", 445, 540, 320);

    // ----------------------------------------------------- caratteristiche
    const c = d.caratteristiche || {};
    testo("CARATTERISTICHE:", 66, 334, { s: 7.5, sottolinea: true });
    [["Allaccio rete idrica", 153, 218, c.idrica], ["Allaccio rete fognante", 240, 317, c.fognante],
     ["Erogazione GAS o induzione", 335, 434, c.gas], ["Impianto riscaldamento", 451, 538, c.riscaldamento]]
      .forEach(([t, xt, xc, on]) => { testo(t, xt, 334, { s: 7.5, sottolinea: true }); casella(xc, 325, 11, on); });
    testo("Appartamento normale", 65, 350, { f: bold, s: 8, sottolinea: true });
    casella(157, 341, 11, r.normale); testo("SI", 173, 350, { s: 8 });
    casella(204, 341, 11, !r.normale); testo("NO", 220, 350, { s: 8 });

    // ----------------------------------------------------- parametri
    testo("PARAMETRI", 65, 361, { s: 6.5, sottolinea: true });
    const PT = 364, PR = 9.4, sel = d.parametri || [];
    const col = [[65, 81, 92, 306], [306, 322, 333, 550]];
    riquadro(65, PT, 550 - 65, PR * 10);
    for (const [a, b, cc] of col) for (const cx of [a, b, cc]) linea(cx, PT, cx, PT + PR * 10, a === 65 && cx === 65 ? 0 : 0.5);
    for (let i = 1; i < 10; i++) linea(65, PT + PR * i, 550, PT + PR * i, 0.4);
    accordo.parametri.forEach((p, i) => {
      const [a, b, cc] = col[i < 10 ? 0 : 1], riga = i % 10, alto = PT + PR * riga + 7;
      testo(String(i + 1), a + 3, alto, { s: 6.5 });
      testo(p, cc + 3, alto, { s: 6.5 });
      if (sel[i]) {
        const cx = (b + cc) / 2, cy = PT + PR * riga + PR / 2, s2 = 2.8;
        linea(cx - s2, cy - s2, cx + s2, cy + s2, 1); linea(cx - s2, cy + s2, cx + s2, cy - s2, 1);
      }
    });
    testo("NUMERO PARAMETRI DESCRITTIVI DELL'ALLOGGIO:", 62, 465, { s: 7.5 });
    spazio(235, 262, 466); dato(String(r.parametri ?? ""), 235, 262, 466);

    // ----------------------------------------------------- maggiorazioni
    testo("Maggiorazioni/Riduzioni applicabili:", 62, 477, { f: bold, s: 8 });
    const qualche = (r.maggiorazioni || []).length > 0;
    riquadro(196, 468, 46, 11); linea(219, 468, 219, 479);
    testo("SI", 204, 476.5, { s: 7.5 }); testo("NO", 225, 476.5, { s: 7.5 });
    const segno = (x1, x2, a1, a2) => { const cx = (x1 + x2) / 2, cy = (a1 + a2) / 2, s2 = 3;
      linea(cx - s2, cy - s2, cx + s2, cy + s2, 1); linea(cx - s2, cy + s2, cx + s2, cy - s2, 1); };
    // la parola scelta si cerchia, come a mano
    pagina.drawEllipse({ x: qualche ? 207.8 : 230.6, y: y(473.5), xScale: 7.6, yScale: 4.6, borderColor: DATO, borderWidth: 1 });
    // tre colonne di voci, ognuna con la sua pila di caselle a destra
    const MY = 483, MH = 11.5;
    const colonne = [
      { x: 62, cx: 182, voci: [["A – Ammobiliato +", "ammobiliato"], ["D – Attico + 10%", "attico"], ["G – Interventi Sisma Bonus + 10%", "sisma_bonus"]] },
      { x: 220, cx: 346, voci: [["B – Seminterrato -10%", "seminterrato"], ["E – Classe energetica A/B/C + 10%", "classe_ABC"], ["H – Classe energetica D/E/F + 5%", "classe_DEF"]] },
      { x: 384, cx: 510, voci: [["C – Senza ascensore –10%", "senza_ascensore"], ["F – Interventi Eco Bonus + 5%", "eco_bonus"]] },
    ];
    const ammobiliato = Number(String(m.ammobiliato || "").replace(",", ".")) || 0;
    for (const colonna of colonne) {
      colonna.voci.forEach(([t, chiave], i) => {
        const alto = MY + MH * i;
        const w = testo(t, colonna.x, alto + 8, { s: 7.5 });
        if (chiave === "ammobiliato") {
          spazio(colonna.x + w + 2, colonna.x + w + 22, alto + 9);
          dato(ammobiliato ? v(ammobiliato, 0) : "", colonna.x + w + 2, colonna.x + w + 22, alto + 9, 8);
          testo("%", colonna.x + w + 24, alto + 8, { s: 7.5 });
        }
        riquadro(colonna.cx, alto, 32, MH, 0.6);
        const on = chiave === "ammobiliato" ? ammobiliato > 0 : !!m[chiave];
        if (on) segno(colonna.cx, colonna.cx + 32, alto, alto + MH);
      });
    }

    // ----------------------------------------------------- il calcolo
    const z = r.zona;
    // la zona con il nome per esteso, per la consultazione e la verifica;
    // la fascia di oscillazione resta sulla stessa riga, a destra
    testo("ZONA", 62, 531, { s: 7.5 }); spazio(84, 372, 532);
    dato(z ? `${z.codice} · ${z.nome}` : "", 84, 372, 532, 8.5);
    const xf = 377 + testo("FASCIA DI OSCILLAZIONE MIN/MAX", 377, 531, { s: 7.5 }) + 5;
    spazio(xf, xf + 24, 532); testo("/", xf + 25, 531, { s: 8 }); spazio(xf + 30, xf + 54, 532);
    if (z) { dato(v(z.oscillazione[0]), xf, xf + 24, 532, 8.5); dato(v(z.oscillazione[1]), xf + 30, xf + 54, 532, 8.5); }

    testo("PARAMETRI n.", 62, 544, { s: 7.5 }); spazio(112, 130, 545); dato(String(r.parametri ?? ""), 112, 130, 545);
    let xs = 135 + testo("SUBFASCIA: (", 135, 544, { s: 7.5 });
    ["inferiore", "media", "massima"].forEach((nome, i) => {
      const scelta = z && r.subfascia === nome;
      xs += testo(nome, xs, 544, { f: scelta ? bold : reg, s: 7.5, colore: scelta ? DATO : NERO, sottolinea: scelta });
      xs += testo(i < 2 ? "/" : ")", xs, 544, { s: 7.5 });
    });
    spazio(268, 290, 545); testo("/", 291, 544, { s: 8 }); spazio(296, 318, 545);
    if (r.fascia) { dato(v(r.fascia[0]), 268, 290, 545, 8.5); dato(v(r.fascia[1]), 296, 318, 545, 8.5); }
    testo("Valore applicato €", 330, 544, { s: 7.5 }); spazio(392, 430, 545); dato(v(r.valore_applicato), 392, 430, 545);

    testo("CALCOLO DEL CANONE:", 62, 558, { s: 7.5, sottolinea: true });
    testo("€ MQ/MESE", 141, 558, { s: 7.5 }); spazio(180, 210, 559); dato(v(r.valore_applicato), 180, 210, 559, 8.5);
    testo("x mq.", 212, 558, { s: 7.5 }); spazio(232, 262, 559); dato(r.totale ? v(r.totale) : "", 232, 262, 559, 8.5);
    testo("= €", 265, 558, { s: 7.5 }); spazio(280, 340, 559); dato(v(r.canone_base), 280, 340, 559);

    testo("Durata +", 62, 572, { s: 7.5 }); spazio(92, 110, 573); testo("% = €", 112, 572, { s: 7.5 }); spazio(134, 194, 573);
    if (d.tipo === "agevolato" && r.durata_percento) { dato(String(r.durata_percento), 92, 110, 573); dato(v(r.canone_durata), 134, 194, 573); }
    testo("Transitorio +", 62, 586, { s: 7.5 }); spazio(107, 125, 587); testo("%", 127, 586, { s: 7.5 });
    if (d.tipo === "transitorio") dato(v(r.transitorio_percento, 0), 107, 125, 587);

    testo("Importo massimo canone mensile: €", 62, 600, { s: 7.5 }); spazio(185, 250, 601); dato(v(r.canone_massimo), 185, 250, 601);
    testo("; Importo canone mensile pattuito: €", 252, 600, { f: bold, s: 7.5 }); spazio(381, 440, 601);
    dato(v(r.canone_pattuito), 381, 440, 601); testo(";", 442, 600, { s: 7.5 });

    // ----------------------------------------------------- firme
    testo("Il locatore", 120, 624, { s: 8 }); spazio(52, 195, 640);
    testo("Il conduttore", 440, 632, { s: 8 }); spazio(372, 540, 648);
    testo("SCHEDA NON VALIDI AI FINI DELL'ATTESTAZIONE DI RISPONDENZA EX DM 16 GENNAIO 2017", 296, 724, { f: bold, s: 8.5, centro: true });
    testo(`Calcolo secondo l'${accordo.accordo.titolo.replace(/^Accordo/, "Accordo")} del ${accordo.accordo.data_testo}` +
          (d.numero_scheda ? ` · scheda n. ${d.numero_scheda}` : "") + ".", 296, 812, { s: 6, colore: GRIGIO, centro: true });

    return doc.save();
  }

  return { creaPDF };
});
