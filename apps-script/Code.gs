// Local mirror of Google Apps Script project for editing only; changes must be pasted back into Apps Script.
const SHEET_NAMES = {
  ORDERS: 'SERVI Orders',
  ADJUSTMENTS: 'SERVI Adjustments',
};

const ORDER_HEADER_ALIASES = {
  CLIENT_NAME: ['Client Name'],
  PHONE: ['WhatsApp Number', 'WhatsApp (E.164)', 'WhatsApp Associated'],
  SERVICE_DESC: ['Service Description'],
  AMOUNT: ['Amount (MXN)', 'Amount'],
  SERVICE_DT: [
    'Service Date and Time',
    'Service Date and Time (Dia, mes, año, hora)',
    'Service Date and Time (Día, mes, año, hora)',
  ],
  ADDRESS: ['Address Info', 'Address'],
  LINK_MSG: [
    'Payment Message with Link integrated',
    'Payment Message',
    'Payment Link',
  ],
  STATUS: ['Status'],
  CLIENT_TYPE: ['Client Type'],
  TOTAL_PAID: ['Total Paid', 'Total (MXN)', 'Total'],
  RECEIPT: ['Receipt Message'],
  CLIENT_ID: ['Client ID'],
  HOURS: ['Hours to service', 'Hours To Service', 'Hours till Service'],
  ORDER_ID: ['Parent Order ID', 'Order ID'],
  PI_ID: ['Payment Intent ID'],
  SHORT_CODE: ['Short Order ID', 'Short Code'],
  DATE_CREATED: ['Date created', 'Date Created', 'Created At'],
  UPDATE_PAYMENT_METHOD: ['Update payment method'],
};

const ADJ_HEADER_ALIASES = {
  PARENT_ORDER_ID: ['Parent Order ID'],
  REASON: ['Reason'],
  AMOUNT: ['Amount (MXN)', 'Amount'],
  CAPTURE_TYPE: ['Capture Type'],
  MESSAGE: [
    'Adj. Payment Message with Link integrated',
    'Adj. Payment Message',
    'Adjustment Payment Link',
  ],
  STATUS: ['Status'],
  RECEIPT: ['Receipt Message'],
  TOTAL_CHARGED: ['Total Charged'],
  CONSENT: ['Consent for off-session charge', 'Consent'],
  REQ3DS: ['3DS'],
  ADJUSTMENT_ORDER_ID: ['Adjustment Order ID'],
  SHORT_CODE: ['Short Order ID', 'Short Code'],
  PAYMENT_INTENT_ID: ['Adj. Payment Intent ID', 'Payment Intent ID'],
  CLIENT_ID: ['Client ID'],
};

const HEADER_CACHE = Object.create(null);
const CACHE_KEY_TO_SHEET = {
  orders: SHEET_NAMES.ORDERS,
  adjustments: SHEET_NAMES.ADJUSTMENTS,
};

