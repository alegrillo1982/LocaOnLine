/*
 * I numeri in lettere, all'italiana, come si scrivono negli importi dei
 * contratti: 900 -> "novecento/00", 1234.5 -> "milleduecentotrentaquattro/50".
 * Gira nel browser e con Node.
 */
(function (radice, fabbrica) {
  if (typeof module === "object" && module.exports) module.exports = fabbrica();
  else radice.Lettere = fabbrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const UNITA = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci",
    "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
  const DECINE = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

  function sottoCento(n) {
    if (n < 20) return UNITA[n];
    const d = DECINE[Math.floor(n / 10)], u = n % 10;
    if (u === 0) return d;
    // ventuno, ventotto: la decina perde la vocale finale davanti a uno e otto
    const base = (u === 1 || u === 8) ? d.slice(0, -1) : d;
    return base + (u === 3 ? "tré" : UNITA[u]);
  }

  function sottoMille(n) {
    const c = Math.floor(n / 100), r = n % 100;
    let s = c === 0 ? "" : c === 1 ? "cento" : UNITA[c] + "cento";
    if (r) {
      // centottanta, centotto: "cento" perde la "o" davanti a "ottanta" e "otto"
      const resto = sottoCento(r);
      if (c && (r === 8 || (r >= 80 && r < 90))) s = s.slice(0, -1);
      s += resto;
    }
    return s;
  }

  /** Il numero intero in lettere (senza "tré" con l'accento alla fine di "tre" da solo). */
  function intero(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return "zero";
    const parti = [];
    const miliardi = Math.floor(n / 1e9), milioni = Math.floor((n % 1e9) / 1e6),
          migliaia = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    if (miliardi) parti.push(miliardi === 1 ? "unmiliardo" : intero(miliardi) + "miliardi");
    if (milioni) parti.push(milioni === 1 ? "unmilione" : sottoMille(milioni) + "milioni");
    if (migliaia) parti.push(migliaia === 1 ? "mille" : sottoMille(migliaia) + "mila");
    if (resto) parti.push(sottoMille(resto));
    let s = parti.join("");
    // "tre" da solo non ha l'accento: "tre", "centotre"... ma "ventitré" si'
    if (s.endsWith("tré") && (s === "tré" || /(cento|mila|mille|milioni|milione)tré$/.test(s))) s = s.slice(0, -1) + "e";
    return s;
  }

  /** Un importo in euro come nei contratti: "novecento/00". */
  function euro(importo) {
    const n = Math.round(Math.abs(Number(importo) || 0) * 100);
    const interi = Math.floor(n / 100), centesimi = String(n % 100).padStart(2, "0");
    return `${intero(interi)}/${centesimi}`;
  }

  /** L'importo in cifre all'italiana: 1234.5 -> "1.234,50". */
  function cifre(importo) {
    const n = Math.round(Math.abs(Number(importo) || 0) * 100);
    const interi = String(Math.floor(n / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${interi},${String(n % 100).padStart(2, "0")}`;
  }

  return { intero, euro, cifre };
});
