/*
 * Il contratto in Word (.docx), dai blocchi di Contratto.genera: stessa
 * impaginazione del PDF e dei modelli dell'UPPI, da modificare in Word.
 *
 *   WordContratto.crea(docx, logo, blocchi) -> Promise<Blob> (browser) | Promise<Buffer> (Node)
 *
 * docx: la libreria docx (globale "docx" nel browser), logo: i byte del PNG.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.WordContratto = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CARATTERE = "Times New Roman";
  const cm = (n) => Math.round(n * 567);          // centimetri in twip

  const PROPORZIONE_LOGO = 720 / 660;     // logo-locaonline.png

  /** La larghezza stimata di un testo in Times New Roman (in punti). */
  function larghezzaStimata(testo, s, grassetto) {
    let w = 0;
    for (const c of testo) {
      w += /[A-Z]/.test(c) ? (/[MW]/.test(c) ? 0.89 : /[IJ]/.test(c) ? 0.36 : 0.69)
         : /[a-z]/.test(c) ? (/[mw]/.test(c) ? 0.74 : /[ijlft]/.test(c) ? 0.29 : 0.47)
         : /[0-9]/.test(c) ? 0.5 : c === " " ? 0.25 : /[°'.,:;()\/-]/.test(c) ? 0.31 : 0.5;
    }
    return w * s * (grassetto ? 1.06 : 1);
  }

  /** Le righe del riquadro (a capo dove serve) e le altezze di riquadro e
   *  logo, come nel PDF: logo fra 88 e 110 punti, stessa altezza del riquadro. */
  function geometriaIntestazione(righe, misura) {
    const largh = misura || larghezzaStimata;
    const largoTesto = cm(17) / 20;                       // punti
    const aCapo = (largo) => {
      const out = [];
      for (const r of righe) {
        const s = r.s || 11;
        if (largh(r.testo, s, r.g) <= largo) { out.push({ ...r, s }); continue; }
        const parole = r.testo.split(" ");
        let migliore = null;
        for (let k = 1; k < parole.length; k++) {
          const a = parole.slice(0, k).join(" "), z = parole.slice(k).join(" ");
          const wa = largh(a, s, r.g), wz = largh(z, s, r.g);
          if (wa <= largo && wz <= largo && (!migliore || Math.abs(wa - wz) < migliore.d)) migliore = { a, z, d: Math.abs(wa - wz) };
        }
        if (migliore) { out.push({ ...r, s, testo: migliore.a }); out.push({ ...r, s, testo: migliore.z }); }
        else out.push({ ...r, s });
      }
      return out;
    };
    let logo = 88, rr = [], altezza = 88;
    for (let passo = 0; passo < 4; passo++) {
      const largo = largoTesto - (logo * PROPORZIONE_LOGO + 10) - 10 - 4;   // margini della cella e un po' di riserva
      rr = aCapo(largo);
      altezza = Math.max(88, rr.reduce((t, r) => t + r.s * 1.16, 0) + 16);
      const nuovo = Math.min(altezza, 110);
      if (Math.abs(nuovo - logo) < 0.5) break;
      logo = nuovo;
    }
    return { righe: rr, altezza, logo: Math.min(altezza, logo) };
  }

  /** misura (facoltativa): la larghezza vera di un testo in Times New Roman,
   *  (testo, corpo, grassetto) -> punti; senza, una stima prudente. */
  function crea(X, logo, blocchi, misura) {
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType,
            BorderStyle, ImageRun, Footer, PageNumber, VerticalAlign, TableLayoutType, HeightRule } = X;
    const corsa = (testo, { g = false, s = 11, sottolinea = false } = {}) =>
      new TextRun({ text: testo, bold: g, size: s * 2, font: CARATTERE, underline: sottolinea ? {} : undefined });
    const nessunBordo = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                          left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };
    const bordo = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
    const figli = [];

    for (const b of blocchi) {
      if (b.t === "intestazione") {
        // logo e riquadro della stessa altezza: la riga della tabella e' alta
        // esattamente quanto il testo del riquadro (stimato con le proporzioni
        // del Times New Roman), e il logo prende quell'altezza
        const g = geometriaIntestazione(b.righe, misura);
        // il logo un punto e mezzo meno alto della riga: alto esattamente come
        // la riga, Word e LibreOffice lo taglierebbero
        const latoPx = Math.round((g.logo - 1.5) * 96 / 72);
        const larghezzaLogo = Math.round((g.logo * PROPORZIONE_LOGO + 10) * 20);
        const celle = [
          new TableCell({ width: { size: larghezzaLogo, type: WidthType.DXA }, borders: nessunBordo, verticalAlign: VerticalAlign.CENTER,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: logo ? [new ImageRun({ type: "png", data: logo,
              transformation: { width: Math.round(latoPx * PROPORZIONE_LOGO), height: latoPx } })] : [] })] }),
          new TableCell({ width: { size: cm(17) - larghezzaLogo, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
            borders: { top: bordo, bottom: bordo, left: bordo, right: bordo },
            margins: { top: 0, bottom: 0, left: 100, right: 100 },
            children: g.righe.map((r) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
              children: [corsa(r.testo, { g: r.g, s: r.s, sottolinea: r.sottolinea })] })) }),
        ];
        figli.push(new Table({ rows: [new TableRow({ children: celle, height: { value: Math.round(g.altezza * 20), rule: HeightRule.ATLEAST } })],
          layout: TableLayoutType.FIXED, width: { size: cm(17), type: WidthType.DXA }, columnWidths: [larghezzaLogo, cm(17) - larghezzaLogo], borders: nessunBordo }));
        figli.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
      } else if (b.t === "centro") {
        figli.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
          children: [corsa(b.testo, { g: b.g, s: b.s || 12 })] }));
      } else if (b.t === "titolo") {
        figli.push(new Paragraph({ keepNext: true, spacing: { before: 100, after: 40 }, children: [corsa(b.testo, { g: true, s: 12 })] }));
      } else if (b.t === "par") {
        figli.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 90 }, keepNext: !!b.insieme,
          indent: b.rientro ? { left: 280 * (Number(b.rientro) || 1) } : undefined,
          children: b.parti.map((p) => corsa(p.testo, { g: p.g, s: b.s || 11 })) }));
      } else if (b.t === "spazio") {
        figli.push(new Paragraph({ spacing: { after: Math.round((b.h || 6) * 20) }, keepNext: !!b.insieme, children: [] }));
      } else if (b.t === "firma_centro") {
        figli.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120 }, children: [corsa(b.testo, { g: true, s: 11.5 })] }));
      } else if (b.t === "firme") {
        const riga = (chi) => {
          if (typeof chi === "string") chi = chi ? { ruolo: chi, nome: "" } : null;
          return new TableCell({ width: { size: cm(8.5), type: WidthType.DXA }, borders: nessunBordo,
            children: chi ? [
              new Paragraph({ keepNext: true, children: [corsa(chi.ruolo + (chi.nome ? " " : "")), ...(chi.nome ? [corsa(chi.nome, { g: true })] : [])] }),
              new Paragraph({ keepNext: true, spacing: { before: 280, after: 160 }, children: [corsa("_______________________________")] }),
            ] : [new Paragraph({ children: [] })] });
        };
        figli.push(new Table({ layout: TableLayoutType.FIXED, width: { size: cm(17), type: WidthType.DXA }, columnWidths: [cm(8.5), cm(8.5)],
          borders: nessunBordo, rows: b.righe.map(([sx, dx]) => new TableRow({ cantSplit: true, children: [riga(sx), riga(dx)] })) }));
        figli.push(new Paragraph({ spacing: { after: 60 }, keepNext: !!b.insieme, children: [] }));
      }
    }

    const documento = new Document({
      creator: "LocaOnLine - locaonline.it", title: "Contratto di locazione",
      styles: { default: { document: { run: { font: CARATTERE, size: 22 } } } },
      sections: [{
        properties: { page: { size: { width: cm(21), height: cm(29.7) },
          margin: { top: cm(1.5), bottom: cm(2), left: cm(2), right: cm(2), footer: cm(0.8) } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ children: [PageNumber.CURRENT], font: CARATTERE, size: 20 })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({
            text: "Compilato con LocaOnLine \u00b7 registra il contratto online su locaonline.it", font: CARATTERE, size: 15, color: "666E78" })] })] }) },
        children: figli,
      }],
    });
    return typeof Blob !== "undefined" && typeof window !== "undefined" ? Packer.toBlob(documento) : Packer.toBuffer(documento);
  }

  return { crea };
});