function normalizeHeader_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getSpreadsheet_() {
  try {
    return SpreadsheetApp.getActive();
  } catch (err) {
    if (typeof SPREADSHEET_ID === 'string' && SPREADSHEET_ID) {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    throw err;
  }
}

function getSheet_(sheetName) {
  const ss = getSpreadsheet_();
  return ss ? ss.getSheetByName(sheetName) : null;
}

function headerCacheKey_(cacheKey, sheet) {
  return cacheKey + ':' + sheet.getSheetId();
}

function getSheetHeaderMap_(sheet) {
  const lastCol = sheet.getLastColumn();
  if (!lastCol) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  return headers.reduce(function (acc, header, idx) {
    const normalized = normalizeHeader_(header);
    if (normalized) acc[normalized] = idx + 1;
    return acc;
  }, {});
}

function resolveColumnIndex_(headerMap, aliases) {
  const list = Array.isArray(aliases) ? aliases : [aliases];
  for (var i = 0; i < list.length; i++) {
    const normalized = normalizeHeader_(list[i]);
    if (normalized && headerMap[normalized]) return headerMap[normalized];
  }
  return null;
}

function buildColumnMapFromSheet_(sheet, aliasMap, sheetLabel) {
  const headerMap = getSheetHeaderMap_(sheet);
  const result = {};
  Object.keys(aliasMap).forEach(function (key) {
    const idx = resolveColumnIndex_(headerMap, aliasMap[key]);
    if (!idx) {
      const aliases = [].concat(aliasMap[key] || []);
      throw new Error(
        sheetLabel + ' is missing the "' + aliases[0] + '" column header.'
      );
    }
    result[key] = idx;
  });
  return result;
}

function getColumnMap_(cacheKey, sheetName, aliasMap, sheetOpt) {
  const sheet = sheetOpt || getSheet_(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" not found.');
  const cacheId = headerCacheKey_(cacheKey, sheet);
  if (!HEADER_CACHE[cacheId]) {
    HEADER_CACHE[cacheId] = buildColumnMapFromSheet_(
      sheet,
      aliasMap,
      sheetName
    );
  }
  return HEADER_CACHE[cacheId];
}

function clearColumnCache_(cacheKey, sheetOpt) {
  const sheetName = CACHE_KEY_TO_SHEET[cacheKey];
  const sheet = sheetOpt || (sheetName ? getSheet_(sheetName) : null);
  if (!sheet) return;
  delete HEADER_CACHE[headerCacheKey_(cacheKey, sheet)];
}

function columnLetterFromIndex_(index) {
  let col = '';
  let n = Number(index || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function ordersColumnMap_(sheetOpt) {
  return getColumnMap_(
    'orders',
    SHEET_NAMES.ORDERS,
    ORDER_HEADER_ALIASES,
    sheetOpt
  );
}
function adjustmentsColumnMap_(sheetOpt) {
  return getColumnMap_(
    'adjustments',
    SHEET_NAMES.ADJUSTMENTS,
    ADJ_HEADER_ALIASES,
    sheetOpt
  );
}

function createColumnProxy_(cacheKey, sheetName, aliasMap) {
  return new Proxy(
    {},
    {
      get: function (_target, prop) {
        if (typeof prop !== 'string') return undefined;
        const map = getColumnMap_(cacheKey, sheetName, aliasMap);
        const key = prop.toUpperCase();
        if (!(key in map)) {
          throw new Error(
            'Unknown column key "' + prop + '" for sheet "' + sheetName + '".'
          );
        }
        return map[key];
      },
    }
  );
}

const ORD_COL = createColumnProxy_(
  'orders',
  SHEET_NAMES.ORDERS,
  ORDER_HEADER_ALIASES
);
const ADJ_COL = createColumnProxy_(
  'adjustments',
  SHEET_NAMES.ADJUSTMENTS,
  ADJ_HEADER_ALIASES
);

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('SERVI Tools')
      .addItem('Generate Payment Link for Selected Row', 'generatePaymentLink')
      .addItem('Generate Adjustment for Selected Row', 'generateAdjustment')
      .addItem('Capture Completed Service', 'captureCompletedService')
      .addItem(
        'Initiate Payment Intent for Scheduled Order',
        'InitiatePaymentIntentForScheduledOrder'
      )
      .addItem('Re-sync Selected Row', 'resyncSelectedRow')
      .addSeparator()
      .addItem('Install Auto-Preauth (hourly)', 'installAutoPreauthTrigger_')
      .addItem('Remove Auto-Preauth', 'removeAutoPreauthTrigger_')
      .addToUi();

    const ss = getSpreadsheet_();

    ensureOrdersDateCreatedColumn_();
    ensureOrdersHoursColumn_();

    const ordersSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
    if (ordersSheet) {
      const cols = ordersColumnMap_(ordersSheet);
      const wrapCols = [
        cols.ADDRESS,
        cols.LINK_MSG,
        cols.RECEIPT,
        cols.UPDATE_PAYMENT_METHOD,
      ];
      const maxRows = Math.max(ordersSheet.getMaxRows(), 1);
      wrapCols.forEach(function (colIdx) {
        if (!colIdx) return;
        ordersSheet.getRange(1, colIdx, maxRows, 1).setWrap(true);
      });
      ordersSheet
        .getRange(1, cols.AMOUNT, maxRows, 1)
        .setNumberFormat('$#,##0.00');
      ordersSheet
        .getRange(1, cols.TOTAL_PAID, maxRows, 1)
        .setNumberFormat('$#,##0.00');
    }

    const adjustmentsSheet = ss.getSheetByName(SHEET_NAMES.ADJUSTMENTS);
    if (adjustmentsSheet) {
      const cols = adjustmentsColumnMap_(adjustmentsSheet);
      const maxRows = Math.max(adjustmentsSheet.getMaxRows(), 1);
      [cols.MESSAGE, cols.RECEIPT].forEach(function (colIdx) {
        adjustmentsSheet.getRange(1, colIdx, maxRows, 1).setWrap(true);
      });
    }

    ensureAdjustmentsSheet();
  } catch (e) {
    Logger.log('UI not available in this context: ' + e.message);
  }
}

function run_autoPreauthOnce() {
  autoPreauthScheduled_();
}

function autoPreauthScheduled_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName('SERVI Orders');
  if (!sh) return;

  const last = sh.getLastRow();
  for (let r = 2; r <= last; r++) {
    const status = String(
      sh.getRange(r, ORD_COL.STATUS).getDisplayValue() || ''
    ).trim();
    const hours = Number(sh.getRange(r, ORD_COL.HOURS).getValue() || '');
    const orderId = String(
      sh.getRange(r, ORD_COL.ORDER_ID).getDisplayValue() || ''
    ).trim();
    const pi = String(
      sh.getRange(r, ORD_COL.PI_ID).getDisplayValue() || ''
    ).trim();

    if (!orderId) continue;
    if (status !== 'Scheduled') continue;
    if (isNaN(hours) || hours > 15) continue;
    if (pi) continue; // already has a PI / progressed

    try {
      const resp = UrlFetchApp.fetch(SERVI_BASE + '/confirm-with-saved', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ orderId }),
        muteHttpExceptions: true,
      });
      const code = resp.getResponseCode();
      const out = JSON.parse(resp.getContentText() || '{}');

      if (code === 200) {
        const label =
          out.status === 'requires_capture'
            ? 'Confirmed'
            : out.status === 'succeeded'
              ? 'Captured'
              : String(out.status || 'Confirmed');
        sh.getRange(r, ORD_COL.STATUS).setValue(label);
        sh
          .getRange(r, ORD_COL.PI_ID)
          .setValue(String(out.paymentIntentId || ''));
        sh.getRange(r, ORD_COL.UPDATE_PAYMENT_METHOD).clearContent();
      } else if (code === 402 && out.clientSecret) {
        sh.getRange(r, ORD_COL.STATUS).setValue('Pending (3DS)');
        if (out.paymentIntentId) {
          sh
            .getRange(r, ORD_COL.PI_ID)
            .setValue(String(out.paymentIntentId || ''));
        }
        // do NOT touch messages
      } else if (code === 409) {
        sh.getRange(r, ORD_COL.STATUS).setValue('Declined');
        if (out.paymentIntentId) {
          sh
            .getRange(r, ORD_COL.PI_ID)
            .setValue(String(out.paymentIntentId || ''));
        }
        const retryMessage = String(
          out.updatePaymentMessage ||
            out.billingPortalMessage ||
            out.updatePaymentUrl ||
            out.billingPortalUrl ||
            out.message ||
            ''
        ).trim();
        if (retryMessage) {
          sh.getRange(r, ORD_COL.UPDATE_PAYMENT_METHOD).setValue(retryMessage);
        }
      }
    } catch (_) {
      // ignore; we'll retry next run
    }
  }
}

function installAutoPreauthTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'autoPreauthScheduled_') {
      ScriptApp.deleteTrigger(t); // avoid dupes
    }
  }
  ScriptApp.newTrigger('autoPreauthScheduled_')
    .timeBased()
    .everyHours(1) // change to everyMinutes(30) if you prefer
    .create();

  try {
    SpreadsheetApp.getUi().alert('Installed hourly Auto-Preauth trigger.');
  } catch (_) {}
}

function removeAutoPreauthTrigger_() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'autoPreauthScheduled_') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  }
  try {
    SpreadsheetApp.getUi().alert(
      removed
        ? 'Removed Auto-Preauth trigger.'
        : 'No Auto-Preauth trigger was installed.'
    );
  } catch (_) {}
}

function ensureOrdersDateCreatedColumn_() {
  const sh = getSheet_(SHEET_NAMES.ORDERS);
  if (!sh) return;
  try {
    const col = ORD_COL.DATE_CREATED;
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, col, rows, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  } catch (err) {
    Logger.log('ensureOrdersDateCreatedColumn_: ' + err.message);
  }
}

