// Export – Pflichtenheft Kap. 4 „Export in CSV-Datei bzw. Excel-Datei“ und „Export im korrekten Format für SAP“
//
//   GET  /export    Übersicht: welche Listen man herunterladen kann
//
// Die CSV-Dateien selbst entstehen dort, wo auch die Listen sind: /geraete.csv in geraete.js und
// /raeume.csv in raeume.js. Der Export für SAP kommt in Sprint 4, sobald das Format der SAP-Liste bekannt ist.
import { Router } from 'express';
import { db } from '../datenbank.js';

const router = Router();

router.get('/export', async (req, res) => {
  const zaehlung = await db.eine(
    'SELECT (SELECT count(*) FROM geraete) AS geraete, (SELECT count(*) FROM raeume) AS raeume',
  );
  res.render('export', { zaehlung });
});

export default router;
