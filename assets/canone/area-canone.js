/*
 * Dashboard, voce "Canone concordato": le schede del canone e i contratti
 * salvati dal cliente (da canone-concordato.html) e gli accordi
 * territoriali disponibili. Le liste si aggiornano da sole (onSnapshot).
 */
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, query, where, onSnapshot, deleteDoc, doc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyCnSy8XSjZGRC76YDaknvlHphcCVLZOlL0",
  authDomain:        "locaonline-e8157.firebaseapp.com",
  projectId:         "locaonline-e8157",
  storageBucket:     "locaonline-e8157.firebasestorage.app",
  messagingSenderId: "423895184436",
  appId:             "1:423895184436:web:d34d03ebc2f2b916abc661",
};
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const $ = (id) => document.getElementById(id);
const testo = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const quando = (t) => (t && t.toDate ? t.toDate().toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const ELENCHI = {
  schede: { raccolta: 'schede_canone', param: 'scheda', icona: 'fa-calculator', vuoto: 'Nessuna scheda del canone salvata.' },
  contratti: { raccolta: 'contratti_compilati', param: 'contratto', icona: 'fa-file-signature', vuoto: 'Nessun contratto salvato.' },
};

function riga(chiave, d) {
  const e = ELENCHI[chiave], v = d.data();
  return `
    <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
      <div class="w-10 h-10 rounded-lg bg-[#EBF2FF] flex items-center justify-center flex-shrink-0">
        <i class="fa-solid ${e.icona} text-[#2E7CF6]"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-[#0F2A4A] line-clamp-2 break-words">${testo(v.titolo) || 'Senza titolo'}</p>
        <p class="text-xs text-slate-400 mt-0.5">${testo(v.comune)}${v.comune ? ' · ' : ''}aggiornato il ${quando(v.aggiornato) || '–'}</p>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <a href="canone-concordato.html?${e.param}=${encodeURIComponent(d.id)}"
           class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2E7CF6] border border-[#2E7CF6]/30 hover:border-[#2E7CF6] rounded-lg">
          <i class="fa-solid fa-pen text-[10px]"></i> Apri</a>
        <button type="button" data-elimina="${chiave}" data-id="${testo(d.id)}" title="Elimina"
           class="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 rounded-lg">
          <i class="fa-solid fa-trash-can text-[11px]"></i><span class="sr-only">Elimina</span></button>
      </div>
    </div>`;
}

function mostraElenco(chiave, snap) {
  const box = $(`canone-${chiave}`), conta = $(`canone-${chiave}-conta`);
  conta.textContent = String(snap.size);
  if (snap.empty) {
    box.innerHTML = `<p class="px-5 py-6 text-sm text-slate-400">${ELENCHI[chiave].vuoto}
      <a href="canone-concordato.html" class="text-[#2E7CF6] font-semibold hover:underline">Inizia ora →</a></p>`;
    return;
  }
  // i piu' recenti in alto (ordinati qui, senza indici in Firestore)
  const docs = snap.docs.slice().sort((a, b) =>
    ((b.data().aggiornato || {}).seconds || 0) - ((a.data().aggiornato || {}).seconds || 0));
  box.innerHTML = docs.map((d) => riga(chiave, d)).join('');
}

function errore(chiave, err) {
  console.error('Elenco canone concordato:', err);
  $(`canone-${chiave}`).innerHTML = '<p class="px-5 py-6 text-sm text-slate-400">Elenco non disponibile in questo momento: riprova più tardi.</p>';
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-elimina]');
  if (!btn) return;
  const e2 = ELENCHI[btn.dataset.elimina];
  if (!confirm('Eliminare definitivamente questo lavoro salvato? Non si potrà recuperare.')) return;
  try {
    await deleteDoc(doc(db, e2.raccolta, btn.dataset.id));
    window.showToast?.('Eliminato.', 'success');
  } catch (err) {
    console.error(err);
    window.showToast?.('Eliminazione non riuscita: riprova.', 'error');
  }
});

/** Gli accordi territoriali disponibili, dall'elenco dei comuni. */
async function mostraAccordi() {
  const box = $('canone-accordi');
  try {
    const indice = await (await fetch('accordi/indice.json')).json();
    const comuni = indice.comuni.slice().sort((a, b) => a.comune.localeCompare(b.comune, 'it'));
    box.innerHTML = comuni.map((c) => `
      <div class="flex items-center gap-3 px-5 py-4 border-b border-slate-100 last:border-0">
        <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
          <i class="fa-solid fa-landmark text-slate-500"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-[#0F2A4A]">${testo(c.comune)}${c.provincia ? ` (${testo(c.provincia)})` : ''}</p>
          <p class="text-xs text-slate-400 mt-0.5">Accordo del ${testo(c.sottoscritto)}, depositato il ${testo(c.depositato)}</p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          ${[['pdf', 'Accordo'], ['pdf_studenti', 'Studenti']].filter(([k]) => c[k]).map(([k, nome]) => `<a href="${testo(c[k])}" target="_blank" rel="noopener"
             class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:border-[#2E7CF6] rounded-lg">
             <i class="fa-regular fa-file-pdf text-[11px]"></i> ${nome}</a>`).join('')}
          <a href="canone-concordato.html?comune=${encodeURIComponent(c.comune.toLowerCase())}"
             class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#2E7CF6] border border-[#2E7CF6]/30 hover:border-[#2E7CF6] rounded-lg">
             <i class="fa-solid fa-calculator text-[10px]"></i> Calcola</a>
        </div>
      </div>`).join('');
  } catch (err) {
    box.innerHTML = '<p class="px-5 py-6 text-sm text-slate-400">Elenco degli accordi non disponibile: ricarica la pagina.</p>';
  }
}

let fermi = [];
onAuthStateChanged(auth, (user) => {
  fermi.forEach((f) => f()); fermi = [];
  if (!user || user.isAnonymous) return;          // gli ospiti non hanno questa sezione
  for (const chiave of Object.keys(ELENCHI)) {
    const q = query(collection(db, ELENCHI[chiave].raccolta), where('userId', '==', user.uid));
    fermi.push(onSnapshot(q, (snap) => mostraElenco(chiave, snap), (err) => errore(chiave, err)));
  }
});
mostraAccordi();