function ensureOrdersHoursColumn_() {
  const sh = getSheet_(SHEET_NAMES.ORDERS);
  if (!sh) return;
  try {
    const col = ORD_COL.HOURS;
    const header = sh.getRange(1, col).getDisplayValue();
    if (normalizeHeader_(header) !== normalizeHeader_('Hours till Service')) {
      sh.getRange(1, col).setValue('Hours till Service');
      clearColumnCache_('orders', sh);
    }

    const hoursColIndex = ORD_COL.HOURS;
    const statusColIndex = ORD_COL.STATUS;
    const hoursColLetter = columnLetterFromIndex_(hoursColIndex);
    const statusColLetter = columnLetterFromIndex_(statusColIndex);
    const startRow = 2;
    const totalRows = Math.max(sh.getMaxRows() - startRow + 1, 1);
    const hoursRange = sh.getRange(startRow, hoursColIndex, totalRows, 1);

    const existingRules = sh.getConditionalFormatRules();
    const filteredRules = existingRules.filter(function (rule) {
      const ranges = rule.getRanges() || [];
      return !ranges.some(function (rng) {
        const first = rng.getColumn();
        const last = rng.getLastColumn();
        return first <= hoursColIndex && last >= hoursColIndex;
      });
    });

    const yellowRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(
        `=AND($${statusColLetter}${startRow}="Scheduled",$${hoursColLetter}${startRow}>15)`
      )
      .setBackground('#FFE598')
      .setRanges([hoursRange])
      .build();

    const greenRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(
        `=AND($${statusColLetter}${startRow}="Confirmed",$${hoursColLetter}${startRow}<=15,$${hoursColLetter}${startRow}>2)`
      )
      .setBackground('#b7e1cd')
      .setRanges([hoursRange])
      .build();

    const redRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(
        `=AND($${hoursColLetter}${startRow}<=2,$${statusColLetter}${startRow}<>"Captured")`
      )
      .setBackground('#F4cbcc')
      .setRanges([hoursRange])
      .build();

    sh.setConditionalFormatRules(
      filteredRules.concat([redRule, greenRule, yellowRule])
    );
  } catch (err) {
    Logger.log('ensureOrdersHoursColumn_: ' + err.message);
  }
}

function ensureAdjustmentsSheet() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(SHEET_NAMES.ADJUSTMENTS);

  const headers = [
    'Parent Order ID',
    'Reason',
    'Amount (MXN)',
    'Capture Type',
    'Adjustment Payment Link',
    'Status',
    'Receipt Message',
    'Total Charged',
    'Consent for off-session charge',
    '3DS',
    'Adjustment Order ID',
    'Short Order ID',
    'Adj. Payment Intent ID',
    'Client ID',
  ];

  if (!sh) {
    sh = ss.insertSheet(SHEET_NAMES.ADJUSTMENTS);
    sh.setFrozenRows(1);
  }

  const firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];
  if (firstRow.filter(Boolean).length !== headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    headers.forEach(function (label, idx) {
      if (String(firstRow[idx] || '') !== label) {
        sh.getRange(1, idx + 1).setValue(label);
      }
    });
  }

  clearColumnCache_('adjustments', sh);

  const cols = adjustmentsColumnMap_(sh);
  const rows = Math.max(sh.getMaxRows(), 1);
  sh.getRange(1, cols.AMOUNT, rows, 1).setNumberFormat('$#,##0.00');
  sh.getRange(1, cols.TOTAL_CHARGED, rows, 1).setNumberFormat('$#,##0.00');
  [cols.MESSAGE, cols.RECEIPT].forEach(function (colIdx) {
    sh.getRange(1, colIdx, rows, 1).setWrap(true);
  });
  sh.autoResizeColumns(1, headers.length);

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Automatic', 'Manual'], true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, cols.CAPTURE_TYPE, Math.max(rows - 1, 1), 1).setDataValidation(
    rule
  );
}

// === SERVI server base URL ===
// If you change environments, change only this line.
const SERVI_BASE = 'https://servi-preauth.onrender.com';

function warmupServer_(base) {
  try {
    UrlFetchApp.fetch(base + '/config/stripe', {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
    });
  } catch (e) {}
  try {
    UrlFetchApp.fetch(base + '/', {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true,
    });
  } catch (e) {}
}

