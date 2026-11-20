/**
 * Agenda Marinera — puente entre el Google Sheet y la app del iPhone.
 * Devuelve todas las pestañas del Sheet (tal como se ven) en JSON.
 * Se pega en: Extensiones → Apps Script, y se implementa como "Aplicación web".
 */
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = {};
  ss.getSheets().forEach(function (sh) {
    var rng = sh.getDataRange();
    tabs[sh.getName()] = rng.getDisplayValues();
  });
  var out = { updated: new Date().toISOString(), tabs: tabs };
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
