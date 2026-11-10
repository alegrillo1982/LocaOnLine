/*
 * Il richiamo a LocaOnLine in fondo ai PDF (scheda del canone e contratto):
 * a sinistra l'icona, a destra "Registra il tuo contratto con LocaOnLine" e,
 * sotto, sito e WhatsApp. Si tocca dal telefono: il blocco porta alla
 * pagina dei servizi (con i parametri utm, per vederlo in GA4), il numero
 * apre WhatsApp.
 *
 *   const m = await MarchioPdf.prepara(doc, PDFLib, { icona, regolare, grassetto });
 *   MarchioPdf.disegna(doc, PDFLib, pagina, m, { cx, y, campagna });
 *
 * icona: i byte del PNG; regolare e grassetto: i byte del carattere Carlito
 * (oppure "font": { reg, bold } gia' incorporati nel documento, come nella
 * scheda). Il carattere va incorporato: la Helvetica "di serie" alcuni
 * lettori la sostituiscono e il grassetto sparisce.
 * cx: il centro del blocco; y: la riga di base della seconda riga di testo.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.MarchioPdf = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SITO = "https://locaonline.it/servizi.html?utm_source=pdf&utm_medium=documento&utm_campaign=";
  const WHATSAPP = "https://wa.me/39068848163";
  const LATO = 22, SPAZIO = 7, S1 = 10.5, S2 = 8.5;

  async function prepara(doc, PDFLib, { icona, regolare, grassetto, font } = {}) {
    const incorpora = (byte, riserva) => (byte ? doc.embedFont(byte, { subset: true }) : doc.embedFont(riserva));
    return {
      reg: font ? font.reg : await incorpora(regolare, PDFLib.StandardFonts.Helvetica),
      bold: font ? font.bold : await incorpora(grassetto, PDFLib.StandardFonts.HelveticaBold),
      icona: icona ? await doc.embedPng(icona) : null,
    };
  }

  /** Un'area cliccabile sulla pagina che apre un indirizzo web. */
  function collegamento(doc, PDFLib, pagina, rettangolo, url) {
    const annotazione = doc.context.register(doc.context.obj({
      Type: "Annot", Subtype: "Link", Rect: rettangolo, Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFLib.PDFString.of(url) },
    }));
    pagina.node.addAnnot(annotazione);
  }

  function disegna(doc, PDFLib, pagina, m, { cx, y, campagna = "pdf" }) {
    const { rgb } = PDFLib;
    const SCURO = rgb(15 / 255, 42 / 255, 74 / 255), BLU = rgb(46 / 255, 124 / 255, 246 / 255), GRIGIO = rgb(0.4, 0.45, 0.5);
    const riga1 = [["Registra il tuo contratto con ", m.bold, SCURO], ["Loca", m.bold, SCURO], ["OnLine", m.bold, BLU]];
    const riga2 = [["Ci pensiamo noi all'Agenzia delle Entrate, tutto online  ·  ", m.reg, GRIGIO],
                   ["locaonline.it", m.bold, SCURO], ["  ·  WhatsApp 06 884 8163", m.reg, GRIGIO]];
    const largo = (riga, s) => riga.reduce((w, [t, f]) => w + f.widthOfTextAtSize(t, s), 0);
    const w1 = largo(riga1, S1), w2 = largo(riga2, S2);
    const conIcona = m.icona ? LATO + SPAZIO : 0;
    const x0 = cx - (conIcona + Math.max(w1, w2)) / 2, xt = x0 + conIcona;

    if (m.icona) pagina.drawImage(m.icona, { x: x0, y: y - 3.5, width: LATO, height: LATO });
    const scrivi = (riga, s, base) => riga.reduce((x, [t, f, colore]) => {
      pagina.drawText(t, { x, y: base, size: s, font: f, color: colore });
      return x + f.widthOfTextAtSize(t, s);
    }, xt);
    scrivi(riga1, S1, y + 11.5);
    scrivi(riga2, S2, y);

    // tutto il blocco porta al sito; il numero di WhatsApp (aggiunto dopo,
    // quindi sopra) apre la chat
    const wWa = m.reg.widthOfTextAtSize("WhatsApp 06 884 8163", S2);
    const fine = xt + w2;
    collegamento(doc, PDFLib, pagina, [x0 - 1, y - 4, Math.max(xt + w1, fine - wWa - 8), y + LATO - 2], SITO + encodeURIComponent(campagna));
    collegamento(doc, PDFLib, pagina, [fine - wWa - 1, y - 2.5, fine + 1, y + 7], WHATSAPP);
  }

  return { prepara, disegna };
});