function InitiatePaymentIntentForScheduledOrder() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sh.getName() !== 'SERVI Orders') {
    SpreadsheetApp.getUi().alert('Use this on the "SERVI Orders" sheet.');
    return;
  }

  const row = sh.getActiveRange().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert(
      'Selecciona una fila de datos (fila 2 o abajo).'
    );
    return;
  }

  const orderId = String(
    sh.getRange(row, ORD_COL.ORDER_ID).getDisplayValue() || ''
  ).trim();
  if (!orderId) {
    SpreadsheetApp.getUi().alert(
      'No Order ID (columna L). Genera el enlace primero.'
    );
    return;
  }

  // Tell the server to confirm with saved card (off-session, 3DS fallback)
  const resp = UrlFetchApp.fetch(SERVI_BASE + '/confirm-with-saved', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ orderId }),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const body = resp.getContentText();
  let out = {};
  try {
    out = JSON.parse(body);
  } catch (_) {}

  if (code === 200) {
    // Off-session worked: authorized (requires_capture) or captured (succeeded)
    const label =
      out.status === 'requires_capture'
        ? 'Confirmed'
        : out.status === 'succeeded'
          ? 'Captured'
          : String(out.status || 'Confirmed');
    sh.getRange(row, ORD_COL.STATUS).setValue(label);
    sh.getRange(row, ORD_COL.PI_ID).setValue(String(out.paymentIntentId || ''));
    SpreadsheetApp.getUi().alert(
      'Listo. Webhook actualizará la hoja si cambia a Captured.'
    );
    return;
  }

  if (code === 409) {
    // Don’t touch column G anymore.
    // Just warn the agent and offer to force the preauth.
    const ui = SpreadsheetApp.getUi();

    let msg = out.message || 'Aún estás fuera de la ventana de 15 horas.';
    if (typeof out.remaining_hours === 'number') {
      msg += '\n(Faltan ~' + Math.ceil(out.remaining_hours) + ' h)';
    }
    if (out.preauth_window_opens_at) {
      try {
        const when = new Date(out.preauth_window_opens_at);
        const mx = Utilities.formatDate(
          when,
          'America/Mexico_City',
          'yyyy-MM-dd HH:mm'
        );
        msg += '\n(La ventana abre: ' + mx + ' hora local)';
      } catch (_) {}
    }

    const choice = ui.alert(
      'Preautorización temprana',
      msg + '\n\n¿Deseas forzar la preautorización ahora?',
      ui.ButtonSet.YES_NO
    );

    if (choice === ui.Button.YES) {
      // Try again, this time with force: true
      const resp2 = UrlFetchApp.fetch(SERVI_BASE + '/confirm-with-saved', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ orderId, force: true }),
        muteHttpExceptions: true,
      });

      const code2 = resp2.getResponseCode();
      const body2 = resp2.getContentText();
      let out2 = {};
      try {
        out2 = JSON.parse(body2);
      } catch (_) {}

      if (code2 === 200) {
        const label =
          out2.status === 'requires_capture'
            ? 'Confirmed'
            : out2.status === 'succeeded'
              ? 'Captured'
              : String(out2.status || 'Confirmed');
        sh.getRange(row, ORD_COL.STATUS).setValue(label);
        sh.getRange(row, ORD_COL.PI_ID).setValue(
          String(out2.paymentIntentId || '')
        );
        ui.alert('Listo. Webhook actualizará la hoja si cambia a Captured.');
        return;
      }

      if (code2 === 402 && out2.clientSecret) {
        const short = String(
          sh.getRange(row, ORD_COL.SHORT_CODE).getDisplayValue() || ''
        ).trim();
        const link = short
          ? SERVI_BASE + '/o/' + short
          : SERVI_BASE + '/book?orderId=' + encodeURIComponent(orderId);
        const msg2 = [
          'Tu banco pide verificación 3D Secure.',
          'Pide al cliente que abra este enlace y confirme:',
          link,
        ].join('\n');
        // Still do NOT touch column G
        sh.getRange(row, ORD_COL.STATUS).setValue('Pending (3DS)');
        ui.alert('Se requiere 3DS. Envia el enlace al cliente para confirmar.');
        return;
      }

      // Any other error on the forced attempt
      sh.getRange(row, ORD_COL.STATUS).setValue('Error');
      ui.alert('Error: ' + (out2.error || body2));
      return;
    }

    // If NO, simply exit with no changes to the sheet
    return;
  }

  if (code === 402 && out.clientSecret) {
    // 3DS required — send the customer back to /book to finish auth
    const short = String(
      sh.getRange(row, ORD_COL.SHORT_CODE).getDisplayValue() || ''
    ).trim();
    const link = short
      ? SERVI_BASE + '/o/' + short
      : SERVI_BASE + '/book?orderId=' + encodeURIComponent(orderId);
    const msg = [
      'Tu banco pide verificación 3D Secure.',
      'Pide al cliente que abra este enlace y confirme:',
      link,
    ].join('\n');

    sh.getRange(row, ORD_COL.LINK_MSG).setValue(msg);
    sh.getRange(row, ORD_COL.STATUS).setValue('Pending (3DS)');
    SpreadsheetApp.getUi().alert(
      'Se requiere 3DS. Envia el enlace al cliente para confirmar.'
    );
    return;
  }

  // Anything else → show error
  sh.getRange(row, ORD_COL.STATUS).setValue('Error');
  sh.getRange(row, ORD_COL.LINK_MSG).setValue(
    '⚠️ No se pudo iniciar la preautorización. Intenta nuevamente.'
  );
  SpreadsheetApp.getUi().alert('Error: ' + (out.error || body));
}

// Poll /config/stripe until 200 OK (max ~45s)
function waitForServerReady_(base) {
  var start = Date.now();
  var timeoutMs = 45000;
  while (Date.now() - start < timeoutMs) {
    try {
      var r = UrlFetchApp.fetch(base + '/config/stripe?ts=' + Date.now(), {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { 'Cache-Control': 'no-cache' },
      });
      var code = r.getResponseCode();
      if (code >= 200 && code < 300) return true;
    } catch (e) {}
    Utilities.sleep(1500);
  }
  return false;
}

function fetchWithRetry_(url, options, attempts) {
  var max = attempts || 6; // a bit higher during cold starts
  var lastErr;
  var baseUrl = url.replace(/\/[^/]*$/, '');

  for (var i = 0; i < max; i++) {
    try {
      Logger.log('[HTTP try %s/%s] %s', i + 1, max, url);
      var r = UrlFetchApp.fetch(url, options);
      var code = r.getResponseCode();
      Logger.log('[HTTP %s] code=%s', i + 1, code);

      if (code >= 200 && code < 300) return r;

      // Only these are worth retrying
      if (code === 502 || code === 503 || code === 504) {
        Logger.log('[HTTP %s] transient %s → warmup + retry…', i + 1, code);
        try {
          UrlFetchApp.fetch(baseUrl + '/config/stripe', {
            muteHttpExceptions: true,
          });
        } catch (e) {}
        Utilities.sleep(1500 + Math.floor(Math.random() * 400));
        throw new Error('Transient ' + code);
      }
      return r; // non-retryable
    } catch (e) {
      lastErr = e;
      var wait = 900 * Math.pow(2, i) + Math.floor(Math.random() * 300); // 0.9s, 1.8s, 3.6s…
      Logger.log(
        '[HTTP %s] exception: %s (sleep %sms)',
        i + 1,
        e.message,
        wait
      );
      Utilities.sleep(wait);
    }
  }
  throw lastErr || new Error('fetchWithRetry_ failed');
}

/** Build ISO-8601 with timezone offset for a Date in TZ. */
function toISOWithOffset_(dateObj, tz) {
  var isoLocal = Utilities.formatDate(dateObj, tz, "yyyy-MM-dd'T'HH:mm:ss");
  var off;
  try {
    off = Utilities.formatDate(dateObj, tz, 'XXX'); // e.g. -05:00
  } catch (e) {
    var z = Utilities.formatDate(dateObj, tz, 'Z'); // e.g. -0500
    off = z.replace(/(\+|-)(\d{2})(\d{2})$/, '$1$2:$3');
  }
  return isoLocal + off;
}

