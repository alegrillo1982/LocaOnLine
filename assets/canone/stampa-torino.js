/*
 * La scheda del canone di Torino in PDF: l'allegato 9 dell'Accordo
 * territoriale (06/12/2022, aggiornato al 15/04/2024), "Attestazione di
 * congruità", compilata con i dati della scheda. La certificazione delle
 * associazioni resta in bianco. Una pagina A4.
 *
 *   StampaTorino.creaPDF({ PDFLib, fontkit, regolare, grassetto, icona, sansRegolare, sansGrassetto },
 *                        accordo, scheda, risultato) -> Promise<Uint8Array>
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.StampaTorino = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89, SX = 62, DX = 533;
  const v = (n, c = 2) => (n === null || n === undefined || n === "" ? "" :
    Number(n).toLocaleString("it-IT", { minimumFractionDigits: c, maximumFractionDigits: c }));
  const ARTICOLI = { agevolato: ["2", "3"], transitorio: ["5", "1"], studenti: ["5", "3"] };

  async function creaPDF(ris, accordo, s, r) {
    const { PDFDocument, rgb } = ris.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(ris.fontkit);
    const reg = await doc.embedFont(ris.regolare, { subset: true });
    const bold = await doc.embedFont(ris.grassetto, { subset: true });
    doc.setTitle("Accordo territoriale Torino - Attestazione di congruità");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0), DATO = rgb(0.05, 0.12, 0.42), GRIGIO = rgb(0.4, 0.4, 0.4);
    const p = doc.addPage([L, H]);
    const Y = (a) => H - a;
    const largo = (t, f, sz) => f.widthOfTextAtSize(String(t), sz);
    const SZ = 11, INT = 22;

    /** Una riga del modulo: pezzi di testo fisso e campi da riempire (con o senza valore). */
    const riga = (a, pezzi) => {
      let x = SX;
      for (const pz of pezzi) {
        if (typeof pz === "string") { p.drawText(pz, { x, y: Y(a), size: SZ, font: reg, color: NERO }); x += largo(pz, reg, SZ); continue; }
        const w = pz.w, val = pz.v === undefined || pz.v === null ? "" : String(pz.v);
        p.drawText("…".repeat(Math.max(2, Math.floor(w / largo("…", reg, SZ)))), { x, y: Y(a), size: SZ, font: reg, color: rgb(0.55, 0.55, 0.55) });
        if (val) {
          let t = val; const sz = SZ - 0.5;
          while (t && largo(t, reg, sz) > w - 2) t = t.slice(0, -1);
          p.drawText(t, { x: x + 2, y: Y(a) + 3, size: sz, font: reg, color: DATO });
        }
        x += w;
      }
    };
    const centro = (t, a, f = bold, sz = 14) => p.drawText(t, { x: (L - largo(t, f, sz)) / 2, y: Y(a), size: sz, font: f, color: NERO });

    let a = 60;
    p.drawText("Allegato 9", { x: DX - largo("Allegato 9", reg, 10), y: Y(a - 14), size: 10, font: reg, color: NERO });
    centro("ATTESTAZIONE DI CONGRUITÀ", a + 10); a += 30;
    for (const t of ["(Valida per contratto di locazione abitativa agevolata art. 2, comma 3, per",
      "contratto di Locazione abitativa agevolata di natura transitoria art. 5, comma 1 e",
      "per contratto di Locazione abitativa agevolata per studenti universitari art. 5,", "comma 3)"]) { centro(t, a, reg, 11); a += 14; }
    a += 20;
    riga(a, ["I sottoscritti: ", { w: 165, v: s.locatore }, " - ", { w: 230, v: s.conduttore }]); a += INT + 8;
    riga(a, ["C.F. ", { w: 140, v: (s.locatore_cf || "").toUpperCase() }, " nato/a ", { w: 110 }, " (", { w: 22 }, ") il ", { w: 62 }]); a += INT + 8;
    riga(a, ["C.F. ", { w: 140, v: (s.conduttore_cf || "").toUpperCase() }, " nato/a ", { w: 110 }, " (", { w: 22 }, ") il ", { w: 62 }]); a += INT + 10;

    const [art, comma] = ARTICOLI[s.tipo] || ["", ""];
    const durata = s.tipo === "agevolato" ? [String(Math.min(6, Number(s.durata_anni) || 3)), "2"] : ["", ""];
    riga(a, ["avendo sottoscritto in data ", { w: 80 }, " un contratto di locazione agevolata ai sensi dell’art."]); a += INT;
    riga(a, [{ w: 30, v: art }, ", c. ", { w: 26, v: comma }, " Lg . 431/98, della durata di anni ", { w: 26, v: durata[0] }, "+", { w: 26, v: durata[1] }, ", per un appartamento in"]); a += INT;
    const m = String(s.indirizzo || "").match(/^(.*?)[\s,]+(?:n\.?\s*)?(\d+\s*[a-zA-Z]?(?:\/\d+)?)$/);
    riga(a, [{ w: 220, v: m ? m[1] : s.indirizzo }, " n", { w: 50, v: m ? m[2] : "" }, " a ", { w: 140, v: s.citta }, ","]); a += INT;

    const zona = s.zona ? (s.zona === "P" ? "pregio" : `${s.zona} ${accordo.zone[s.zona]}`) + (r.pregio && r.zona_calcolo ? ` (criteri area ${r.zona_calcolo})` : "") : "";
    const extra = r.piccoli_perc ? `${r.piccoli_perc}` : r.minimo_80 ? "min. 80,4 mq" : "";
    riga(a, ["dichiarano che il canone mensile di locazione, per mq. convenzionali ", { w: 50, v: r.superficie !== null ? v(r.superficie) : "" }, " + ", { w: 40, v: extra }, "%"]); a += INT;
    riga(a, ["(maggiorazione prevista per i mq.), in zona ", { w: 150, v: zona }, ", con la presenza di"]); a += INT;
    const elenco = s.tipo === "studenti"
      ? (s.elementi_studenti || []).map((on, i) => (on ? String(i + 1) : "")).filter(Boolean).join(", ")
      : Object.entries(s.elementi || {}).filter(([, on]) => on).map(([k]) => k)
          .sort((x, y) => parseInt(x, 10) - parseInt(y, 10) || x.localeCompare(y)).join(", ") + (Number(s.servizi_extra) ? `, 15 (×${s.servizi_extra})` : "");
    riga(a, ["n. ", { w: 34, v: r.elementi ? String(r.elementi) : "" }, " elementi (ovvero: ", { w: 270, v: elenco }, " elenco elementi"]); a += INT;
    riga(a, [{ w: 160, v: s.tipo === "studenti" ? "" : `punteggio ${v(r.punti, r.punti % 1 ? 1 : 0)}, ${r.sub}^ sub-fascia` }, "), è stato stabilito in € ", { w: 60, v: r.valore !== null ? v(r.valore) : "" }, " al mq., al quale sarà applicato"]); a += INT;
    const motivi = r.correttivi.map((c) => `${c.nome} ${c.percento > 0 ? "+" : "−"}${v(Math.abs(c.percento), c.percento % 1 ? 1 : 0)}%`).join("; ");
    riga(a, ["una maggiorazione del ", { w: 50, v: r.correttivi.length ? `${v(r.totale_perc, r.totale_perc % 1 ? 1 : 0)}` : "" }, "% per ", { w: 255 }]); a += INT;
    // le maggiorazioni scritte per esteso, anche su due righe, sopra la riga da riempire
    { const parti = []; let rr = "";
      for (const w of motivi.split(" ")) { const prova = rr ? rr + " " + w : w; if (largo(prova, reg, SZ - 1.5) > DX - SX && rr) { parti.push(rr); rr = w; } else rr = prova; }
      if (rr) parti.push(rr);
      for (const t of parti.length ? parti : [""]) { riga(a, [{ w: DX - SX }]); if (t) p.drawText(t, { x: SX + 2, y: Y(a) + 3, size: SZ - 1.5, font: reg, color: DATO }); a += INT; } }
    const canone = r.canone_pattuito !== null ? r.canone_pattuito : r.canone;
    riga(a, ["(specificare maggiorazioni: Cert. Energetica, lavori straordinari, arredamento, etc.)."]); a += INT;
    riga(a, ["Il canone così calcolato corrisponde"]); a += INT;
    riga(a, ["complessivamente ad € ", { w: 80, v: canone !== null ? v(canone) : "" }, " in conformità all'Accordo depositato presso il Comune"]); a += INT;
    const dep = String(accordo.accordo.deposito_data || "").replace(/\./g, "/");
    riga(a, ["di ", { w: 150, v: accordo.accordo.comune }, " il ", { w: 90, v: dep }]); a += INT + 20;

    p.drawText("IL LOCATORE", { x: SX + 20, y: Y(a), size: SZ, font: reg, color: NERO });
    p.drawText("in fede", { x: (L - largo("in fede", reg, SZ)) / 2, y: Y(a), size: SZ, font: reg, color: NERO });
    p.drawText("IL CONDUTTORE", { x: DX - 20 - largo("IL CONDUTTORE", reg, SZ), y: Y(a), size: SZ, font: reg, color: NERO });
    a += 50;

    centro("Certificazione di applicazione dei parametri di cui all’Accordo Territoriale", a, bold, 12); a += 22;
    const cert = "Le Associazioni della proprietà e dell’inquilinato dichiarano che il canone di locazione, pattuito sulla base degli elementi oggettivi dichiarati dalle parti contrattuali e della documentazione presentata, rientra nei parametri previsti dell’Accordo Territoriale sottoscritto presso il Comune di …………..……………… in data ….../……./…………….";
    let rr = "";
    for (const w of cert.split(" ")) { const prova = rr ? rr + " " + w : w; if (largo(prova, reg, 10.5) > DX - SX) { p.drawText(rr, { x: SX, y: Y(a), size: 10.5, font: reg, color: NERO }); a += 15; rr = w; } else rr = prova; }
    p.drawText(rr, { x: SX, y: Y(a), size: 10.5, font: reg, color: NERO }); a += 34;
    p.drawText("ASSOCIAZIONE PROPRIETÀ", { x: SX + 10, y: Y(a), size: SZ, font: reg, color: NERO });
    p.drawText("SINDACATO INQUILINI", { x: DX - 10 - largo("SINDACATO INQUILINI", reg, SZ), y: Y(a), size: SZ, font: reg, color: NERO });

    // il riepilogo del calcolo, in grigio: non fa parte del modello
    a = H - 120;
    const note = [];
    if (r.fascia) note.push(`Fascia: da € ${v(r.fascia[0])} a € ${v(r.fascia[1])} al mq al mese; mq convenzionali ${r.mq_convenzionali !== null ? v(r.mq_convenzionali) : "—"}; canone base € ${r.canone_base !== null ? v(r.canone_base) : "—"}; canone massimo € ${r.canone_massimo !== null ? v(r.canone_massimo) : "—"} al mese.`);
    if (note.length) {
      p.drawText("Calcolo di LocaOnLine (non fa parte del modello):", { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO }); a += 10;
      for (const t of note) p.drawText(t, { x: SX, y: Y(a), size: 7.5, font: reg, color: GRIGIO });
    }
    const t = "Allegato 9 dell'Accordo territoriale per il Comune di Torino (06/12/2022, aggiornato al 15/04/2024), compilato con LocaOnLine";
    p.drawText(t, { x: (L - largo(t, reg, 6.5)) / 2, y: 44, size: 6.5, font: reg, color: GRIGIO });
    const Marchio = ris.marchio || (typeof MarchioPdf !== "undefined" ? MarchioPdf : null);
    if (Marchio) Marchio.disegna(doc, ris.PDFLib, p,
      await Marchio.prepara(doc, ris.PDFLib, { icona: ris.icona, regolare: ris.sansRegolare, grassetto: ris.sansGrassetto }),
      { cx: L / 2, y: 14, campagna: "scheda_canone_torino" });
    return doc.save();
  }

  return { creaPDF };
});
