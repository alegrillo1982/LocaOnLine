/*
 * La scheda del canone di Palermo in PDF: l'allegato E dell'Accordo
 * territoriale (23/01/2020), "Attestazione di rispondenza ex D.M. 16/1/2017",
 * compilato con i dati della scheda. I dati dell'organizzazione restano in
 * bianco: la compila e la firma l'associazione. Una pagina A4.
 *
 *   StampaPalermo.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                         accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaPalermo = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 58, DX = 537;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Palermo - Attestazione di rispondenza");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4), PUNTI = rgb(0.55, 0.55, 0.55);
    const p = doc.addPage([L, H]);
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const SZ = 10.5, INT = 19;

    /** Una riga: testo fisso e campi puntinati, con il valore sopra (blu). */
    const riga = (a, pezzi, sz = SZ) => {
      let x = SX;
      for (const pz of pezzi) {
        if (typeof pz === "string") {
          const g = pz.startsWith("**"), t = g ? pz.slice(2) : pz, f = g ? bold : reg;   // "**" = in grassetto
          p.drawText(t, { x, y: Y(a), size: sz, font: f, color: NERO }); x += largo(t, f, sz); continue;
        }
        const w = pz.w, val = pz.v === undefined || pz.v === null ? "" : String(pz.v);
        p.drawText("…".repeat(Math.max(2, Math.floor(w / largo("…", reg, sz)))), { x, y: Y(a), size: sz, font: reg, color: PUNTI });
        if (val) { let t = val; while (t && largo(t, reg, sz - 0.5) > w - 2) t = t.slice(0, -1); p.drawText(t, { x: x + 2, y: Y(a) + 3, size: sz - 0.5, font: reg, color: DATO }); }
        x += w;
      }
    };
    const centro = (t, a, f = bold, sz = 12) => p.drawText(t, { x: (L - largo(t, f, sz)) / 2, y: Y(a), size: sz, font: f, color: NERO });
    const sx = (t, a, f = reg, sz = SZ) => p.drawText(t, { x: SX, y: Y(a), size: sz, font: f, color: NERO });

    let a = 56;
    p.drawText("ALLEGATO E", { x: SX, y: Y(a - 12), size: 10, font: bold, color: NERO });
    centro("ATTESTAZIONE DI RISPONDENZA EX D.M. 16/1/2017", a + 10); a += 34;
    const dep = String(accordo.accordo.deposito_data || "").replace(/\./g, "/");
    riga(a, ["L’Organizzazione ", { w: 120 }, ", firmataria dell’Accordo territoriale per il Comune di ", { w: 60, v: accordo.accordo.comune }]); a += INT;
    riga(a, ["depositato il ", { w: 80, v: dep }, ", in persona di ", { w: 170 }, ","]); a += INT + 4;
    centro("PREMESSO CHE", a, bold, 11); a += INT;
    const ind = String(s.indirizzo || "").match(/^(.*?)[\s,]+(?:n\.?\s*)?(\d+\s*[a-zA-Z]?(?:\/\d+)?)$/);
    riga(a, ["il Sig. ", { w: 150, v: s.locatore }, " C.F.: ", { w: 120, v: (s.locatore_cf || "").toUpperCase() }, " residente a ", { w: 60 }]); a += INT;
    riga(a, ["in Via/P.za ", { w: 170 }, " n. ", { w: 30 }, " nella qualità di locatore dell’immobile/porzione"]); a += INT;
    riga(a, ["di immobile sito a ", { w: 80, v: s.citta }, " in Via/P.za ", { w: 150, v: ind ? ind[1] : s.indirizzo }, " n. ", { w: 32, v: ind ? ind[2] : "" }, ", piano ", { w: 22, v: s.piano }]); a += INT;
    riga(a, ["int. ", { w: 26, v: s.interno }, ", con contratto stipulato con il Sig. ", { w: 160, v: s.conduttore }, " C.F.: ", { w: 92, v: (s.conduttore_cf || "").toUpperCase() }]); a += INT;
    riga(a, ["residente a ", { w: 70 }, " in Via/P.za ", { w: 140 }, " il ", { w: 60 }, " e decorrenza il ", { w: 52 }]); a += INT;
    riga(a, ["registrato il ", { w: 60 }, " al n. ", { w: 50 }, " presso l’Agenzia delle entrate / in corso di registrazione, essendo i"]); a += INT;
    sx("termini non ancora scaduti, ha presentato richiesta per l’attestazione ex D.M. 16/1/2017, dichiarando, sotto la", a); a += INT - 4;
    sx("sua responsabilità, i seguenti elementi:", a); a += INT + 4;

    centro("CALCOLO DELLA SUPERFICIE ai sensi dell’Accordo territoriale", a, bold, 10.5); a += INT;
    const sup = r.superficie, voce = (k) => (sup ? sup.righe.find((x) => x.chiave === k) : null);
    const linea = (testo, mq, coeff, conv) => {
      sx(testo, a, reg, 9.5);
      p.drawText("mq.", { x: 380, y: Y(a), size: 9.5, font: reg, color: NERO }); if (mq) p.drawText(v(mq), { x: 398, y: Y(a) + 2, size: 9.5, font: reg, color: DATO });
      p.drawText(`x ${coeff}`, { x: 430, y: Y(a), size: 9, font: reg, color: coeff ? DATO : NERO });
      p.drawText("= mq.", { x: 486, y: Y(a), size: 9.5, font: reg, color: NERO }); if (conv) p.drawText(v(conv), { x: 512, y: Y(a) + 2, size: 9.5, font: reg, color: DATO });
      a += INT - 3;
    };
    const vani = voce("vani"), accC = voce("accessori_comunicanti"), accN = voce("accessori_non"), bal = voce("balconi"), balN = voce("balconi_non"), sco = voce("scoperta");
    const somma = (...xs) => xs.filter(Boolean).reduce((t, x) => t + (x.mq || 0), 0), conv = (...xs) => xs.filter(Boolean).reduce((t, x) => t + (x.convenzionale || 0), 0);
    linea("Superficie calpestabile appartamento:", vani && vani.mq, "1", vani && vani.convenzionale);
    linea("Superficie vani accessori (soffitte, cantine, mezzanini e simili):", somma(accC, accN), somma(accC, accN) ? "0,50/0,25" : "", conv(accC, accN));
    linea("Balconi, terrazze, cantine, box e simili:", somma(bal, balN), somma(bal, balN) ? "0,30/0,10" : "", conv(bal, balN));
    linea("Superficie area scoperta, pertinenza esclusiva:", sco && sco.mq, sco && sco.mq ? "0,10/0,02" : "", sco && sco.convenzionale);
    p.drawText("TOTALE SUPERFICIE mq.", { x: 330, y: Y(a), size: 10, font: bold, color: NERO });
    p.drawText("……………", { x: 455, y: Y(a), size: 10, font: reg, color: PUNTI });
    if (sup) p.drawText(v(sup.totale), { x: 460, y: Y(a) + 3, size: 10, font: reg, color: DATO });
    a += INT;
    if (sup && (sup.totale !== sup.lorda || sup.pertinenze !== sup.pertinenze_usate))
      { p.drawText(`(${sup.note.join(" ")})`.slice(0, 150), { x: SX, y: Y(a - 6), size: 7.5, font: reg, color: GRIGIO }); a += 8; }

    sx("ELEMENTI E PARAMETRI OGGETTIVI:", a, bold, 10); a += INT - 2;
    const el = (s.elementi || []).map((on, i) => (on ? `${i + 1}. ${accordo.elementi[i]}` : null)).filter(Boolean);
    const testoEl = el.join("; ") + (s.epoca ? `; epoca: ${{ dopo_2000: "dopo l'1/1/2000", dal_1970: "1970-1999", prima_1970: "prima del 1970" }[s.epoca]}` : "") +
      (r.aumento ? `; ${r.aumento.nome} +${v(r.aumento.percento, 0)}%` : "");
    let rr = "", righe = 0;
    for (const w of testoEl.split(" ")) {
      const prova = rr ? rr + " " + w : w;
      if (largo(prova, reg, 8.6) > DX - SX && rr) { if (righe < 5) p.drawText(rr, { x: SX, y: Y(a), size: 8.6, font: reg, color: DATO }); righe++; a += 11.5; rr = w; } else rr = prova;
    }
    if (rr && righe < 5) { p.drawText(rr, { x: SX, y: Y(a), size: 8.6, font: reg, color: DATO }); a += 11.5; }
    a += 8;
    const mz = r.microzona ? `${r.microzona[0]} – ${r.microzona[1]}` : "";
    riga(a, ["**ZONA ", { w: 200, v: mz }, "  ", "**FASCIA DI OSCILLAZIONE MIN/MAX ", { w: 30, v: r.fascia_base ? v(r.fascia_base[0]) : "" }, "/", { w: 30, v: r.fascia_base ? v(r.fascia_base[1]) : "" }], 9.5); a += INT;
    riga(a, ["**ELEMENTI E PARAMETRI n. ", { w: 30, v: String(r.elementi) }, "  ", "**SUBFASCIA min/max ", { w: 44, v: r.fascia ? v(r.fascia[0], 3) : "" }, "/", { w: 44, v: r.fascia ? v(r.fascia[1], 3) : "" },
      "  Valore applicato € ", { w: 50, v: r.valore !== null ? v(r.valore, 3) : "" }], 9.5); a += INT;
    const mensile = r.canone_pattuito !== null ? r.canone_pattuito : r.canone;
    const mqLocati = sup ? sup.totale : null;
    const valMese = mensile !== null && mqLocati ? mensile / mqLocati : null;
    riga(a, ["**CANONE : € mq/mese ", { w: 50, v: valMese !== null ? v(valMese, 3) : "" }, " x mq. ", { w: 44, v: mqLocati ? v(mqLocati) : "" }, "= € ", { w: 58, v: mensile !== null ? v(mensile) : "" },
      " mensili = € ", { w: 64, v: mensile !== null ? v(mensile * 12) : "" }, " annuo"], 9.5); a += INT + 6;

    sx("Tutto ciò premesso, l’Organizzazione ……………, come sopra rappresentata, sulla base degli elementi", a); a += INT - 4;
    sx("oggettivi sopra dichiarati, anche ai fini dell’ottenimento di eventuali agevolazioni fiscali,", a); a += INT;
    centro("ATTESTA", a, bold, 11.5); a += INT;
    sx("che i contenuti economici e normativi del contratto sopra descritto corrispondono a quanto previsto", a); a += INT - 4;
    riga(a, ["dall’Accordo territoriale vigente per il Comune di ", { w: 80, v: accordo.accordo.comune }, ", depositato in data ", { w: 80, v: dep }, "."]); a += INT + 14;
    sx("Il dichiarante", a); p.drawText("p. l’Organizzazione", { x: 370, y: Y(a), size: SZ, font: reg, color: NERO }); a += 24;
    sx("………………………………….", a); p.drawText("……………………………………….", { x: 370, y: Y(a), size: SZ, font: reg, color: NERO });

    // il riepilogo del calcolo, in grigio: non fa parte del modello
    a = H - 112;
    if (r.fascia && r.canone_massimo !== null) {
      p.drawText("Calcolo di LocaOnLine (non fa parte del modello):", { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO }); a += 10;
      p.drawText(`Canone base € ${v(r.canone_base)}${r.aumento ? `, ${r.aumento.nome} +${v(r.aumento.percento, 0)}%` : ""}; canone massimo € ${v(r.canone_massimo)} al mese.`, { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO });
    }
    const t = "Allegato E dell'Accordo territoriale per il Comune di Palermo (depositato il 23/01/2020), compilato con LocaOnLine";
    p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    if (Marchio) Marchio.disegna(doc, ris.PDFLib, p,
      await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }),
      { cx: L / 2, y: 14, campagna: "scheda_canone_palermo" });
    return doc.save();
  }

  return { creaPDF };
});