function setCellRichTextWithLink_(range, content, linkUrl) {
  if (!range) return;
  const text = content == null ? '' : String(content);
  const url = linkUrl == null ? '' : String(linkUrl).trim();
  if (!text) {
    range.setValue('');
    return;
  }
  if (!url) {
    range.setValue(text);
    return;
  }
  try {
    const builder = SpreadsheetApp.newRichTextValue().setText(text);
    const idx = text.indexOf(url);
    if (idx >= 0) {
      builder.setLinkUrl(idx, idx + url.length - 1, url);
    } else {
      builder.setLinkUrl(url);
    }
    range.setRichTextValue(builder.build());
  } catch (err) {
    range.setValue(text);
  }
}

function generatePaymentLink() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== 'SERVI Orders') {
    SpreadsheetApp.getUi().alert('Use this on the "SERVI Orders" sheet.');
    return;
  }

  const ui = SpreadsheetApp.getUi();

  const active = sheet.getActiveRange();
  if (!active) {
    try {
      ui.alert(
        'Selecciona una fila de datos (fila 2 o abajo) y vuelve a intentar.'
      );
    } catch (e) {}
    return;
  }

  const editedRow = active.getRow();
  if (editedRow < 2) {
    try {
      ui.alert('Selecciona una fila de datos (fila 2 o abajo).');
    } catch (e) {}
    return;
  }

  const dateCreatedCol = ORD_COL.DATE_CREATED;
  const clientNameCol = ORD_COL.CLIENT_NAME;
  const phoneCol = ORD_COL.PHONE;
  const serviceDescCol = ORD_COL.SERVICE_DESC;
  const amountCol = ORD_COL.AMOUNT;
  const serviceDateCol = ORD_COL.SERVICE_DT;
  const addressCol = ORD_COL.ADDRESS;
  const linkCol = ORD_COL.LINK_MSG;
  const statusCol = ORD_COL.STATUS;
  const receiptCol = ORD_COL.RECEIPT;
  const orderIdCol = ORD_COL.ORDER_ID;
  const paymentIntentCol = ORD_COL.PI_ID;
  const totalPaidCol = ORD_COL.TOTAL_PAID;
  const shortCodeCol = ORD_COL.SHORT_CODE;
  const clientIdCol = ORD_COL.CLIENT_ID;
  const clientTypeCol = ORD_COL.CLIENT_TYPE;
  const linkCell = sheet.getRange(editedRow, linkCol);

  const clientName = sheet.getRange(editedRow, clientNameCol).getValue();
  const serviceDescription = sheet
    .getRange(editedRow, serviceDescCol)
    .getValue();
  const amountMXN = sheet.getRange(editedRow, amountCol).getValue();
  const serviceDateRaw = sheet.getRange(editedRow, serviceDateCol).getValue();
  const serviceAddress = String(
    sheet.getRange(editedRow, addressCol).getDisplayValue() || ''
  ).trim();
  const rawPhone = sheet.getRange(editedRow, phoneCol).getDisplayValue();
  const clientPhone = normalizePhoneToE164(rawPhone);
  const clientTypeCell = sheet.getRange(editedRow, clientTypeCol);
  clientTypeCell.setValue('Guest');

  const TZ = 'America/Mexico_City';

  function parseServiceDateTime_(raw) {
    if (raw instanceof Date) return raw;
    const s = String(raw || '').trim();
    if (!s) return null;

    let m = s.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/
    );
    if (m) {
      let d = parseInt(m[1], 10),
        mo = parseInt(m[2], 10) - 1,
        y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      const hh = parseInt(m[4] || '0', 10);
      const mm = parseInt(m[5] || '0', 10);
      return new Date(y, mo, d, hh, mm, 0, 0);
    }

    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
    if (m) {
      const yy = +m[1],
        mo2 = +m[2] - 1,
        dd = +m[3],
        hh2 = +(m[4] || 0),
        mm2 = +(m[5] || 0);
      return new Date(yy, mo2, dd, hh2, mm2, 0, 0);
    }

    return null;
  }

  const parsedDate = parseServiceDateTime_(serviceDateRaw);
  const serviceDate = parsedDate
    ? Utilities.formatDate(parsedDate, TZ, 'yyyy-MM-dd')
    : '';
  const serviceDateTime = parsedDate ? toISOWithOffset_(parsedDate, TZ) : '';

  if (!amountMXN || isNaN(amountMXN)) {
    try {
      ui.alert('⚠️ Please enter a valid amount (MXN) in column E.');
    } catch (err) {
      Logger.log('⚠️ Invalid amount in column E.');
    }
    return;
  }

  const providerPrice = Number(amountMXN);
  if (!Number.isFinite(providerPrice) || providerPrice <= 0) {
    try {
      ui.alert('⚠️ Please enter a valid amount (MXN) in column E.');
    } catch (err) {
      Logger.log('⚠️ Invalid amount in column E.');
    }
    return;
  }

  const amount = Math.round(providerPrice * 100) / 100; // keep value in MXN (two decimals)

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      amount,
      clientName,
      serviceDescription,
      serviceDate,
      serviceDateTime,
      clientPhone,
      serviceAddress,
    }),
    headers: adminHeaders_(),
    muteHttpExceptions: true,
  };

  try {
    Logger.log(
      'POST /create-payment-intent payload=%s',
      JSON.stringify({
        amount,
        clientName,
        serviceDescription,
        serviceDate,
        serviceDateTime,
        clientPhone,
        serviceAddress,
      })
    );

    warmupServer_(SERVI_BASE);
    waitForServerReady_(SERVI_BASE);

    let response;
    try {
      response = fetchWithRetry_(
        SERVI_BASE + '/create-payment-intent?ts=' + Date.now(),
        options,
        8
      );
    } catch (err) {
      warmupServer_(SERVI_BASE);
      waitForServerReady_(SERVI_BASE);
      response = fetchWithRetry_(
        SERVI_BASE + '/create-payment-intent?ts=' + Date.now(),
        options,
        2
      );
    }

    const code = response.getResponseCode();
    const body = response.getContentText();
    Logger.log('HTTP %s', code);
    Logger.log('BODY %s', body);

    if (code < 200 || code >= 300) {
      try {
        const dataErr = JSON.parse(body);
        if (code === 403 && dataErr && dataErr.error === 'account_required') {
          const paymentLink = SERVI_BASE + '/o/' + dataErr.publicCode;
          const paymentText = [
            '¡Estás a un paso de confirmar tu servicio!',
            'Elige tu método de pago y reserva a través de nuestro enlace seguro con Stripe:',
            paymentLink,
          ].join('\n');

          sheet
            .getRange(editedRow, orderIdCol)
            .setValue(String(dataErr.orderId));
          sheet.getRange(editedRow, paymentIntentCol).clearContent();
          setCellRichTextWithLink_(linkCell, paymentText, paymentLink);
          sheet.getRange(editedRow, statusCol).setValue('Setup required');
          sheet
            .getRange(editedRow, shortCodeCol)
            .setValue(String(dataErr.publicCode));

          const totalCents403 = Number(dataErr.amount ?? 0);
          if (Number.isFinite(totalCents403) && totalCents403 >= 0) {
            sheet
              .getRange(editedRow, totalPaidCol)
              .setValue(totalCents403 / 100);
          }

          const existingDate = sheet
            .getRange(editedRow, dateCreatedCol)
            .getDisplayValue();
          if (!existingDate) {
            const ts = Utilities.formatDate(
              new Date(),
              'America/Mexico_City',
              'yyyy-MM-dd HH:mm:ss'
            );
            sheet.getRange(editedRow, dateCreatedCol).setValue(ts);
            sheet
              .getRange(editedRow, dateCreatedCol)
              .setNumberFormat('yyyy-mm-dd hh:mm:ss');
          }
          return;
        }
      } catch (_) {}
      throw new Error('Server ' + code + ': ' + body);
    }

    const data = JSON.parse(body);
    Logger.log('Parsed Response: %s', JSON.stringify(data));

    if (!data.publicCode) throw new Error('Missing publicCode in response');

    const paymentLink = SERVI_BASE + '/o/' + data.publicCode;
    const paymentText = [
      '¡Estás a un paso de confirmar tu servicio!',
      'Elige tu método de pago y reserva a través de nuestro enlace seguro con Stripe:',
      paymentLink,
    ].join('\n');

    sheet.getRange(editedRow, orderIdCol).setValue(String(data.orderId));
    sheet
      .getRange(editedRow, paymentIntentCol)
      .setValue(String(data.paymentIntentId || ''));
    setCellRichTextWithLink_(linkCell, paymentText, paymentLink);
    sheet
      .getRange(editedRow, statusCol)
      .setValue(data.requiresSetup ? 'Setup required' : 'Pending');
    sheet.getRange(editedRow, shortCodeCol).setValue(String(data.publicCode));
    const totalCents = Number(data.amount ?? 0);
    if (Number.isFinite(totalCents) && totalCents >= 0) {
      sheet.getRange(editedRow, totalPaidCol).setValue(totalCents / 100);
    }

    updateIdentityColumns_(sheet, editedRow, String(data.orderId));

    const existingDate = sheet
      .getRange(editedRow, dateCreatedCol)
      .getDisplayValue();
    if (!existingDate) {
      const ts = Utilities.formatDate(
        new Date(),
        'America/Mexico_City',
        'yyyy-MM-dd HH:mm:ss'
      );
      sheet.getRange(editedRow, dateCreatedCol).setValue(ts);
      sheet
        .getRange(editedRow, dateCreatedCol)
        .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    }
  } catch (err) {
    Logger.log(
      '❌ generatePaymentLink ERROR: %s\nSTACK: %s',
      err.message,
      err.stack
    );

    let humanMsg =
      '⚠️ Servidor ocupado (503). Intenta de nuevo en 1–2 minutos.';
    if (String((err && err.message) || '').indexOf('Transient 503') === -1) {
      humanMsg = '⚠️ No se pudo generar el enlace. Reintenta.';
    }
    linkCell.setValue(humanMsg);
    sheet.getRange(editedRow, statusCol).setValue('Error');

    const cell = sheet.getRange(editedRow, orderIdCol);
    if (!cell.getValue() || String(cell.getValue()).startsWith('ERROR')) {
      cell.setValue('ERROR: ' + (err.message || 'Unknown'));
    }
  }
}

