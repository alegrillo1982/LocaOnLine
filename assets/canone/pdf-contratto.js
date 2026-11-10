/*
 * Il contratto in PDF, dai blocchi di Contratto.genera: impaginazione come
 * i modelli dell'UPPI (Times, testo giustificato, logo e riquadro sulla
 * prima pagina, numero di pagina in fondo).
 *
 *   PdfContratto.crea({ PDFLib, fontkit, regolare, grassetto, logo }, blocchi) -> Promise<Uint8Array>
 *
 * Gira nel browser e con Node.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.PdfContratto = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const L = 595.28, H = 841.89;
  const M = { sx: 56.7, dx: 56.7, su: 48, giu: 62 };       // margini (2 cm ai lati, come il modello)
  const LARGO = L - M.sx - M.dx;
  const CORPO = 11, INTERLINEA = 1.22, DOPO = 4.5, RIENTRO = 14;

  async function crea(r, blocchi) {
    const { PDFDocument, rgb } = r.PDFLib;
    const doc = await PDFDocument.create();
    doc.registerFontkit(r.fontkit);
    const reg = await doc.embedFont(r.regolare, { subset: false });
    const bold = await doc.embedFont(r.grassetto, { subset: false });
    const logo = r.logo ? await doc.embedPng(r.logo) : null;
    doc.setTitle("Contratto di locazione");
    doc.setCreator("LocaOnLine - locaonline.it");
    const NERO = rgb(0, 0, 0);
    const font = (g) => (g ? bold : reg);
    const larghezza = (t, g, s) => font(g).widthOfTextAtSize(t, s);

    let pagina = null, y = 0;
    const pagine = [];
    const nuovaPagina = () => { pagina = doc.addPage([L, H]); pagine.push(pagina); y = H - M.su; };
    const spazio = (h) => { if (y - h < M.giu) { nuovaPagina(); return true; } return false; };
    nuovaPagina();

    /** Le parole di un paragrafo, ognuna con il suo stile; gli spazi restano fra le parole. */
    function parole(parti) {
      const out = [];
      for (const p of parti) {
        const pezzi = String(p.testo).split(/(\s+)/);
        for (const pz of pezzi) {
          if (pz === "") continue;
          if (/^\s+$/.test(pz)) { if (out.length) out[out.length - 1].spazio = true; continue; }
          // una parola lunghissima (righe da compilare) si spezza per stare nella riga
          out.push({ testo: pz, g: !!p.g, spazio: false });
        }
      }
      return out;
    }

    /** Divide in righe: ogni riga e' un elenco di parole con la loro larghezza.
     *  I pezzi attaccati senza spazio (una data e la virgola che la segue, un
     *  nome normale e un cognome in grassetto) stanno sempre sulla stessa riga. */
    function righe(parti, s, largo) {
      const ps = parole(parti), sp = larghezza(" ", false, s), out = [];
      // i gruppi: parole consecutive senza spazio fra loro
      const gruppi = [];
      ps.forEach((p, i) => {
        const pezzo = { testo: p.testo, g: p.g, w: larghezza(p.testo, p.g, s), spazio: p.spazio };
        if (i > 0 && !ps[i - 1].spazio) gruppi[gruppi.length - 1].push(pezzo); else gruppi.push([pezzo]);
      });
      let riga = [], w = 0;
      for (const gr of gruppi) {
        const gw = gr.reduce((t, x) => t + x.w, 0);
        const servono = riga.length ? w + sp + gw : gw;
        if (servono > largo && riga.length) { out.push(riga); riga = []; w = 0; }
        if (gw > largo) {
          // un gruppo piu' largo della riga (una lunga riga "_____"): si spezza a forza
          for (const x of gr) {
            let resto = x.testo;
            while (resto) {
              let k = resto.length;
              while (k > 1 && larghezza(resto.slice(0, k), x.g, s) > largo - w) k--;
              const pezzo = { testo: resto.slice(0, k), g: x.g, w: larghezza(resto.slice(0, k), x.g, s), spazio: false };
              riga.push(pezzo); w += pezzo.w; resto = resto.slice(k);
              if (resto) { out.push(riga); riga = []; w = 0; }
            }
          }
          riga[riga.length - 1].spazio = gr[gr.length - 1].spazio;
          continue;
        }
        w = riga.length ? w + sp + gw : gw;
        riga.push(...gr);
      }
      if (riga.length) out.push(riga);
      return out;
    }

    function scriviRiga(riga, x0, largo, s, giustifica) {
      const sp = larghezza(" ", false, s);
      const naturale = riga.reduce((t, p, i) => t + p.w + (i < riga.length - 1 && p.spazio ? sp : 0), 0);
      const varchi = riga.slice(0, -1).filter((p) => p.spazio).length;
      const extra = giustifica && varchi ? (largo - naturale) / varchi : 0;
      let x = x0;
      riga.forEach((p, i) => {
        pagina.drawText(p.testo, { x, y, size: s, font: font(p.g), color: NERO });
        x += p.w + (i < riga.length - 1 && p.spazio ? sp + extra : 0);
      });
    }

    function paragrafo(parti, { s = CORPO, rientro = 0, allinea = "giustifica", dopo = DOPO, prima = 0 } = {}) {
      const largo = LARGO - rientro, rs = righe(parti, s, largo), passo = s * INTERLINEA;
      if (prima) { if (!spazio(prima)) y -= prima; }
      rs.forEach((riga, i) => {
        spazio(passo);
        y -= s;                                     // la linea di base
        const ultima = i === rs.length - 1;
        if (allinea === "centro") {
          const w = riga.reduce((t, p, k) => t + p.w + (k < riga.length - 1 && p.spazio ? larghezza(" ", false, s) : 0), 0);
          scriviRiga(riga, M.sx + (LARGO - w) / 2, w, s, false);
        } else {
          scriviRiga(riga, M.sx + rientro, largo, s, allinea === "giustifica" && !ultima);
        }
        y -= passo - s;
      });
      y -= dopo;
    }

    /** Le righe del riquadro: quelle troppo lunghe vanno a capo (fra due
     *  parole, il piu' vicino possibile a meta'), invece di rimpicciolirsi. */
    function righeRiquadro(righe, largo) {
      const out = [];
      for (const r of righe) {
        const s = r.s || 11;
        if (larghezza(r.testo, r.g, s) <= largo) { out.push({ ...r, s }); continue; }
        const parole = r.testo.split(" ");
        let migliore = null;
        for (let k = 1; k < parole.length; k++) {
          const a = parole.slice(0, k).join(" "), z = parole.slice(k).join(" ");
          const wa = larghezza(a, r.g, s), wz = larghezza(z, r.g, s);
          if (wa <= largo && wz <= largo && (!migliore || Math.abs(wa - wz) < migliore.d)) migliore = { a, z, d: Math.abs(wa - wz) };
        }
        if (migliore) { out.push({ ...r, s, testo: migliore.a, sottolinea: r.sottolinea }); out.push({ ...r, s, testo: migliore.z }); }
        else {
          let s2 = s;
          while (larghezza(r.testo, r.g, s2) > largo && s2 > 7) s2 -= 0.5;
          out.push({ ...r, s: s2 });
        }
      }
      return out;
    }

    /** Logo e riquadro: stessa altezza, allineati sopra e sotto; il testo del
     *  riquadro centrato anche in verticale. */
    function intestazione(b) {
      const SPAZIO = 14, MARGINE = 9, alto = y;
      const proporzione = logo ? logo.width / logo.height : 1;
      // il logo e' alto quanto il riquadro, ma il riquadro dipende dalla
      // larghezza che il logo gli lascia: si cerca l'equilibrio in pochi passi,
      // con il logo fra 88 e 110 punti
      const altezzaTesto = (rr) => rr.reduce((t, r) => t + r.s * 1.22, 0);
      let latoLogo = 88, xb = 0, wb = 0, righeBox = [], h = 88;
      for (let passo = 0; passo < 4; passo++) {
        xb = M.sx + latoLogo * proporzione + SPAZIO; wb = L - M.dx - xb;
        righeBox = righeRiquadro(b.righe, wb - 16);
        h = Math.max(88, altezzaTesto(righeBox) + 2 * MARGINE);
        const nuovo = Math.min(h, 110);
        if (Math.abs(nuovo - latoLogo) < 0.5) break;
        latoLogo = nuovo;
      }
      latoLogo = Math.min(h, latoLogo);
      if (logo) pagina.drawImage(logo, { x: M.sx, y: alto - (h + latoLogo) / 2, width: latoLogo * proporzione, height: latoLogo });
      pagina.drawRectangle({ x: xb, y: alto - h, width: wb, height: h, borderColor: NERO, borderWidth: 0.9 });
      // il testo al centro del riquadro, in verticale
      let yy = alto - (h - altezzaTesto(righeBox)) / 2;
      for (const r of righeBox) {
        const passo = r.s * 1.22;
        const base = yy - passo + (passo - r.s) / 2 + r.s * 0.22;
        const w = larghezza(r.testo, r.g, r.s), x = xb + (wb - w) / 2;
        pagina.drawText(r.testo, { x, y: base, size: r.s, font: font(r.g), color: NERO });
        if (r.sottolinea) pagina.drawLine({ start: { x, y: base - 1.6 }, end: { x: x + w, y: base - 1.6 }, thickness: 0.8, color: NERO });
        yy -= passo;
      }
      y = alto - h - 16;
    }

    /** Le firme: il ruolo e il nome in grassetto, e sotto la riga per firmare. */
    function firme(b) {
      const colonna = LARGO / 2, alto = 44;
      for (const riga of b.righe) {
        spazio(alto);
        y -= 12;
        [[riga[0], M.sx], [riga[1], M.sx + colonna + 10]].forEach(([chi, x]) => {
          if (!chi) return;
          if (typeof chi === "string") chi = { ruolo: chi, nome: "" };
          let w = 0;
          pagina.drawText(chi.ruolo + (chi.nome ? " " : ""), { x, y, size: 11, font: reg, color: NERO });
          w = larghezza(chi.ruolo + " ", false, 11);
          if (chi.nome) {
            let s = 11;
            while (larghezza(chi.nome, true, s) > colonna - 30 - w && s > 7.5) s -= 0.5;
            pagina.drawText(chi.nome, { x: x + w, y, size: s, font: bold, color: NERO });
          }
          pagina.drawLine({ start: { x, y: y - 22 }, end: { x: x + colonna - 30, y: y - 22 }, thickness: 0.5, color: NERO });
        });
        y -= alto - 12;
      }
      y -= 4;
    }

    /** Una firma al centro, per esempio "PER PRESTATA ASSISTENZA". */
    function firmaCentro(b) {
      spazio(44);
      y -= 12;
      const w = larghezza(b.testo, true, 11.5);
      pagina.drawText(b.testo, { x: (L - w) / 2, y, size: 11.5, font: bold, color: NERO });
      y -= 34;                        // niente riga: lo spazio e' per il timbro
    }

    // quanto occupa un blocco: serve per tenere insieme la parte finale
    function altezza(b) {
      if (b.t === "par") return righe(b.parti.map((p) => ({ ...p })), b.s || CORPO, LARGO - RIENTRO * (Number(b.rientro) || 0)).length * (b.s || CORPO) * INTERLINEA + DOPO;
      if (b.t === "firme") return b.righe.length * 44 + 4;
      if (b.t === "firma_centro") return 44;
      if (b.t === "spazio") return b.h;
      return 20;
    }

    blocchi.forEach((b, i) => {
      // l'inizio di un gruppo da tenere insieme: se non c'e' posto, si va a pagina nuova
      if (b.insieme && !(blocchi[i - 1] || {}).insieme) {
        let h = 0;
        for (let k = i; k < blocchi.length && blocchi[k].insieme; k++) h += altezza(blocchi[k]);
        if (y - h < M.giu && h < H - M.su - M.giu) nuovaPagina();
      }
      if (b.t === "intestazione") intestazione(b);
      else if (b.t === "centro") paragrafo([{ testo: b.testo, g: b.g }], { s: b.s || 12, allinea: "centro", prima: 6, dopo: 6 });
      else if (b.t === "titolo") {
        // un titolo non resta da solo in fondo alla pagina: con lui almeno due righe
        if (y - (12 * INTERLINEA * 3 + 10) < M.giu) nuovaPagina();
        paragrafo([{ testo: b.testo, g: true }], { s: 12, allinea: "sinistra", prima: 5, dopo: 2 });
      }
      else if (b.t === "par") paragrafo(b.parti, { s: b.s || CORPO, rientro: RIENTRO * (Number(b.rientro) || 0) });
      else if (b.t === "firme") firme(b);
      else if (b.t === "firma_centro") firmaCentro(b);
      else if (b.t === "spazio") { if (!spazio(b.h)) y -= b.h; }
    });

    // i numeri di pagina e, sotto, il promemoria di LocaOnLine
    const GRIGIO = rgb(0.4, 0.45, 0.5), PROMEMORIA = "Compilato con LocaOnLine \u00b7 registra il contratto online su locaonline.it";
    pagine.forEach((p, i) => {
      const t = String(i + 1), w = reg.widthOfTextAtSize(t, 10);
      p.drawText(t, { x: (L - w) / 2, y: 30, size: 10, font: reg, color: NERO });
      const wp = reg.widthOfTextAtSize(PROMEMORIA, 7.5);
      p.drawText(PROMEMORIA, { x: (L - wp) / 2, y: 16, size: 7.5, font: reg, color: GRIGIO });
    });
    return doc.save();
  }

  return { crea };
});
