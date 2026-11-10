/*
 * Calcolo del canone concordato secondo un accordo territoriale.
 *
 * Un solo file, senza dipendenze: gira nel browser (portale UPPI, LocaOnLine)
 * e con Node (prove). I numeri e le regole stanno nel file dell'accordo
 * (per esempio roma-2023-07-25.json): un accordo nuovo e' un file nuovo, il
 * calcolo non cambia.
 *
 * Le superfici le inserisce chi compila (nette); il calcolo propone la
 * superficie convenzionale di ogni riga, che resta modificabile. Allo stesso
 * modo propone il valore al mq dentro la subfascia, modificabile.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.Canone = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const arrotonda = (n, cifre = 2) => {
    const k = Math.pow(10, cifre);
    return Math.round((Number(n) + Number.EPSILON) * k) / k;
  };
  const numero = (v) => {
    if (v === null || v === undefined || v === "") return null;
    // "1.234,50" e "52,5" all'italiana; "52.5" con il punto come decimale.
    let s = String(v).trim().replace(/\s|€/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = typeof v === "number" ? v : parseFloat(s);
    return Number.isFinite(n) ? n : null;
  };
  const virgola = (n, cifre = 2) =>
    n === null || n === undefined ? "" : arrotonda(n, cifre).toFixed(cifre).replace(".", ",");

  // ------------------------------------------------------------------ zone

  const normalizza = (s) =>
    String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
      .replace(/['’`.]/g, " ").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  /** Le zone sceglibili (non quelle sostituite), che corrispondono al testo:
   *  il codice che comincia cosi', oppure tutte le parole nel nome. */
  function cercaZone(accordo, testo, quante = 30) {
    const t = normalizza(testo);
    const zone = accordo.zone.filter((z) => !z.sostituita_da);
    if (!t) return zone.slice(0, quante);
    const parole = t.split(" ");
    const perCodice = zone.filter((z) => z.codice.startsWith(t.replace(/ /g, "")));
    const perNome = zone.filter((z) => {
      const n = normalizza(z.nome + " " + z.codice);
      return !perCodice.includes(z) && parole.every((p) => n.includes(p));
    });
    return perCodice.concat(perNome).slice(0, quante);
  }

  const zona = (accordo, codice) => accordo.zone.find((z) => z.codice === codice) || null;

  // -------------------------------------------------------------- superfici

  /** Le righe della superficie convenzionale, con il coefficiente della zona
   *  (le zone di pregio hanno box e posti auto in comune piu' alti). */
  function righeSuperficie(accordo, z) {
    const r = accordo.regole.superficie, pregio = !!(z && z.pregio);
    const x = (c) => "× " + virgola(c);
    return [
      { chiave: "appartamento", etichetta: "Superficie calpestabile appartamento",
        coeff: "secondo la superficie",
        nota: `Fino a 46 mq: ${x(r.fino_46.coeff)}, al massimo ${virgola(r.fino_46.massimo)} mq. ` +
              `Da 46 a 70 mq: ${x(r.da_46_a_70.coeff)}, al massimo ${virgola(r.da_46_a_70.massimo)} mq. ` +
              `Da 70 a 120 mq: invariata. Da 120 mq: riducibile fino al ${r.oltre_120_riduzione_massima * 100}%.` },
      { chiave: "box", etichetta: "Autorimessa e/o posto auto esclusivo" + (pregio ? " (zona pregio)" : ""),
        coeff: x(pregio ? r.box_pregio : r.box), fattore: pregio ? r.box_pregio : r.box,
        nota: `Non oltre il ${r.box * 100}% della superficie; il ${r.box_pregio * 100}% nelle zone di pregio.` },
      { chiave: "posto_comune", etichetta: "Posto auto in autorimessa comune",
        coeff: x(pregio ? r.posto_auto_comune_pregio : r.posto_auto_comune),
        fattore: pregio ? r.posto_auto_comune_pregio : r.posto_auto_comune,
        nota: `Non oltre il ${r.posto_auto_comune * 100}%; il ${r.posto_auto_comune_pregio * 100}% nelle zone di pregio.` },
      { chiave: "balconi", etichetta: "Balconi, terrazze, cantine e simili", coeff: x(r.balconi_cantine),
        fattore: r.balconi_cantine, nota: `Non oltre il ${r.balconi_cantine * 100}% della superficie.` },
      { chiave: "scoperta", etichetta: "Superficie scoperta in godimento esclusivo", coeff: x(r.scoperta_esclusiva),
        fattore: r.scoperta_esclusiva,
        nota: `Non oltre il ${r.scoperta_esclusiva * 100}%, e comunque non più della superficie calpestabile.` },
      { chiave: "verde", etichetta: "Sup. verde condominiale (Sup. tot. cond / MM.Tab A)", coeff: x(r.verde_condominiale),
        fattore: r.verde_condominiale,
        nota: `La quota millesimale del verde condominiale (superficie totale × millesimi / 1000), × ${virgola(r.verde_condominiale)}.` },
    ].concat(r.vani_bassi ? [
      // Roma, punto 6 g): non nella scheda 2/B, ma nell'accordo
      { chiave: "vani_bassi", etichetta: "Vani con altezza inferiore a m 1,70", coeff: x(r.vani_bassi), fattore: r.vani_bassi,
        nota: `Non oltre il ${Math.round(r.vani_bassi * 100)}% della superficie di questi vani: non contarli anche nella superficie dell'appartamento.` },
    ] : []);
  }

  /** La superficie convenzionale proposta per una riga. */
  function proposta(accordo, riga, netta, calpestabile) {
    const r = accordo.regole.superficie;
    if (netta === null || netta <= 0) return null;
    if (riga.chiave === "appartamento") {
      if (netta <= 46) return arrotonda(Math.min(netta * r.fino_46.coeff, r.fino_46.massimo));
      if (netta <= 70) return arrotonda(Math.min(netta * r.da_46_a_70.coeff, r.da_46_a_70.massimo));
      return arrotonda(netta);
    }
    let v = netta * riga.fattore;
    if (riga.chiave === "scoperta" && calpestabile) v = Math.min(v, calpestabile);
    return arrotonda(v);
  }

  /** Il minimo accettabile per la riga dell'appartamento (riduzione oltre 120 mq). */
  function minimoAppartamento(accordo, netta) {
    const r = accordo.regole.superficie;
    return netta >= 120 ? arrotonda(netta * (1 - r.oltre_120_riduzione_massima)) : null;
  }

  // ------------------------------------------------------------------ canone

  const SUBFASCE = { A: "inferiore", B: "media", C: "massima" };
  const ordinata = (c) => [Math.min(c[0], c[1]), Math.max(c[0], c[1])];

  /** La percentuale di durata: 4 anni +7, 5 +8, 6 o piu' +9 (contratti agevolati). */
  function percentualeDurata(accordo, anni) {
    const d = accordo.regole.durata, a = Number(anni) || 3;
    if (a <= 3) return 0;
    const chiavi = Object.keys(d).map(Number).sort((x, y) => x - y);
    let p = 0;
    for (const k of chiavi) if (a >= k) p = d[String(k)];
    return p;
  }

  const MAGGIORAZIONI = [
    ["seminterrato", "B", "Seminterrato"], ["senza_ascensore", "C", "Senza ascensore"], ["attico", "D", "Attico"],
    ["classe_ABC", "E", "Classe energetica A/B/C"], ["eco_bonus", "F", "Interventi Eco Bonus"],
    ["sisma_bonus", "G", "Interventi Sisma Bonus"], ["classe_DEF", "H", "Classe energetica D/E/F"],
  ];

  /**
   * Il calcolo completo. scheda:
   *   tipo: "agevolato" | "studenti" | "transitorio", durata_anni (agevolato),
   *   transitorio_percento, zona (codice),
   *   superfici: { chiave: { netta, applicata } }   (applicata vuota = proposta)
   *   caratteristiche: { idrica, fognante, gas, riscaldamento }
   *   parametri: [20 vero/falso], maggiorazioni: { ammobiliato: %, seminterrato: vero, ... },
   *   valore_mq (vuoto = proposto), canone_pattuito,
   *   storico (vero: immobile storico o vincolato, fasce aumentate)
   */
  function calcola(accordo, scheda) {
    const regole = accordo.regole, avvisi = [];
    const z = zona(accordo, scheda.zona);
    const righe = righeSuperficie(accordo, z);
    const sup = scheda.superfici || {};
    const calpestabile = numero((sup.appartamento || {}).netta);

    // superfici
    const superfici = {};
    let totale = 0, totaleProposto = 0;
    for (const r of righe) {
      const netta = numero((sup[r.chiave] || {}).netta);
      const prop = proposta(accordo, r, netta, calpestabile);
      const scritta = numero((sup[r.chiave] || {}).applicata);
      const applicata = scritta === null ? prop : arrotonda(scritta);
      superfici[r.chiave] = { netta, proposta: prop, applicata, modificata: scritta !== null && scritta !== prop };
      if (applicata) totale += applicata;
      if (prop) totaleProposto += prop;
      if (r.chiave === "appartamento" && netta !== null && applicata !== null) {
        const minimo = minimoAppartamento(accordo, netta);
        if (minimo !== null && applicata < minimo)
          avvisi.push(`La superficie dell'appartamento si può ridurre al massimo del 15%: almeno ${virgola(minimo)} mq.`);
        if (applicata > prop)
          avvisi.push(`La superficie convenzionale dell'appartamento (${virgola(applicata)} mq) supera quella prevista (${virgola(prop)} mq).`);
      } else if (prop !== null && applicata !== null && applicata > prop) {
        avvisi.push(`${r.etichetta}: ${virgola(applicata)} mq supera il massimo previsto (${virgola(prop)} mq).`);
      }
    }
    totale = arrotonda(totale); totaleProposto = arrotonda(totaleProposto);
    const tolleranza = regole.superficie.tolleranza || 0;
    if (totaleProposto && Math.abs(totale - totaleProposto) > totaleProposto * tolleranza + 0.005)
      avvisi.push(`Il totale (${virgola(totale)} mq) si discosta di più del ${tolleranza * 100}% da quello calcolato con i coefficienti (${virgola(totaleProposto)} mq).`);

    // caratteristiche e parametri
    const c = scheda.caratteristiche || {};
    const normale = !!(c.idrica && c.fognante && c.gas && c.riscaldamento);
    const nParametri = (scheda.parametri || []).filter(Boolean).length;
    const f = regole.fasce;
    let lettera = "A";
    if (normale && nParametri >= f.C_da) lettera = "C";
    else if (normale && nParametri >= f.B_da) lettera = "B";

    // maggiorazioni
    const m = scheda.maggiorazioni || {}, mr = regole.maggiorazioni;
    const ammobiliato = Math.max(0, numero(m.ammobiliato) || 0);
    const massimoArredo = scheda.tipo === "studenti" ? mr.ammobiliato_studenti : mr.ammobiliato_massimo;
    if (ammobiliato > massimoArredo) avvisi.push(`L'aumento per l'alloggio ammobiliato è al massimo del ${massimoArredo}%.`);
    if (m.classe_ABC && m.classe_DEF) avvisi.push("Indicata sia la classe energetica A/B/C sia la D/E/F: va scelta una sola.");
    let percentuale = Math.min(ammobiliato, massimoArredo);
    const applicate = [];
    if (ammobiliato) applicate.push({ lettera: "A", nome: "Ammobiliato", percento: Math.min(ammobiliato, massimoArredo) });
    for (const [chiave, letteraM, nome] of MAGGIORAZIONI) {
      if (!m[chiave]) continue;
      percentuale += mr[chiave];
      applicate.push({ lettera: letteraM, nome, percento: mr[chiave] });
    }
    const aumenti = applicate.some((a) => a.percento > 0);

    // immobili storici o vincolati (Roma, punto 9): fasce aumentate nei
    // valori minimo e massimo, se l'accordo lo prevede
    const storicoPercento = scheda.storico && regole.storici_dlgs42 ? regole.storici_dlgs42 : 0;
    // in centesimi interi, arrotondando al centesimo per eccesso da 0,5:
    // 13,50 + 15% = 15,525 -> 15,53 (con i decimali del computer: 15,52)
    const per = (n) => Math.round(Math.round(n * 100) * (100 + storicoPercento) / 100) / 100;

    // il valore al mq
    let valoreProposto = null, fascia = null, limiti = null, oscillazione = null;
    if (z) {
      fascia = ordinata(z[lettera]).map(per);
      limiti = [per(Math.min(z.A[0], z.A[1])), per(Math.min(z.oscillazione[1], z.C[1]))];
      oscillazione = z.oscillazione.map(per);
      if (lettera === "A") {
        valoreProposto = normale ? fascia[0] + (fascia[1] - fascia[0]) * Math.min(nParametri, f.B_da - 1) / (f.B_da - 1) : fascia[0];
      } else if (lettera === "B") {
        valoreProposto = fascia[0] + (fascia[1] - fascia[0]) * Math.min(nParametri - f.B_da, f.B_massimo_a - f.B_da) / (f.B_massimo_a - f.B_da);
      } else {
        valoreProposto = (nParametri >= f.C_massimo_a || aumenti) ? fascia[1]
          : fascia[0] + (fascia[1] - fascia[0]) * (nParametri - f.C_da) / (f.C_massimo_a - f.C_da);
      }
      valoreProposto = arrotonda(valoreProposto);
      if (z.avviso) avvisi.push(z.avviso);
    }
    const scritto = numero(scheda.valore_mq);
    const valore = scritto === null ? valoreProposto : arrotonda(scritto);
    if (fascia && valore !== null && (valore < fascia[0] - 0.005 || valore > fascia[1] + 0.005))
      avvisi.push(`Il valore di ${virgola(valore)} €/mq è fuori dalla subfascia ${SUBFASCE[lettera]} (${virgola(fascia[0])} – ${virgola(fascia[1])}).`);

    // maggiorazioni dentro i limiti della zona
    let valoreMaggiorato = null, valoreApplicato = null, limitato = false;
    if (valore !== null && limiti) {
      valoreMaggiorato = arrotonda(valore * (1 + percentuale / 100));
      valoreApplicato = Math.max(limiti[0], Math.min(limiti[1], valoreMaggiorato));
      limitato = valoreApplicato !== valoreMaggiorato;
      if (limitato)
        avvisi.push(valoreMaggiorato > limiti[1]
          ? `Con le maggiorazioni si arriverebbe a ${virgola(valoreMaggiorato)} €/mq: il massimo della zona è ${virgola(limiti[1])}.`
          : `Con le riduzioni si scenderebbe a ${virgola(valoreMaggiorato)} €/mq: il minimo della zona è ${virgola(limiti[0])}.`);
      valoreApplicato = arrotonda(valoreApplicato);
    }

    // durata o transitorio, fuori dal tetto della zona
    const durata = scheda.tipo === "agevolato" ? percentualeDurata(accordo, scheda.durata_anni) : 0;
    let transitorio = 0;
    if (scheda.tipo === "transitorio") {
      transitorio = Math.max(0, numero(scheda.transitorio_percento) || 0);
      if (transitorio > regole.transitorio_massimo) {
        avvisi.push(`Per il transitorio l'aumento è al massimo del ${regole.transitorio_massimo}%.`);
        transitorio = regole.transitorio_massimo;
      }
    }
    const canoneBase = valoreApplicato !== null && totale ? arrotonda(valoreApplicato * totale) : null;
    const canoneDurata = canoneBase !== null ? arrotonda(canoneBase * (1 + durata / 100)) : null;
    const canoneMassimo = canoneBase !== null ? arrotonda(canoneBase * (1 + (durata + transitorio) / 100)) : null;
    const pattuito = numero(scheda.canone_pattuito);
    if (pattuito !== null && canoneMassimo !== null && pattuito > canoneMassimo + 0.005)
      avvisi.push(`Il canone pattuito (€ ${virgola(pattuito)}) supera l'importo massimo (€ ${virgola(canoneMassimo)}).`);
    if (!z && scheda.zona) avvisi.push("Zona non trovata in questo accordo.");

    return {
      zona: z, pregio: !!(z && z.pregio), righe, superfici, totale, totale_proposto: totaleProposto,
      oscillazione, storico_percento: storicoPercento,
      normale, parametri: nParametri, fascia_lettera: lettera, subfascia: SUBFASCE[lettera], fascia, limiti,
      valore_proposto: valoreProposto, valore, maggiorazioni: applicate, maggiorazioni_percento: percentuale,
      valore_maggiorato: valoreMaggiorato, valore_applicato: valoreApplicato, limitato,
      canone_base: canoneBase, durata_percento: durata, canone_durata: canoneDurata,
      transitorio_percento: transitorio, canone_massimo: canoneMassimo, canone_pattuito: pattuito, avvisi,
    };
  }

  return { cercaZone, zona, righeSuperficie, proposta, calcola, percentualeDurata, normalizza, virgola, numero, SUBFASCE };
});