function generateAdjustment() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEET_NAMES.ADJUSTMENTS) {
    SpreadsheetApp.getUi().alert('Use this on the "SERVI Adjustments" sheet.');
    return;
  }

  const row = sh.getActiveRange().getRow();
  if (row < 2) return;

  const COL = adjustmentsColumnMap_(sh);
  const messageCell = sh.getRange(row, COL.MESSAGE);

  const parentOrderId = String(
    sh.getRange(row, COL.PARENT_ORDER_ID).getDisplayValue() || ''
  ).trim();
  const reason = String(
    sh.getRange(row, COL.REASON).getDisplayValue() || ''
  ).trim();
  const amountMXN = Number(sh.getRange(row, COL.AMOUNT).getValue() || 0);

  if (!parentOrderId) {
    SpreadsheetApp.getUi().alert('Parent Order ID required.');
    return;
  }
  if (!amountMXN || isNaN(amountMXN)) {
    SpreadsheetApp.getUi().alert('Enter a valid Amount (MXN).');
    return;
  }

  const captureChoice = String(
    sh.getRange(row, COL.CAPTURE_TYPE).getDisplayValue() || ''
  ).trim();
  const capture = /^manual$/i.test(captureChoice) ? 'manual' : 'automatic';

  try {
    const r = UrlFetchApp.fetch(
      SERVI_BASE + '/orders/' + encodeURIComponent(parentOrderId) + '/consent',
      { method: 'get', muteHttpExceptions: true }
    );
    if (r.getResponseCode() === 200) {
      const data = JSON.parse(r.getContentText() || '{}');
      sh.getRange(row, COL.CONSENT).setValue(
        data && data.ok ? 'Yes' : 'Missing'
      );
    } else {
      sh.getRange(row, COL.CONSENT).setValue('Unknown');
    }
  } catch (_) {
    sh.getRange(row, COL.CONSENT).setValue('Unknown');
  }

  const payload = {
    parentOrderId,
    amount: Math.round(amountMXN * 100),
    note: reason || 'SERVI adjustment',
    capture,
  };

  warmupServer_(SERVI_BASE);
  waitForServerReady_(SERVI_BASE);

  let resp;
  try {
    resp = fetchWithRetry_(
      SERVI_BASE + '/create-adjustment?ts=' + Date.now(),
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        headers: adminHeaders_(),
        muteHttpExceptions: true,
      },
      6
    );
  } catch (errFirst) {
    warmupServer_(SERVI_BASE);
    waitForServerReady_(SERVI_BASE);
    resp = fetchWithRetry_(
      SERVI_BASE + '/create-adjustment?ts=' + Date.now(),
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        headers: adminHeaders_(),
        muteHttpExceptions: true,
      },
      2
    );
  }

  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    throw new Error(resp.getContentText());
  }

  const out = JSON.parse(resp.getContentText());
  const shortLink = SERVI_BASE + '/o/' + out.publicCode;

  sh.getRange(row, COL.ADJUSTMENT_ORDER_ID).setValue(out.childOrderId || '');
  sh.getRange(row, COL.SHORT_CODE).setValue(out.publicCode || '');
  sh.getRange(row, COL.PAYMENT_INTENT_ID).setValue(out.paymentIntentId || '');

  const totalCents = Number(out.totalAmountCents || 0);
  const totalMXN = totalCents > 0 ? totalCents / 100 : amountMXN;
  const totalCell = sh.getRange(row, COL.TOTAL_CHARGED);
  if (totalCents > 0) {
    totalCell.setValue(totalMXN);
    totalCell.setNumberFormat('$#,##0.00');
  } else {
    totalCell.clearContent();
  }

  const flow = String(out.flow || out.mode || '').toLowerCase();
  const linkLabel = flow === 'book' ? 'Link (cliente)' : 'Link (invitado)';
  sh.getRange(row, COL.REQ3DS).setValue(linkLabel);
  sh.getRange(row, COL.STATUS).setValue('Pending');
  sh.getRange(row, COL.CLIENT_ID).setValue(out.customerId || '');

  const effectiveReason = String(out.adjustmentReason || reason || '').trim();
  const formattedTotal = totalMXN.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
  const messageLines = [
    'Necesitamos confirmar un ajuste en tu servicio.',
    'Monto total: ' + formattedTotal,
    effectiveReason ? 'Motivo: ' + effectiveReason : '',
    flow === 'book'
      ? 'Confírmalo con tu método guardado aquí:'
      : 'Confírmalo aquí:',
    shortLink,
  ].filter(Boolean);
  setCellRichTextWithLink_(messageCell, messageLines.join('\n'), shortLink);
}

