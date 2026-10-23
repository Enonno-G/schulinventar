// Das einzige JavaScript, das im Browser läuft. Alles andere erledigt der Server.

// Löschen und andere nicht umkehrbare Aktionen müssen bestätigt werden (Pflichtenheft Kap. 5).
// Jedes Formular mit data-bestaetigen="Frage?" fragt vor dem Absenden nach.
document.addEventListener('submit', (ereignis) => {
  const frage = ereignis.target.dataset.bestaetigen;
  if (frage && !window.confirm(frage)) {
    ereignis.preventDefault(); // „Abbrechen“ geklickt: Formular nicht abschicken
  }
});
