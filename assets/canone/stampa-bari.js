/*
 * La scheda del canone di Bari in PDF: la scheda della zona dell'allegato 1
 * dell'Accordo territoriale del 13/03/2024 ("Elementi per la determinazione
 * della fascia del canone di locazione" e fasce di oscillazione), con le
 * caselle segnate, più il calcolo del canone e le firme. Una pagina A4.
 *
 *   StampaBari.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                      accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaBari = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 56, DX = 540;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));
  const NUMERI = ["", "UNO", "DUE", "TRE", "QUATTRO", "CINQUE", "SEI", "SETTE", "OTTO"];

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Bari - Elementi per la determinazione della fascia");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const p = doc.addPage([L, H]);
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const tx = (t, x, a, { f = reg, sz = 9.5, c = NERO } = {}) => { p.drawText(String(t), { x, y: Y(a), size: sz, font: f, color: c }); return x + largo(t, f, sz); };
    const centro = (t, a, f, sz, sotto) => {
      const x = (L - largo(t, f, sz)) / 2; tx(t, x, a, { f, sz });
      if (sotto) p.drawLine({ start: { x, y: Y(a) - 2 }, end: { x: x + largo(t, f, sz), y: Y(a) - 2 }, thickness: 0.9, color: NERO });
    };
    const riga = (a, pezzi, x0 = SX, sz = 9) => {
      let x = x0;
      for (const pz of pezzi) {
        if (typeof pz === "string") { x = tx(pz, x, a, { sz }); continue; }
        p.drawLine({ start: { x, y: Y(a) - 1.5 }, end: { x: x + pz.w, y: Y(a) - 1.5 }, thickness: 0.5, color: NERO });
        if (pz.v) { let t = String(pz.v); while (t && largo(t, reg, sz) > pz.w - 3) t = t.slice(0, -1); tx(t, x + 2, a - 0.5, { sz, c: DATO }); }
        x += pz.w;
      }
    };
    const z = r.zona;

    let a = 52;
    centro(z ? `ZONA ${z[0]}: ${z[1].toUpperCase()}` : "ZONA: ……………", a, bold, 14, true); a += 18;
    centro(`Fogli di mappa catastale numeri ${z ? z[2] : "……"}`.slice(0, 120), a, bold, 8.5); a += 18;
    centro("ELEMENTI PER LA DETERMINAZIONE DELLA FASCIA", a, bold, 10.5); a += 13;
    centro("DEL CANONE DI LOCAZIONE", a, bold, 10.5); a += 16;
    const el = s.elementi || [];
    accordo.elementi.forEach((t, i) => {
      const si = !!el[i];
      p.drawRectangle({ x: SX + 6, y: Y(a) - 0.5, width: 6.5, height: 6.5, borderColor: NERO, borderWidth: 0.6 });
      if (si) tx("X", SX + 7, a - 0.2, { f: bold, sz: 6.8, c: DATO });
      let testo = t.charAt(0).toLowerCase() + t.slice(1);
      while (largo(testo, reg, 8.8) > DX - SX - 22) testo = testo.slice(0, -1);
      tx(testo, SX + 20, a, { sz: 8.8, f: si ? bold : reg, c: si ? DATO : NERO });
      a += 11.6;
    });
    a += 6;
    if (z) {
      const fasce = z[3];
      fasce.forEach((f, i) => {
        const fino = i ? fasce[i - 1][1] - 1 : null;
        const quanti = !f[1] ? `FINO A ${NUMERI[fino] || fino} ELEMENTI` : i === 0 ? `OLTRE ${NUMERI[f[1] - 1] || f[1] - 1} ELEMENTI` : f[1] === fino ? `${NUMERI[f[1]] || f[1]} ELEMENTI` : `DA ${NUMERI[f[1]] || f[1]} A ${NUMERI[fino] || fino} ELEMENTI`;
        const nostra = r.fascia && r.fascia[0] === f[0];
        const t1 = `FASCIA ${f[0]} - ${quanti}`, t2 = `MINIMO ${v(f[2])} MQ  MASSIMO ${v(f[3])} MQ`;
        if (nostra) p.drawRectangle({ x: SX + 2, y: Y(a + 13), width: 250, height: 24, borderColor: DATO, borderWidth: 1 });
        tx(t1, SX + 6, a, { f: bold, sz: 8.6, c: nostra ? DATO : NERO }); tx(t2, SX + 6, a + 10, { sz: 8.6, c: nostra ? DATO : NERO });
        a += 26;
      });
      a -= 2;
    }
    // il calcolo, a destra delle fasce
    const xc = 330; let b = a - (z ? z[3].length * 26 : 0) + 2;
    const sup = r.superficie;
    const righe = [
      ["Elementi presenti", String(r.elementi)],
      ["Fascia", r.fascia ? `${r.fascia[0]}${r.promossa ? ` (${r.promossa})` : ""}` : ""],
      ["Superficie convenzionale", sup ? `${v(sup.totale)} mq` : ""],
      ...r.maggiorazioni.map((m) => [m.nome.replace(/ \(passato in fascia A\)/, ""), `+${m.percento}%`]),
      ["Valore applicato al mq", r.valore !== null ? `€ ${v(r.valore, 3)}` : ""],
      ...(r.quota !== null ? [["Quota della porzione", `${v(r.quota * 100)}%`]] : []),
      ["Canone mensile massimo", r.canone_massimo !== null ? `€ ${v(r.canone_massimo)}` : ""],
      ["Canone mensile pattuito", r.canone_pattuito !== null ? `€ ${v(r.canone_pattuito)}` : ""]];
    for (const [k, val] of righe) {
      tx(k, xc, b, { sz: 8.4 });
      if (val) tx(val, DX - largo(val, reg, 8.4), b, { sz: 8.4, c: DATO });
      b += 11;
    }
    a = Math.max(a, b) + 10;
    riga(a, ["Locatore ", { w: 170, v: s.locatore }, "  Conduttore ", { w: 170, v: s.conduttore }]); a += 15;
    riga(a, ["Immobile in Bari, ", { w: 190, v: s.indirizzo }, "  Fg. ", { w: 34, v: s.foglio }, " Part. ", { w: 40, v: s.particella }, " Sub. ", { w: 28, v: s.subalterno }]); a += 15;
    riga(a, ["Contratto ", { w: 120, v: { agevolato: `agevolato ${s.durata_anni || 3}+2`, transitorio: "transitorio", studenti: "studenti universitari" }[s.tipo || "agevolato"] },
      "  Superficie convenzionale mq ", { w: 50, v: sup ? v(sup.totale) : "" }]); a += 20;
    riga(a, ["Il locatore ", { w: 160 }, "        Il conduttore ", { w: 160 }]); a += 14;

    p.drawText("Calcolo di LocaOnLine (non fa parte del modello): soglie delle fasce lette come contigue; maggiorazioni applicate in modo progressivo (punti 3 e 4).",
      { x: SX, y: Y(a), size: 6.8, font: reg, color: GRIGIO });
    const t = "Allegato 1 dell'Accordo territoriale per il Comune di Bari (sottoscritto il 13/03/2024, depositato il 26/03/2024), compilato con LocaOnLine";
    p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    if (Marchio) Marchio.disegna(doc, ris.PDFLib, p,
      await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }),
      { cx: L / 2, y: 14, campagna: "scheda_canone_bari" });
    return doc.save();
  }

  return { creaPDF };
});