function captureCompletedService() {
  const sh = SpreadsheetApp.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (!sh) {
    ui.alert('No hay una hoja activa.');
    return;
  }

  const sheetName = sh.getName();
  const isOrders = sheetName === SHEET_NAMES.ORDERS;
  const isAdjustments = sheetName === SHEET_NAMES.ADJUSTMENTS;
  if (!isOrders && !isAdjustments) {
    ui.alert(
      'Usa esta herramienta en las hojas "SERVI Orders" o "SERVI Adjustments".'
    );
    return;
  }

  const active = sh.getActiveRange();
  if (!active) {
    ui.alert(
      'Selecciona una fila de datos (fila 2 o abajo) y vuelve a intentar.'
    );
    return;
  }
  const row = active.getRow();
  if (row < 2) {
    ui.alert('Selecciona una fila de datos (fila 2 o abajo).');
    return;
  }

  let orderId = '';
  let status = '';

  if (isOrders) {
    const COL = ordersColumnMap_(sh);
    orderId = String(
      sh.getRange(row, COL.ORDER_ID).getDisplayValue() || ''
    ).trim();
    status = String(
      sh.getRange(row, COL.STATUS).getDisplayValue() || ''
    ).trim();

    if (!orderId) {
      ui.alert('No Order ID en la fila seleccionada.');
      return;
    }
    if (/^captured$/i.test(status)) {
      ui.alert('Este servicio ya fue capturado.');
      return;
    }
  } else {
    const COL = adjustmentsColumnMap_(sh);
    orderId = String(
      sh.getRange(row, COL.ADJUSTMENT_ORDER_ID).getDisplayValue() || ''
    ).trim();
    status = String(
      sh.getRange(row, COL.STATUS).getDisplayValue() || ''
    ).trim();

    if (!orderId) {
      ui.alert('No Adjustment Order ID en la fila seleccionada.');
      return;
    }
    if (/^captured$/i.test(status)) {
      ui.alert('Este ajuste ya fue capturado.');
      return;
    }
  }

  let resp;
  try {
    resp = UrlFetchApp.fetch(SERVI_BASE + '/capture-order', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ orderId }),
      headers: adminHeaders_(),
      muteHttpExceptions: true,
    });
  } catch (err) {
    ui.alert('No se pudo enviar la solicitud de captura. Intenta de nuevo.');
    return;
  }

  const code = resp.getResponseCode();
  if (code >= 200 && code < 300) {
    ui.alert('Solicitud enviada. El estado cambiará a Captured vía webhook.');
  } else {
    ui.alert('Capture failed: ' + resp.getContentText());
  }
}

function updateIdentityColumns_(sheet, row, orderId) {
  // 1) Client ID from order snapshot
  try {
    const r = UrlFetchApp.fetch(
      SERVI_BASE + '/order/' + encodeURIComponent(orderId),
      {
        method: 'get',
        muteHttpExceptions: true,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
    if (r.getResponseCode() >= 200 && r.getResponseCode() < 300) {
      const d = JSON.parse(r.getContentText() || '{}');
      const totalCentsSnapshot = Number(
        (d.pricing_total_amount ?? d.amount) || 0
      );
      if (Number.isFinite(totalCentsSnapshot) && totalCentsSnapshot >= 0) {
        sheet
          .getRange(row, ORD_COL.TOTAL_PAID)
          .setValue(totalCentsSnapshot / 100);
      }
      if (d.customer_id)
        sheet.getRange(row, ORD_COL.CLIENT_ID).setValue(String(d.customer_id));
    }
  } catch (_) {}

  // 2) Client Type from consent
  try {
    const r2 = UrlFetchApp.fetch(
      SERVI_BASE + '/orders/' + encodeURIComponent(orderId) + '/consent',
      { method: 'get', muteHttpExceptions: true }
    );
    if (r2.getResponseCode() === 200) {
      const c = JSON.parse(r2.getContentText() || '{}');
      const cell = sheet.getRange(row, ORD_COL.CLIENT_TYPE);
      if (c && c.ok) {
        cell.setValue('SERVI Client');
      } else {
        cell.setValue('Guest');
      }
    }
  } catch (_) {}
}

/** Normalize phone to E.164 (+52 default for 10-digit MX). */
function normalizePhoneToE164(raw, defaultCountry) {
  defaultCountry = defaultCountry || '+52';
  if (!raw) return '';
  var digits = String(raw).replace(/\D+/g, '');

  if (String(raw).trim().startsWith('+')) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return defaultCountry + digits;
  }
  if (digits.length === 11 && digits.charAt(0) === '1') {
    return '+' + digits;
  }
  return '+' + digits;
}

function resyncSelectedRow() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.ORDERS
  );
  if (!sh) {
    SpreadsheetApp.getUi().alert('Sheet "SERVI Orders" not found.');
    return;
  }

  const row = sh.getActiveRange().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert(
      'Selecciona una fila de datos (fila 2 o abajo).'
    );
    return;
  }

  const COL = ordersColumnMap_(sh);
  const base = SERVI_BASE;

  const orderId = String(
    sh.getRange(row, COL.ORDER_ID).getDisplayValue() || ''
  ).trim();
  if (!orderId) {
    SpreadsheetApp.getUi().alert('No Order ID en la fila seleccionada.');
    return;
  }

  let data;
  try {
    const resp = UrlFetchApp.fetch(
      base + '/order/' + encodeURIComponent(orderId) + '?allowExpired=1',
      {
        method: 'get',
        muteHttpExceptions: true,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
    if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
      SpreadsheetApp.getUi().alert('Server error: ' + resp.getContentText());
      return;
    }
    data = JSON.parse(resp.getContentText());
    const totalCentsResync = Number(
      (data.pricing_total_amount ?? data.amount) || 0
    );
    if (Number.isFinite(totalCentsResync) && totalCentsResync >= 0) {
      sh.getRange(row, COL.TOTAL_PAID).setValue(totalCentsResync / 100);
    }

    const hoursCell = sh.getRange(row, ORD_COL.HOURS);
    const hasFormula = !!hoursCell.getFormula();
    if (!hasFormula && typeof data.hours_ahead === 'number') {
      hoursCell.setValue(data.hours_ahead);
    }
  } catch (err) {
    SpreadsheetApp.getUi().alert('Could not reach server.');
    return;
  }

  if (data.customer_id) {
    sh.getRange(row, ORD_COL.CLIENT_ID).setValue(String(data.customer_id));
  }

  try {
    const consentResp = UrlFetchApp.fetch(
      `${SERVI_BASE}/orders/${encodeURIComponent(orderId)}/consent`,
      { method: 'get', muteHttpExceptions: true }
    );
    if (consentResp.getResponseCode() === 200) {
      const consent = JSON.parse(consentResp.getContentText() || '{}');
      const typeCell = sh.getRange(row, ORD_COL.CLIENT_TYPE);
      const existingType = String(typeCell.getDisplayValue() || '').trim();
      if (consent && consent.ok) {
        typeCell.setValue('SERVI Client');
      } else if (!existingType) {
        typeCell.setValue('Guest');
      }
    }
  } catch (_) {
    // leave existing value if consent lookup fails
  }

  function writeStatusSafely(newStatus) {
    const current = String(
      sh.getRange(row, COL.STATUS).getDisplayValue() || ''
    ).trim();
    const next = String(newStatus || '').trim();
    if (!next || next === current) return;
    if (current === 'Captured') return;

    if (
      next === 'Canceled' ||
      next === 'Failed' ||
      next === 'Declined' ||
      next.startsWith('Canceled (')
    ) {
      sh.getRange(row, COL.STATUS).setValue(next);
      return;
    }

    const forwardOnly = {
      '': [
        'Pending',
        'Setup required',
        'Pending (3DS)',
        'Scheduled',
        'Confirmed',
        'Captured',
      ],
      Pending: [
        'Setup required',
        'Pending (3DS)',
        'Scheduled',
        'Confirmed',
        'Captured',
      ],
      'Setup required': ['Pending (3DS)', 'Scheduled', 'Confirmed', 'Captured'],
      'Pending (3DS)': ['Scheduled', 'Confirmed', 'Captured'],
      Scheduled: ['Confirmed', 'Captured'],
      Confirmed: ['Captured'],
    };

    if ((forwardOnly[current] || []).includes(next)) {
      sh.getRange(row, COL.STATUS).setValue(next);
    }
  }

  const savedCard = !!data.saved_card;
  const kind = String(data.kind || '').toLowerCase();
  const statusDb = String(data.status || '').trim();
  const piId = String(data.payment_intent_id || '').trim();
  const hoursAhead =
    typeof data.hours_ahead === 'number' ? data.hours_ahead : null;

  if (piId && (/^confirmed$/i.test(statusDb) || /^captured$/i.test(statusDb))) {
    writeStatusSafely(statusDb);
    SpreadsheetApp.getUi().alert('Fila re-sincronizada: ' + statusDb + '.');
    return;
  }

  if (kind === 'setup_required' && !savedCard) {
    writeStatusSafely('Setup required');
    SpreadsheetApp.getUi().alert('Fila re-sincronizada: Setup required.');
    return;
  }

  if (savedCard) {
    const farFromService =
      hoursAhead === null ? kind === 'book' : hoursAhead > 15;
    if (farFromService) {
      writeStatusSafely('Scheduled');
      SpreadsheetApp.getUi().alert('Fila re-sincronizada: Scheduled.');
      return;
    }
  }

  if (savedCard && hoursAhead !== null && hoursAhead <= 15 && !piId) {
    writeStatusSafely('Scheduled');
    SpreadsheetApp.getUi().alert(
      'Fila re-sincronizada: Scheduled (ventana abierta).'
    );
    return;
  }

  if (statusDb) writeStatusSafely(statusDb);

  SpreadsheetApp.getUi().alert('Fila re-sincronizada.');
}

function keepAlive_() {
  try {
    UrlFetchApp.fetch(SERVI_BASE + '/config/stripe', {
      muteHttpExceptions: true,
    });
  } catch (e) {}
  try {
    UrlFetchApp.fetch(SERVI_BASE + '/', { muteHttpExceptions: true });
  } catch (e) {}
}

function adminHeaders_() {
  const token =
    PropertiesService.getScriptProperties().getProperty('ADMIN_API_TOKEN');
  if (!token) throw new Error('ADMIN_API_TOKEN script property is missing');
  return { Authorization: `Bearer ${token}` };
}

// If you prefer reliability in headless triggers, set your ID here:
const SPREADSHEET_ID = '1rN6zELCW-iFLPXNecFsoxSEIuqrIBxvIUa2n3cxU0gY';
