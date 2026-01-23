// Local mirror of Google Apps Script project for editing only; changes must be pasted back into Apps Script.
const SHEET_NAMES = {
  ORDERS: 'SERVI Orders',
  ADJUSTMENTS: 'SERVI Adjustments',
  CHANGES: 'SERVI Changes',
};

const ORDER_HEADER_ALIASES = {
  CLIENT_NAME: ['Client Name'],
  EMAIL: ['Email'],
  PHONE: ['WhatsApp Number', 'WhatsApp (E.164)', 'WhatsApp Associated'],
  SERVICE_DESC: ['Service Description'],
  BOOKING_TYPE: ['Booking type', 'Booking Type'],
  CAPTURE_TYPE: ['Capture Type'],
  AMOUNT: ['Amount (MXN)', 'Amount'],
  FINAL_CAPTURED: [
    'Final Captured Amount',
    'Captured (Final)',
    'Net Captured Amount',
  ],
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
  UPDATE_PAYMENT_METHOD: ['Billing Portal Link', 'Update payment method'],
};

const OPTIONAL_ORDER_COLUMNS = {
  UPDATE_PAYMENT_METHOD: true,
  FINAL_CAPTURED: true,
  EMAIL: true, // new column; keep optional to avoid breaking older sheets, but enforce in UI
  CAPTURE_TYPE: true,
};

const ADJ_HEADER_ALIASES = {
  PARENT_ORDER_ID: ['Parent Order ID'],
  REASON: ['Adjustment Type', 'Reason'],
  AMOUNT: ['Amount (MXN)', 'Amount'],
  FINAL_PRICE: ['Final Price'],
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

const ADJ_OPTIONAL_COLUMNS = {
  FINAL_PRICE: true,
};

const CHANGE_HEADER_ALIASES = {
  CHANGE_ID: ['Change ID'],
  ORDER_ID: ['Parent Order ID', 'Order ID'],
  TYPE: ['Change Type'],
  ORIGINAL_DATE: ['Original Date'],
  ORIGINAL_TIME: ['Original Time'],
  ORIGINAL_ADDRESS: ['Original Address'],
  ORIGINAL_STATUS: ['Original Status'],
  REQUESTED_DATE: ['Requested Date'],
  REQUESTED_TIME: ['Requested Time'],
  REQUESTED_ADDRESS: ['Requested Address'],
  REQUESTED_BY: ['Requested By'],
  STATUS: ['Status'],
  APPLIED_NOTE: ['Applied Note'],
  NOTES: ['Notes'],
  CREATED_AT: ['Created At'],
  PROCESSED_AT: ['Processed At'],
};

const CHANGE_OPTIONAL_COLUMNS = {
  REQUESTED_ADDRESS: true,
  REQUESTED_TIME: true,
};

const PREAUTH_WINDOW_HOURS = 24;
const EARLY_PREAUTH_THRESHOLD_HOURS = 72;

const HEADER_CACHE = Object.create(null);
const CACHE_KEY_TO_SHEET = {
  orders: SHEET_NAMES.ORDERS,
  adjustments: SHEET_NAMES.ADJUSTMENTS,
  changes: SHEET_NAMES.CHANGES,
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

function buildColumnMapFromSheet_(sheet, aliasMap, sheetLabel, optionalKeys) {
  const headerMap = getSheetHeaderMap_(sheet);
  const result = {};
  Object.keys(aliasMap).forEach(function (key) {
    const idx = resolveColumnIndex_(headerMap, aliasMap[key]);
    if (!idx) {
      if (optionalKeys && optionalKeys[key]) {
        return;
      }
      const aliases = [].concat(aliasMap[key] || []);
      throw new Error(
        sheetLabel + ' is missing the "' + aliases[0] + '" column header.'
      );
    }
    result[key] = idx;
  });
  return result;
}

function getColumnMap_(cacheKey, sheetName, aliasMap, sheetOpt, optionalKeys) {
  const sheet = sheetOpt || getSheet_(sheetName);
  if (!sheet) throw new Error('Sheet "' + sheetName + '" not found.');
  const cacheId = headerCacheKey_(cacheKey, sheet);
  if (!HEADER_CACHE[cacheId]) {
    HEADER_CACHE[cacheId] = buildColumnMapFromSheet_(
      sheet,
      aliasMap,
      sheetName,
      optionalKeys
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
    sheetOpt,
    OPTIONAL_ORDER_COLUMNS
  );
}
function adjustmentsColumnMap_(sheetOpt) {
  return getColumnMap_(
    'adjustments',
    SHEET_NAMES.ADJUSTMENTS,
    ADJ_HEADER_ALIASES,
    sheetOpt,
    ADJ_OPTIONAL_COLUMNS
  );
}
function changesColumnMap_(sheetOpt) {
  return getColumnMap_(
    'changes',
    SHEET_NAMES.CHANGES,
    CHANGE_HEADER_ALIASES,
    sheetOpt,
    CHANGE_OPTIONAL_COLUMNS
  );
}

function createColumnProxy_(cacheKey, sheetName, aliasMap, optionalKeys) {
  return new Proxy(
    {},
    {
      get: function (_target, prop) {
        if (typeof prop !== 'string') return undefined;
        const map = getColumnMap_(
          cacheKey,
          sheetName,
          aliasMap,
          undefined,
          optionalKeys
        );
        const key = prop.toUpperCase();
        if (key in map) {
          return map[key];
        }
        if (optionalKeys && optionalKeys[key]) {
          return null;
        }
        throw new Error(
          'Unknown column key "' + prop + '" for sheet "' + sheetName + '".'
        );
      },
    }
  );
}

const ORD_COL = createColumnProxy_(
  'orders',
  SHEET_NAMES.ORDERS,
  ORDER_HEADER_ALIASES,
  OPTIONAL_ORDER_COLUMNS
);
const ADJ_COL = createColumnProxy_(
  'adjustments',
  SHEET_NAMES.ADJUSTMENTS,
  ADJ_HEADER_ALIASES
);
const CHG_COL = createColumnProxy_(
  'changes',
  SHEET_NAMES.CHANGES,
  CHANGE_HEADER_ALIASES,
  CHANGE_OPTIONAL_COLUMNS
);

const BOOKING_TYPE_LABELS = {
  RANGO: 'Rango de Precio',
  VISITA: 'Visita para cotizar',
};

function normalizeBookingType_(value) {
  const raw = String(value || '').trim();
  if (!raw) return BOOKING_TYPE_LABELS.RANGO;
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized.indexOf('visita') !== -1) return BOOKING_TYPE_LABELS.VISITA;
  if (normalized.indexOf('anticipo') !== -1) return BOOKING_TYPE_LABELS.VISITA; // map legacy anticipo to visita
  if (normalized.indexOf('rango') !== -1) return BOOKING_TYPE_LABELS.RANGO;
  return BOOKING_TYPE_LABELS.RANGO;
}

function normalizeEmail_(raw) {
  const email = String(raw || '')
    .trim()
    .toLowerCase();
  if (!email) return '';
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email) ? email : '';
}

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
      .addItem('Create test LIVE payment link', 'createLiveTestPaymentLink')
      .addItem('Open Order Actions Sidebar', 'openOrderActionsSidebar')
      .addItem('Re-sync Selected Row', 'resyncSelectedRow')
      .addItem('Process Pending Order Changes', 'processPendingOrderChanges_')
      .addSeparator()
      .addItem('Install Auto-Preauth (hourly)', 'installAutoPreauthTrigger_')
      .addItem('Remove Auto-Preauth', 'removeAutoPreauthTrigger_')
      .addToUi();

    const ss = getSpreadsheet_();

    ensureOrdersDateCreatedColumn_();
    ensureOrdersHoursColumn_();
    ensureOrdersCaptureTypeColumn_();

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
    ensureChangesSheet_();
  } catch (e) {
    Logger.log('UI not available in this context: ' + e.message);
  }
}

function run_autoPreauthOnce() {
  autoPreauthScheduled_();
}

function applyConfirmWithSavedResult_(sheet, row, code, out, updatePaymentCol) {
  if (!sheet) return false;
  const updateCol =
    typeof updatePaymentCol === 'number' && updatePaymentCol > 0
      ? updatePaymentCol
      : ORD_COL.UPDATE_PAYMENT_METHOD;

  if (code === 200 && out && out.createdOnly) {
    if (out.paymentIntentId) {
      sheet
        .getRange(row, ORD_COL.PI_ID)
        .setValue(String(out.paymentIntentId || ''));
    }
    const label = String(out.status || '').trim();
    if (label) {
      sheet.getRange(row, ORD_COL.STATUS).setValue(label);
    }
    return true;
  }

  if (code === 200) {
    const label =
      out.status === 'requires_capture'
        ? 'Confirmed'
        : out.status === 'succeeded'
          ? 'Captured'
          : String(out.status || 'Confirmed');
    sheet.getRange(row, ORD_COL.STATUS).setValue(label);
    sheet
      .getRange(row, ORD_COL.PI_ID)
      .setValue(String(out.paymentIntentId || ''));
    if (updateCol) {
      sheet.getRange(row, updateCol).clearContent();
    }
    return true;
  }

  if (code === 402 && out.clientSecret) {
    sheet.getRange(row, ORD_COL.STATUS).setValue('Pending (3DS)');
    if (out.paymentIntentId) {
      sheet
        .getRange(row, ORD_COL.PI_ID)
        .setValue(String(out.paymentIntentId || ''));
    }
    return true;
  }

  if (code === 409) {
    sheet.getRange(row, ORD_COL.STATUS).setValue('Declined');
    if (out.paymentIntentId) {
      sheet
        .getRange(row, ORD_COL.PI_ID)
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
    if (retryMessage && updateCol) {
      sheet.getRange(row, updateCol).setValue(retryMessage);
    }
    return true;
  }

  return false;
}

function autoPreauthScheduled_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName('SERVI Orders');
  if (!sh) return;
  const updatePaymentCol = ORD_COL.UPDATE_PAYMENT_METHOD;
  const deadline = Date.now() + 5 * 60 * 1000; // stop early to avoid 6m limit

  const last = sh.getLastRow();
  for (let r = 2; r <= last; r++) {
    if (Date.now() > deadline) break;
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
    if (isNaN(hours) || hours > PREAUTH_WINDOW_HOURS) continue;
    if (pi) continue; // already has a PI / progressed

    try {
      const resp = UrlFetchApp.fetch(SERVI_BASE + '/confirm-with-saved', {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ orderId, allowExpired: true }),
        headers: adminHeaders_(),
        muteHttpExceptions: true,
      });
      const code = resp.getResponseCode();
      let out = {};
      try {
        out = JSON.parse(resp.getContentText() || '{}');
      } catch (_) {
        out = {};
      }
      applyConfirmWithSavedResult_(sh, r, code, out, updatePaymentCol);
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
        `=AND($${statusColLetter}${startRow}="Scheduled",$${hoursColLetter}${startRow}>${PREAUTH_WINDOW_HOURS})`
      )
      .setBackground('#FFE598')
      .setRanges([hoursRange])
      .build();

    const greenRule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(
        `=AND($${statusColLetter}${startRow}="Confirmed",$${hoursColLetter}${startRow}<=${PREAUTH_WINDOW_HOURS},$${hoursColLetter}${startRow}>2)`
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

function ensureOrdersCaptureTypeColumn_() {
  const sh = getSheet_(SHEET_NAMES.ORDERS);
  if (!sh) return;
  const col = ORD_COL.CAPTURE_TYPE;
  if (!col) return;
  try {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Automatic', 'Manual'], true)
      .setAllowInvalid(false)
      .build();
    const rows = Math.max(sh.getMaxRows() - 1, 1);
    sh.getRange(2, col, rows, 1).setDataValidation(rule);
  } catch (err) {
    Logger.log('ensureOrdersCaptureTypeColumn_: ' + err.message);
  }
}

function ensureAdjustmentsSheet() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(SHEET_NAMES.ADJUSTMENTS);

  const headers = [
    'Parent Order ID',
    'Adjustment Type',
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
  if (cols.FINAL_PRICE) {
    sh.getRange(1, cols.FINAL_PRICE, rows, 1).setNumberFormat('$#,##0.00');
  }
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

  const adjTypeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(
      ['Surcharge', 'Final price', 'Deposit (anticipo)', 'Billing error'],
      true
    )
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, cols.REASON, Math.max(rows - 1, 1), 1).setDataValidation(
    adjTypeRule
  );
}

function ensureChangesSheet_() {
  const ss = getSpreadsheet_();
  let sh = ss.getSheetByName(SHEET_NAMES.CHANGES);

  const headers = [
    'Change ID',
    'Parent Order ID',
    'Change Type',
    'Original Date',
    'Original Time',
    'Original Address',
    'Original Status',
    'Requested Date',
    'Requested Time',
    'Requested Address',
    'Requested By',
    'Status',
    'Applied Note',
    'Notes',
    'Created At',
    'Processed At',
  ];

  if (!sh) {
    sh = ss.insertSheet(SHEET_NAMES.CHANGES);
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

  clearColumnCache_('changes', sh);

  const cols = changesColumnMap_(sh);
  const rows = Math.max(sh.getMaxRows(), 1);
  [cols.REQUESTED_ADDRESS, cols.ORIGINAL_ADDRESS, cols.NOTES, cols.APPLIED_NOTE].forEach(function (colIdx) {
    if (!colIdx) return;
    sh.getRange(1, colIdx, rows, 1).setWrap(true);
  });
  if (cols.CREATED_AT) {
    sh.getRange(2, cols.CREATED_AT, Math.max(rows - 1, 1), 1).setNumberFormat(
      'yyyy-mm-dd hh:mm:ss'
    );
  }
  if (cols.PROCESSED_AT) {
    sh
      .getRange(2, cols.PROCESSED_AT, Math.max(rows - 1, 1), 1)
      .setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  if (cols.REQUESTED_DATE) {
    sh.getRange(2, cols.REQUESTED_DATE, Math.max(rows - 1, 1), 1).setNumberFormat(
      'yyyy-mm-dd'
    );
  }
  if (cols.ORIGINAL_DATE) {
    sh.getRange(2, cols.ORIGINAL_DATE, Math.max(rows - 1, 1), 1).setNumberFormat(
      'yyyy-mm-dd'
    );
  }
  const typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Reschedule', 'Cancel', 'Address update'], true)
    .setAllowInvalid(true)
    .build();
  sh
    .getRange(2, cols.TYPE, Math.max(rows - 1, 1), 1)
    .setDataValidation(typeRule);

  sh.autoResizeColumns(1, headers.length);
}

// === SERVI server base URL ===
// If you change environments, change only this line.
const SERVI_BASE = 'https://servi-preauth.onrender.com';
const FRONTEND_BASE = (function resolveFrontendBase_() {
  const raw =
    (typeof FRONTEND_BASE_URL === 'string' && FRONTEND_BASE_URL) ||
    'https://servi-preauth.pages.dev';
  return String(raw).replace(/\/+$/, '');
})();
const LIVE_TEST_AMOUNT_MXN = 10;

function buildPayLink_(orderId) {
  if (!orderId) return '';
  return FRONTEND_BASE + '/pay.html?order=' + encodeURIComponent(orderId);
}

function buildBookLink_(orderId, retryToken) {
  if (!orderId) return '';
  var url = FRONTEND_BASE + '/book.html?orderId=' + encodeURIComponent(orderId);
  if (retryToken) {
    url += '&rt=' + encodeURIComponent(retryToken);
  }
  return url;
}

function buildSuccessLink_(orderId) {
  if (!orderId) return '';
  return FRONTEND_BASE + '/success.html?order=' + encodeURIComponent(orderId);
}

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
    payload: JSON.stringify({ orderId, allowExpired: true }),
    headers: adminHeaders_(),
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

    let msg = out.message || 'Aún estás fuera de la ventana de 24 horas.';
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
        payload: JSON.stringify({ orderId, force: true, allowExpired: true }),
        headers: adminHeaders_(),
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
        const link = buildBookLink_(orderId);
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
    const link = buildBookLink_(orderId);
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

function buildBookingLinkMessage_(bookingType, paymentLink) {
  const type = normalizeBookingType_(bookingType);
  if (type === BOOKING_TYPE_LABELS.VISITA) {
    return [
      'Usa este enlace para agendar tu visita de diagnóstico.',
      'El monto cubre la visita y se descuenta del total si decides continuar con el servicio.',
      'Enlace seguro con Stripe:',
      paymentLink,
    ].join('\n');
  }
  return [
    'Usa este enlace para reservar tu servicio.',
    'SERVI solo cobrará al finalizar el trabajo, según lo realizado.',
    'Enlace seguro con Stripe:',
    paymentLink,
  ].join('\n');
}

function createLiveTestPaymentLink() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (sheet.getName() !== SHEET_NAMES.ORDERS) {
    ui.alert('Use this on the "SERVI Orders" sheet.');
    return;
  }
  const row = sheet.getActiveRange().getRow();
  if (row < 2) {
    ui.alert('Selecciona una fila de datos (fila 2 o abajo).');
    return;
  }

  const COL = ordersColumnMap_(sheet);
  const linkCell = sheet.getRange(row, COL.LINK_MSG);
  const statusCell = sheet.getRange(row, COL.STATUS);
  const amountCell = sheet.getRange(row, COL.AMOUNT);
  const shortCodeCell = sheet.getRange(row, COL.SHORT_CODE);
  const piCell = sheet.getRange(row, COL.PI_ID);
  const orderIdCell = sheet.getRange(row, COL.ORDER_ID);
  const totalPaidCell = sheet.getRange(row, COL.TOTAL_PAID);
  const emailCell = sheet.getRange(row, COL.EMAIL);

  const clientName = sheet.getRange(row, COL.CLIENT_NAME).getValue();
  const serviceDescription = sheet.getRange(row, COL.SERVICE_DESC).getValue();
  const serviceAddress = String(
    sheet.getRange(row, COL.ADDRESS).getDisplayValue() || ''
  ).trim();
  const serviceDate = sheet.getRange(row, COL.SERVICE_DT).getDisplayValue();
  const bookingTypeRaw = sheet.getRange(row, COL.BOOKING_TYPE).getDisplayValue();
  const bookingType = normalizeBookingType_(bookingTypeRaw);
  if (!bookingTypeRaw) {
    sheet.getRange(row, COL.BOOKING_TYPE).setValue(bookingType);
  }

  const captureChoice = COL.CAPTURE_TYPE
    ? String(sheet.getRange(row, COL.CAPTURE_TYPE).getDisplayValue() || '').trim()
    : '';
  const captureMethod = /^automatic$/i.test(captureChoice) ? 'automatic' : 'manual';

  const rawPhone = sheet.getRange(row, COL.PHONE).getDisplayValue();
  const clientPhone = normalizePhoneToE164(rawPhone);
  const phoneDigits = String(clientPhone || '').replace(/\D+/g, '');
  if (!clientPhone || !phoneDigits) {
    const msg = '⚠️ Falta teléfono del cliente.';
    linkCell.setValue(msg);
    statusCell.setValue('Missing phone');
    try { ui.alert(msg); } catch (_) {}
    return;
  }

  let clientEmail = normalizeEmail_(emailCell.getDisplayValue());
  if (!clientEmail) {
    const lookup = lookupEmailForPhone_(clientPhone);
    if (lookup && lookup.email) {
      clientEmail = lookup.email;
      emailCell.setValue(clientEmail);
      if (lookup.customerId && COL.CLIENT_ID) {
        const existing = sheet.getRange(row, COL.CLIENT_ID).getDisplayValue();
        if (!existing) {
          sheet.getRange(row, COL.CLIENT_ID).setValue(String(lookup.customerId));
        }
      }
    }
  }
  if (!clientEmail) {
    const msg =
      '⚠️ Falta email. Coloca el correo en la columna "Email" antes de generar el enlace.';
    linkCell.setValue(msg);
    statusCell.setValue('Missing email');
    try { ui.alert(msg); } catch (_) {}
    return;
  }

  amountCell.setValue(LIVE_TEST_AMOUNT_MXN);

  const payload = {
    amount: LIVE_TEST_AMOUNT_MXN,
    clientName,
    serviceDescription,
    serviceDate,
    clientPhone,
    clientEmail,
    serviceAddress,
    bookingType,
    capture: captureMethod,
    hasTimeComponent: false,
    microTest: true,
    pricingMode: 'micro_test'
  };

  warmupServer_(SERVI_BASE);
  waitForServerReady_(SERVI_BASE);

  let resp;
  try {
    resp = fetchWithRetry_(SERVI_BASE + '/create-payment-intent?ts=' + Date.now(), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: adminHeaders_(),
      muteHttpExceptions: true,
    }, 4);
  } catch (err) {
    const msg = '⚠️ No se pudo generar el enlace de prueba.';
    linkCell.setValue(msg);
    statusCell.setValue('Error (TEST)');
    try { ui.alert(msg); } catch (_) {}
    return;
  }

  const code = resp.getResponseCode();
  const body = resp.getContentText();
  let data = {};
  try {
    data = JSON.parse(body || '{}');
  } catch (_) {}

  if (code < 200 || code >= 300) {
    const errMsg = data.message || body || 'Error inesperado';
    linkCell.setValue('⚠️ ' + errMsg);
    statusCell.setValue('Error (TEST)');
    return;
  }

  const payOrderId = data.orderId || '';
  const paymentLink = data.payUrl || buildPayLink_(payOrderId);
  const message = ['TEST LIVE (MXN 10) — NO USAR CON CLIENTES', paymentLink].join(
    '\n'
  );

  orderIdCell.setValue(String(payOrderId || ''));
  piCell.setValue(String(data.paymentIntentId || ''));
  shortCodeCell.setValue(String(data.publicCode || ''));
  setCellRichTextWithLink_(linkCell, message, paymentLink);
  statusCell.setValue('Pending (TEST)');
  totalPaidCell.setValue(LIVE_TEST_AMOUNT_MXN);

  try {
    const headerMap = getSheetHeaderMap_(sheet);
    const candidates = ['mode', 'type', 'notes'];
    for (var i = 0; i < candidates.length; i++) {
      const norm = normalizeHeader_(candidates[i]);
      if (headerMap[norm]) {
        sheet.getRange(row, headerMap[norm]).setValue('LIVE_TEST_10MXN');
        break;
      }
    }
  } catch (_) {}
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
  const bookingTypeCol = ORD_COL.BOOKING_TYPE;
  const captureTypeCol = ORD_COL.CAPTURE_TYPE;
  const linkCol = ORD_COL.LINK_MSG;
  const emailCol = ORD_COL.EMAIL;
  const statusCol = ORD_COL.STATUS;
  const receiptCol = ORD_COL.RECEIPT;
  const orderIdCol = ORD_COL.ORDER_ID;
  const paymentIntentCol = ORD_COL.PI_ID;
  const totalPaidCol = ORD_COL.TOTAL_PAID;
  const shortCodeCol = ORD_COL.SHORT_CODE;
  const clientIdCol = ORD_COL.CLIENT_ID;
  const clientTypeCol = ORD_COL.CLIENT_TYPE;
  const linkCell = sheet.getRange(editedRow, linkCol);
  const bookingTypeCell = sheet.getRange(editedRow, bookingTypeCol);
  if (!emailCol) {
    try {
      ui.alert('Añade una columna llamada "Email" antes de generar enlaces.');
    } catch (_) {}
    linkCell.setValue('⚠️ Falta la columna "Email" en la hoja.');
    sheet.getRange(editedRow, statusCol).setValue('Missing email column');
    return;
  }
  const emailCell = sheet.getRange(editedRow, emailCol);

  const clientName = sheet.getRange(editedRow, clientNameCol).getValue();
  const serviceDescription = sheet
    .getRange(editedRow, serviceDescCol)
    .getValue();
  let amountMXN = sheet.getRange(editedRow, amountCol).getValue();
  const serviceDateRaw = sheet.getRange(editedRow, serviceDateCol).getValue();
  const serviceAddress = String(
    sheet.getRange(editedRow, addressCol).getDisplayValue() || ''
  ).trim();
  const rawPhone = sheet.getRange(editedRow, phoneCol).getDisplayValue();
  const clientPhone = normalizePhoneToE164(rawPhone);
  const phoneDigitsOnly = String(clientPhone || '').replace(/\D+/g, '');
  if (!clientPhone || !phoneDigitsOnly) {
    try {
      ui.alert('Ingresa el WhatsApp del cliente antes de generar el enlace.');
    } catch (_) {}
    linkCell.setValue('⚠️ Falta teléfono del cliente.');
    sheet.getRange(editedRow, statusCol).setValue('Missing phone');
    return;
  }
  let clientEmail = normalizeEmail_(emailCell.getDisplayValue());
  if (!clientEmail) {
    const lookup = lookupEmailForPhone_(clientPhone);
    if (lookup && lookup.email) {
      clientEmail = lookup.email;
      emailCell.setValue(clientEmail);
      if (lookup.customerId && clientIdCol) {
        const existing = sheet
          .getRange(editedRow, clientIdCol)
          .getDisplayValue();
        if (!existing) {
          sheet
            .getRange(editedRow, clientIdCol)
            .setValue(String(lookup.customerId));
        }
      }
    }
  }
  if (!clientEmail) {
    const msg =
      '⚠️ Falta email. Coloca el correo en la columna "Email" antes de generar el enlace.';
    linkCell.setValue(msg);
    sheet.getRange(editedRow, statusCol).setValue('Missing email');
    try {
      ui.alert(msg);
    } catch (_) {}
    return;
  }
  const bookingTypeRaw = bookingTypeCell.getDisplayValue();
  const bookingType = normalizeBookingType_(bookingTypeRaw);
  if (!bookingTypeRaw) {
    bookingTypeCell.setValue(bookingType);
  }
  const VISIT_PREAUTH_TOTAL_MXN = 140;
  if (
    bookingType === BOOKING_TYPE_LABELS.VISITA &&
    (!amountMXN || isNaN(amountMXN) || Number(amountMXN) <= 0)
  ) {
    amountMXN = VISIT_PREAUTH_TOTAL_MXN;
    sheet.getRange(editedRow, amountCol).setValue(amountMXN);
  }
  const clientTypeCell = sheet.getRange(editedRow, clientTypeCol);
  clientTypeCell.setValue('Guest');
  const captureTypeCell = captureTypeCol
    ? sheet.getRange(editedRow, captureTypeCol)
    : null;
  const captureChoice = String(
    captureTypeCell ? captureTypeCell.getDisplayValue() : ''
  ).trim();
  const captureMethod = /^automatic$/i.test(captureChoice)
    ? 'automatic'
    : 'manual';

  const TZ = 'America/Mexico_City';

  function parseServiceDateTime_(raw) {
    const result = { date: null, hasTime: false };
    if (raw instanceof Date) {
      result.date = raw;
      result.hasTime =
        raw.getHours() !== 0 ||
        raw.getMinutes() !== 0 ||
        raw.getSeconds() !== 0 ||
        raw.getMilliseconds() !== 0;
      return result;
    }
    const s = String(raw || '').trim();
    if (!s) return result;

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
      result.date = new Date(y, mo, d, hh, mm, 0, 0);
      result.hasTime = m[4] != null;
      return result;
    }

    m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
    if (m) {
      const yy = +m[1],
        mo2 = +m[2] - 1,
        dd = +m[3],
        hh2 = +(m[4] || 0),
        mm2 = +(m[5] || 0);
      result.date = new Date(yy, mo2, dd, hh2, mm2, 0, 0);
      result.hasTime = m[4] != null;
      return result;
    }

    return result;
  }

  const parsed = parseServiceDateTime_(serviceDateRaw);
  const parsedDate = parsed.date;
  const hasServiceTime = parsed.hasTime;
  const serviceDate = parsedDate
    ? Utilities.formatDate(parsedDate, TZ, 'yyyy-MM-dd')
    : '';
  const serviceDateTime = parsedDate ? toISOWithOffset_(parsedDate, TZ) : '';
  const serviceDateCell = sheet.getRange(editedRow, serviceDateCol);

  const nowMs = Date.now();
  const serviceMs = parsedDate ? parsedDate.getTime() : NaN;
  const approxServiceMs =
    parsedDate && Number.isFinite(serviceMs)
      ? serviceMs + (hasServiceTime ? 0 : 12 * 60 * 60 * 1000)
      : null;
  const hoursAhead =
    approxServiceMs !== null && Number.isFinite(approxServiceMs)
      ? (approxServiceMs - nowMs) / 3600000
      : null;
  const todayYmd = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const timePastToday = hoursAhead !== null && hoursAhead < 0;
  const serviceInPast =
    parsedDate &&
    (timePastToday ||
      (hasServiceTime
        ? serviceMs < nowMs
        : serviceDate && serviceDate < todayYmd));

  if (serviceInPast) {
    const msg =
      '⚠️ La fecha/hora del servicio ya pasó. Corrige "Service Date and Time" antes de generar el enlace.';
    try {
      ui.alert(msg);
    } catch (_) {}
    linkCell.setValue(msg);
    serviceDateCell.setNote(msg);
    sheet.getRange(editedRow, statusCol).setValue('Invalid date');
    return;
  }

  if (hoursAhead !== null && hoursAhead <= 24 && hoursAhead >= 0) {
    const warning =
      '⚠️ Servicio solicitado con menos de 24 horas. Prioriza seguimiento y captura inmediata.';
    const existingNote = serviceDateCell.getNote();
    if (
      !existingNote ||
      existingNote.indexOf('Servicio solicitado con menos de 24 horas') === -1
    ) {
      const newNote = existingNote ? existingNote + '\n' + warning : warning;
      serviceDateCell.setNote(newNote);
    }
    try {
      ui.alert(warning);
    } catch (_) {}
  }

  const amountHeader = String(
    sheet.getRange(1, amountCol).getDisplayValue() || ''
  ).trim();
  const amountColLetter = columnLetterFromIndex_(amountCol);
  const amountLabel = amountHeader
    ? '"' + amountHeader + '"'
    : amountColLetter
      ? 'column ' + amountColLetter
      : 'the Amount column';
  const amountErrorMessage =
    '⚠️ Please enter a valid amount (MXN) in ' + amountLabel + '.';

  if (!amountMXN || isNaN(amountMXN)) {
    try {
      ui.alert(amountErrorMessage);
    } catch (err) {
      Logger.log('⚠️ Invalid amount in Amount column.');
    }
    return;
  }

  const providerPrice = Number(amountMXN);
  if (!Number.isFinite(providerPrice) || providerPrice <= 0) {
    try {
      ui.alert(amountErrorMessage);
    } catch (err) {
      Logger.log('⚠️ Invalid amount in Amount column.');
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
      clientEmail,
      serviceAddress,
      bookingType,
      capture: captureMethod,
      hasTimeComponent: hasServiceTime,
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
        clientEmail,
        serviceAddress,
        bookingType,
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
        if (code === 400 && dataErr && dataErr.error === 'past_service_date') {
          const msg =
            dataErr.message ||
            '⚠️ La fecha/hora del servicio ya pasó. Corrige "Service Date and Time".';
          linkCell.setValue(msg);
          serviceDateCell.setNote(msg);
          sheet.getRange(editedRow, statusCol).setValue('Invalid date');
          try {
            ui.alert('⚠️ ' + msg);
          } catch (_) {}
          return;
        }
        if (code === 403 && dataErr && dataErr.error === 'account_required') {
          const payOrderId = dataErr.orderId || '';
          const paymentLink =
            dataErr.payUrl ||
            buildPayLink_(payOrderId);
          const paymentText = buildBookingLinkMessage_(
            bookingType,
            paymentLink
          );

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
        if (
          code === 409 &&
          dataErr &&
          (dataErr.error === 'name_phone_mismatch' ||
            dataErr.error === 'name_required_for_saved_client' ||
            dataErr.error === 'phone_name_conflict')
        ) {
          const parts = [
            dataErr.message ||
              'El nombre y el teléfono no coinciden con el cliente guardado.',
          ];
          const registeredName = dataErr.expectedName || dataErr.existingName;
          if (registeredName) {
            parts.push('Nombre registrado: ' + registeredName);
          }
          const friendly = parts.join(' ');
          try {
            ui.alert('⚠️ ' + friendly);
          } catch (_) {}
          linkCell.setValue('⚠️ ' + friendly);
          sheet.getRange(editedRow, statusCol).setValue('Name/phone mismatch');
          return;
        }
        if (
          code === 400 &&
          dataErr &&
          (dataErr.error === 'email_required' ||
            dataErr.error === 'invalid_email' ||
            dataErr.error === 'phone_required_for_email')
        ) {
          const msg =
            dataErr.message ||
            '⚠️ Añade un email válido en la columna "Email" antes de generar el enlace.';
          linkCell.setValue(msg);
          sheet.getRange(editedRow, statusCol).setValue('Email missing');
          try {
            ui.alert(msg);
          } catch (_) {}
          return;
        }
        if (
          code === 409 &&
          dataErr &&
          dataErr.error === 'email_phone_conflict'
        ) {
          const msg =
            dataErr.message ||
            '⚠️ Este email ya está asociado a otro número. Verifica el email y el WhatsApp.';
          linkCell.setValue(msg);
          sheet.getRange(editedRow, statusCol).setValue('Email conflict');
          try {
            ui.alert(msg);
          } catch (_) {}
          return;
        }
      } catch (_) {}
      throw new Error('Server ' + code + ': ' + body);
    }

    const data = JSON.parse(body);
    Logger.log('Parsed Response: %s', JSON.stringify(data));

    if (!data.publicCode) throw new Error('Missing publicCode in response');

    if (data.clientEmail) {
      emailCell.setValue(data.clientEmail);
    }

    const payOrderId = data.orderId || '';
    const paymentLink =
      data.payUrl ||
      buildPayLink_(payOrderId);
    const paymentText = buildBookingLinkMessage_(bookingType, paymentLink);

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

    const identityInfo = updateIdentityColumns_(
      sheet,
      editedRow,
      String(data.orderId)
    );
    attemptImmediatePreauthForSavedClient_(
      sheet,
      editedRow,
      String(data.orderId),
      identityInfo
    );

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
  const adjustmentType = String(
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
    note: adjustmentType || 'SERVI adjustment',
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
  const flow = String(out.flow || out.mode || '').toLowerCase();
  const linkFromApi = out.payUrl || (flow === 'book' ? out.bookUrl : null);
  const fallbackLink =
    flow === 'book'
      ? buildBookLink_(out.childOrderId)
      : buildPayLink_(out.childOrderId);
  const paymentLink = linkFromApi || fallbackLink;

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
  const finalCents =
    (totalCents > 0 ? totalCents : Math.round(totalMXN * 100)) +
    Math.round(Number(out.visitCreditCents || 0));
  if (COL.FINAL_PRICE && finalCents > 0) {
    const finalMXN = finalCents / 100;
    const finalCell = sh.getRange(row, COL.FINAL_PRICE);
    finalCell.setValue(finalMXN);
    finalCell.setNumberFormat('$#,##0.00');
  }

  const linkLabel = flow === 'book' ? 'Link (cliente)' : 'Link (invitado)';
  sh.getRange(row, COL.REQ3DS).setValue(linkLabel);
  sh.getRange(row, COL.STATUS).setValue('Pending');
  sh.getRange(row, COL.CLIENT_ID).setValue(out.customerId || '');

  const effectiveReason = String(
    out.adjustmentReason || adjustmentType || ''
  ).trim();
  const formattedTotal = totalMXN.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
  });
  const bookingTypeResp = normalizeBookingType_(out.bookingType || '');
  const visitCreditMXN = Number(out.visitCreditCents || 0) / 100;
  const visitCreditLine =
    bookingTypeResp === BOOKING_TYPE_LABELS.VISITA && visitCreditMXN > 0
      ? 'Se descontará tu visita de ' +
        visitCreditMXN.toLocaleString('es-MX', {
          style: 'currency',
          currency: 'MXN',
        }) +
        ' del total.'
      : '';

  function buildAdjustmentLinkMessage_(reasonLabel) {
    const reason = String(reasonLabel || '').toLowerCase();
    const amountLine = 'Monto: ' + formattedTotal;
    if (reason.indexOf('final price') !== -1) {
      return [
        'Este enlace es para pagar el resto de tu servicio. Se desconto lo que pagaste inicialmente!',
        amountLine,
        paymentLink,
      ];
    }
    if (reason.indexOf('deposit') !== -1 || reason.indexOf('anticipo') !== -1) {
      return [
        'Usa este enlace para pagar el anticipo de tu servicio. Este monto se descuenta del total y el resto se cobrará al finalizar el trabajo.',
        amountLine,
        paymentLink,
      ];
    }
    if (reason.indexOf('surcharge') !== -1) {
      return ['Confirma aquí el cargo extra de tu servicio.', amountLine, paymentLink];
    }
    if (reason.indexOf('billing error') !== -1 || reason.indexOf('billing') !== -1) {
      return [
        'Detectamos un error en el cobro de tu servicio. Usa este enlace para corregir el pago; el monto ya está ajustado según lo correcto.',
        amountLine,
        paymentLink,
      ];
    }
    return [
      effectiveReason ? 'Motivo: ' + effectiveReason : 'Confirma el ajuste de tu servicio.',
      amountLine,
      paymentLink,
    ];
  }

  const messageLines = buildAdjustmentLinkMessage_(effectiveReason || adjustmentType);
  if (visitCreditLine) {
    messageLines.splice(1, 0, visitCreditLine);
  }
  setCellRichTextWithLink_(messageCell, messageLines.filter(Boolean).join('\n'), paymentLink);
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
  let savedCard = false;
  let hoursAhead = null;
  let consentOk = false;

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
      if (typeof d.hours_ahead === 'number') hoursAhead = d.hours_ahead;
      savedCard = !!d.saved_card;
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
      if (d.client_email && ORD_COL.EMAIL) {
        const emailCell = sheet.getRange(row, ORD_COL.EMAIL);
        const existingEmail = normalizeEmail_(emailCell.getDisplayValue());
        if (!existingEmail) {
          emailCell.setValue(String(d.client_email));
        }
      }
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
      consentOk = !!(c && c.ok);
      if (consentOk) {
        cell.setValue('SERVI Client');
      } else {
        cell.setValue('Guest');
      }
    }
  } catch (_) {}

  return { savedCard, hoursAhead, consentOk };
}

function attemptImmediatePreauthForSavedClient_(sheet, row, orderId, info) {
  const data = info || {};
  const savedCard = !!(data.savedCard || data.consentOk);
  if (!sheet || !savedCard) return;

  let hoursAhead = typeof data.hoursAhead === 'number' ? data.hoursAhead : null;
  if (hoursAhead === null) {
    const hoursCellVal = Number(
      sheet.getRange(row, ORD_COL.HOURS).getValue() || ''
    );
    hoursAhead = Number.isFinite(hoursCellVal) ? hoursCellVal : null;
  }

  const existingPi = String(
    sheet.getRange(row, ORD_COL.PI_ID).getDisplayValue() || ''
  ).trim();
  if (existingPi) return;
  if (hoursAhead === null || hoursAhead > EARLY_PREAUTH_THRESHOLD_HOURS) return;

  const currentStatus = String(
    sheet.getRange(row, ORD_COL.STATUS).getDisplayValue() || ''
  ).trim();
  if (/^captured$/i.test(currentStatus)) return;

  const payload = { orderId, allowExpired: true, createOnly: true };

  try {
    const resp = UrlFetchApp.fetch(SERVI_BASE + '/confirm-with-saved', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: adminHeaders_(),
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();
    let out = {};
    try {
      out = JSON.parse(resp.getContentText() || '{}');
    } catch (_) {
      out = {};
    }
    applyConfirmWithSavedResult_(
      sheet,
      row,
      code,
      out,
      ORD_COL.UPDATE_PAYMENT_METHOD
    );
  } catch (_) {}
}

function lookupEmailForPhone_(phone) {
  if (!phone) return null;
  try {
    const resp = UrlFetchApp.fetch(
      `${SERVI_BASE}/admin/contact-lookup?phone=${encodeURIComponent(phone)}`,
      {
        method: 'get',
        muteHttpExceptions: true,
        headers: adminHeaders_(),
      }
    );
    if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 300) {
      const data = JSON.parse(resp.getContentText() || '{}');
      if (data && data.email) return data;
    }
  } catch (err) {
    Logger.log('lookupEmailForPhone_ error: ' + (err && err.message));
  }
  return null;
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

    if (
      (current === 'Declined' || current === 'Failed') &&
      next &&
      next !== current
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
      hoursAhead === null ? kind === 'book' : hoursAhead > PREAUTH_WINDOW_HOURS;
    if (farFromService) {
      writeStatusSafely('Scheduled');
      SpreadsheetApp.getUi().alert('Fila re-sincronizada: Scheduled.');
      return;
    }
  }

  if (
    savedCard &&
    hoursAhead !== null &&
    hoursAhead <= PREAUTH_WINDOW_HOURS &&
    !piId
  ) {
    writeStatusSafely('Scheduled');
    SpreadsheetApp.getUi().alert(
      'Fila re-sincronizada: Scheduled (ventana abierta).'
    );
    return;
  }

  if (statusDb) writeStatusSafely(statusDb);

  SpreadsheetApp.getUi().alert('Fila re-sincronizada.');
}

// --- Order Actions Sidebar (cancel / refund) ---
const ORDER_ACTIONS_SIDEBAR_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 12px; color: #111; }
      h3 { margin: 0 0 6px; font-size: 16px; }
      .section { margin-bottom: 14px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; }
      .section h4 { margin: 0 0 6px; font-size: 13px; }
      label { display: block; font-size: 12px; color: #555; margin: 8px 0 4px; }
      textarea, input[type="number"] { width: 100%; box-sizing: border-box; padding: 6px; }
      input[type="date"], input[type="time"], select { width: 100%; box-sizing: border-box; padding: 6px; }
      textarea { min-height: 60px; }
      .pill { display: inline-block; padding: 4px 8px; background: #eef2ff; color: #111; border-radius: 999px; font-size: 12px; }
      .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      button { padding: 8px 10px; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; width: 100%; font-weight: 600; }
      button[disabled] { opacity: 0.6; cursor: not-allowed; }
      .msg { margin-top: 8px; font-size: 12px; }
      .msg.error { color: #b91c1c; }
      .msg.success { color: #0f5132; }
      .radio-row { display: flex; gap: 6px; align-items: center; font-size: 12px; }
      .muted { color: #6b7280; font-size: 12px; margin-top: 4px; }
    </style>
  </head>
  <body>
    <h3>Orden <span id="order-id"></span></h3>
    <div class="row">
      <div class="pill" id="status-pill"></div>
      <div id="amount-label" class="muted"></div>
    </div>
    <div class="muted" id="service-date"></div>
    <div class="muted" id="pi-label"></div>
    <div id="msg" class="msg"></div>

    <div class="section" id="capture-section">
      <h4>Capturar pago</h4>
      <label for="capture-amount">Monto a capturar (MXN, deja vacío para total autorizado)</label>
      <input type="number" id="capture-amount" min="0" step="0.01" placeholder="Monto total">
      <div class="muted">Usa esto sólo si el pago está autorizado (requires_capture / Confirmed).</div>
      <button id="capture-btn">Capturar</button>
    </div>

    <div class="section" id="cancel-section">
      <h4>Cancelar orden (sin reembolso)</h4>
      <label for="cancel-reason">Motivo (opcional)</label>
      <textarea id="cancel-reason" placeholder="Ej. Cliente canceló, reprogramar, etc."></textarea>
      <button id="cancel-btn">Cancelar orden</button>
    </div>

    <div class="section" id="change-section">
      <h4>Solicitud de cambio</h4>
      <label for="change-type">Tipo de cambio</label>
      <select id="change-type">
        <option value="reschedule">Reprogramar fecha/hora</option>
        <option value="cancel">Cancelar</option>
        <option value="address">Actualizar dirección</option>
      </select>
      <div class="row">
        <div style="flex: 1;">
          <label for="change-date">Nueva fecha</label>
          <input type="date" id="change-date">
        </div>
        <div style="flex: 1;">
          <label for="change-time">Nueva hora</label>
          <input type="time" id="change-time" step="300">
        </div>
      </div>
      <label for="change-address">Nueva dirección (opcional)</label>
      <textarea id="change-address" placeholder="Calle, número, colonia..."></textarea>
      <label for="change-notes">Notas (opcional)</label>
      <textarea id="change-notes" placeholder="Detalles del cambio o contexto."></textarea>
      <button id="change-btn">Registrar cambio</button>
      <div class="muted">Solo registra la solicitud en la pestaña SERVI Changes.</div>
    </div>

    <div class="section" id="refund-section">
      <h4>Reembolso</h4>
      <div class="radio-row">
        <input type="radio" name="refund" id="refund-full" value="full" checked>
        <label for="refund-full">Reembolso total</label>
      </div>
      <div class="radio-row">
        <input type="radio" name="refund" id="refund-partial" value="partial">
        <label for="refund-partial">Reembolso parcial (MXN)</label>
      </div>
      <input type="number" id="refund-amount" min="0" step="0.01" placeholder="0.00" disabled>
      <label for="refund-reason">Motivo (opcional)</label>
      <textarea id="refund-reason" placeholder="Ej. Ajuste, garantía, etc."></textarea>
      <button id="refund-btn">Reembolsar</button>
    </div>

    <script>
      const data = <?!= JSON.stringify(data) ?>;

      function setMsg(text, kind) {
        const el = document.getElementById('msg');
        el.textContent = text || '';
        el.className = 'msg ' + (kind || '');
        if (text) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      function setButton(btnId, stateText) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (stateText) {
          btn.disabled = true;
          btn.textContent = stateText;
        } else {
          btn.disabled = false;
          if (btnId === 'capture-btn') btn.textContent = 'Capturar';
          if (btnId === 'cancel-btn') btn.textContent = 'Cancelar orden';
          if (btnId === 'refund-btn') btn.textContent = 'Reembolsar';
          if (btnId === 'change-btn') btn.textContent = 'Registrar cambio';
        }
      }

      function init() {
        document.getElementById('order-id').textContent = data.orderId || '—';
        document.getElementById('status-pill').textContent = data.status || '—';
        if (data.amountLabel) document.getElementById('amount-label').textContent = data.amountLabel;
        if (data.serviceDate) document.getElementById('service-date').textContent = data.serviceDate;
        if (data.paymentIntentId) document.getElementById('pi-label').textContent = 'PI: ' + data.paymentIntentId;
        if (data.captureDefault && !isNaN(data.captureDefault)) {
          document.getElementById('capture-amount').value = data.captureDefault;
        }

        const refundRadios = document.querySelectorAll('input[name="refund"]');
        const refundAmount = document.getElementById('refund-amount');
        refundRadios.forEach((r) => {
          r.addEventListener('change', () => {
            refundAmount.disabled = r.value !== 'partial';
          });
        });

        document.getElementById('capture-btn').addEventListener('click', captureOrder);
        document.getElementById('cancel-btn').addEventListener('click', cancelOrder);
        document.getElementById('change-btn').addEventListener('click', submitChangeRequest);
        document.getElementById('change-type').addEventListener('change', applyChangeVisibility);
        document.getElementById('refund-btn').addEventListener('click', refundOrder);

        if (data.serviceDateIso) document.getElementById('change-date').value = data.serviceDateIso;
        if (data.serviceTimeIso) document.getElementById('change-time').value = data.serviceTimeIso;

        applyChangeVisibility();
        applyEligibility();
      }

      function applyEligibility() {
        const status = String(data.status || '').toLowerCase();
        const hasPi = !!data.paymentIntentId;
        const isCaptured = status.indexOf('captured') !== -1 || status.indexOf('refund') !== -1 || status.indexOf('refunded') !== -1;
        const captureAllowed = hasPi && !isCaptured && (status.indexOf('confirm') !== -1 || status.indexOf('requires_capture') !== -1 || status.indexOf('pending') !== -1);
        const cancelAllowed = !isCaptured;
        const refundAllowed = isCaptured;

        document.getElementById('capture-btn').disabled = !captureAllowed;
        document.getElementById('cancel-btn').disabled = !cancelAllowed;
        document.getElementById('refund-btn').disabled = !refundAllowed;

        if (!captureAllowed) document.getElementById('capture-section').style.opacity = 0.6;
        if (!cancelAllowed) document.getElementById('cancel-section').style.opacity = 0.6;
        if (!refundAllowed) document.getElementById('refund-section').style.opacity = 0.6;
      }

      function applyChangeVisibility() {
        const type = document.getElementById('change-type').value;
        const disableDateTime = type === 'cancel' || type === 'address';
        const disableAddress = type === 'reschedule' || type === 'cancel';
        document.getElementById('change-date').disabled = disableDateTime;
        document.getElementById('change-time').disabled = disableDateTime;
        document.getElementById('change-address').disabled = disableAddress;
      }

      function submitChangeRequest() {
        setMsg('', '');
        const type = document.getElementById('change-type').value || '';
        const requestedDate = document.getElementById('change-date').value || '';
        const requestedTime = document.getElementById('change-time').value || '';
        const requestedAddress = document.getElementById('change-address').value || '';
        const notes = document.getElementById('change-notes').value || '';

        if (type === 'reschedule' && !requestedDate) {
          setMsg('Ingresa la nueva fecha.', 'error');
          return;
        }
        if (type === 'address' && !requestedAddress.trim()) {
          setMsg('Ingresa la nueva dirección.', 'error');
          return;
        }

        setButton('change-btn', 'Registrando…');
        google.script.run
          .withSuccessHandler(function (out) {
            setButton('change-btn', null);
            if (!out) {
              setMsg('Sin respuesta del servidor.', 'error');
              return;
            }
            setMsg(out.message || ('Cambio registrado: ' + (out.changeId || '')), 'success');
          })
          .withFailureHandler(function (err) {
            setButton('change-btn', null);
            const msg = (err && err.message) || 'No se pudo registrar el cambio.';
            setMsg(msg, 'error');
          })
          .submitOrderChangeFromSidebar({
            orderId: data.orderId,
            row: data.row,
            changeType: type,
            requestedDate,
            requestedTime,
            requestedAddress,
            notes,
          });
      }

      function captureOrder() {
        setMsg('', '');
        const raw = document.getElementById('capture-amount').value;
        let amount = null;
        if (raw && raw.trim()) {
          const num = parseFloat(raw);
          if (!num || num <= 0) {
            setMsg('Ingresa un monto válido para capturar.', 'error');
            return;
          }
          amount = num;
        }
        setButton('capture-btn', 'Capturando…');
        google.script.run
          .withSuccessHandler(function (out) {
            setButton('capture-btn', null);
            if (!out) {
              setMsg('Sin respuesta del servidor.', 'error');
              return;
            }
            document.getElementById('status-pill').textContent = out.status || data.status || 'Captured';
            setMsg(out.message || 'Captura enviada. Webhook actualizará la orden.', 'success');
          })
          .withFailureHandler(function (err) {
            setButton('capture-btn', null);
            const msg = (err && err.message) || 'No se pudo capturar.';
            setMsg(msg, 'error');
          })
          .captureOrderFromSidebar({
            row: data.row,
            orderId: data.orderId,
            amount
          });
      }

      function cancelOrder() {
        setMsg('', '');
        const reason = (document.getElementById('cancel-reason').value || '').trim();
        setButton('cancel-btn', 'Cancelando…');
        google.script.run
          .withSuccessHandler(function (out) {
            setButton('cancel-btn', null);
            if (!out) {
              setMsg('Sin respuesta del servidor.', 'error');
              return;
            }
            document.getElementById('status-pill').textContent = out.status || data.status || 'Canceled';
            setMsg(out.message || 'Orden cancelada.', 'success');
          })
          .withFailureHandler(function (err) {
            setButton('cancel-btn', null);
            const msg = (err && err.message) || 'No se pudo cancelar la orden.';
            setMsg(msg, 'error');
          })
          .cancelOrderFromSidebar({
            row: data.row,
            orderId: data.orderId,
            reason
          });
      }

      function refundOrder() {
        setMsg('', '');
        const refundMode = document.querySelector('input[name="refund"]:checked')?.value || 'full';
        let amount = null;
        if (refundMode === 'partial') {
          amount = parseFloat(document.getElementById('refund-amount').value || '0');
          if (!amount || amount <= 0) {
            setMsg('Ingresa un monto válido para reembolso parcial.', 'error');
            return;
          }
        }
        const reason = (document.getElementById('refund-reason').value || '').trim();
        setButton('refund-btn', 'Reembolsando…');
        google.script.run
          .withSuccessHandler(function (out) {
            setButton('refund-btn', null);
            if (!out) {
              setMsg('Sin respuesta del servidor.', 'error');
              return;
            }
            document.getElementById('status-pill').textContent = out.status || data.status || 'Refunded';
            setMsg(out.message || 'Reembolso enviado.', 'success');
          })
          .withFailureHandler(function (err) {
            setButton('refund-btn', null);
            const msg = (err && err.message) || 'No se pudo reembolsar.';
            setMsg(msg, 'error');
          })
          .refundOrderFromSidebar({
            row: data.row,
            orderId: data.orderId,
            amount,
            reason
          });
      }

      init();
    </script>
  </body>
</html>
`;

function openOrderActionsSidebar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const ui = SpreadsheetApp.getUi();
  if (sh.getName() !== SHEET_NAMES.ORDERS) {
    ui.alert('Usa esta opción en la hoja "SERVI Orders".');
    return;
  }
  const range = sh.getActiveRange();
  if (!range) {
    ui.alert('Selecciona una fila de datos (fila 2 o abajo).');
    return;
  }
  const row = range.getRow();
  if (row < 2) {
    ui.alert('Selecciona una fila de datos (fila 2 o abajo).');
    return;
  }

  const orderId = String(
    sh.getRange(row, ORD_COL.ORDER_ID).getDisplayValue() || ''
  ).trim();
  if (!orderId) {
    ui.alert('No Order ID en la fila seleccionada.');
    return;
  }

  const amountValue = Number(
    sh.getRange(row, ORD_COL.TOTAL_PAID).getValue() || 0
  );
  const serviceDateValue = sh.getRange(row, ORD_COL.SERVICE_DT).getValue();
  let serviceDateIso = '';
  let serviceTimeIso = '';
  if (serviceDateValue instanceof Date && !isNaN(serviceDateValue)) {
    serviceDateIso = Utilities.formatDate(
      serviceDateValue,
      'America/Mexico_City',
      'yyyy-MM-dd'
    );
    serviceTimeIso = Utilities.formatDate(
      serviceDateValue,
      'America/Mexico_City',
      'HH:mm'
    );
  }
  const data = {
    row,
    orderId,
    status: String(
      sh.getRange(row, ORD_COL.STATUS).getDisplayValue() || ''
    ).trim(),
    amountLabel: String(
      sh.getRange(row, ORD_COL.TOTAL_PAID).getDisplayValue() || ''
    ).trim(),
    captureDefault: amountValue || null,
    serviceDate: String(
      sh.getRange(row, ORD_COL.SERVICE_DT).getDisplayValue() || ''
    ).trim(),
    serviceDateIso,
    serviceTimeIso,
    clientName: String(
      sh.getRange(row, ORD_COL.CLIENT_NAME).getDisplayValue() || ''
    ).trim(),
    paymentIntentId: String(
      sh.getRange(row, ORD_COL.PI_ID).getDisplayValue() || ''
    ).trim(),
  };

  const tmpl = HtmlService.createTemplate(ORDER_ACTIONS_SIDEBAR_HTML);
  tmpl.data = data;
  const html = tmpl.evaluate().setTitle('SERVI Order Actions');
  SpreadsheetApp.getUi().showSidebar(html);
}

function cancelOrderFromSidebar(payload) {
  const p = payload || {};
  const orderId = String(p.orderId || '').trim();
  const row = Number(p.row || 0);
  if (!orderId) throw new Error('Order ID requerido.');

  const reason = String(p.reason || '')
    .trim()
    .slice(0, 200);

  const resp = UrlFetchApp.fetch(SERVI_BASE + '/cancel-order', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      orderId,
      reason,
    }),
    headers: adminHeaders_(),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  let out = {};
  try {
    out = JSON.parse(resp.getContentText() || '{}');
  } catch (_) {
    out = {};
  }
  if (code < 200 || code >= 300) {
    const msg = out.message || resp.getContentText() || 'Cancelación fallida.';
    throw new Error(msg);
  }

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.ORDERS
  );
  if (sh && row >= 2) {
    if (out.status) {
      sh.getRange(row, ORD_COL.STATUS).setValue(out.status);
    }
    const noteParts = [];
    if (reason) noteParts.push('Motivo: ' + reason);
    if (out.message) noteParts.push(out.message);
    const noteText = noteParts.join('\n');
    if (noteText) {
      sh.getRange(row, ORD_COL.STATUS).setNote(noteText);
    }
    const linkCol = ORD_COL.LINK_MSG;
    if (linkCol) {
      sh.getRange(row, linkCol).clearContent();
    }
  }

  return out;
}

function captureOrderFromSidebar(payload) {
  const p = payload || {};
  const orderId = String(p.orderId || '').trim();
  const row = Number(p.row || 0);
  if (!orderId) throw new Error('Order ID requerido.');

  let amountCents = null;
  if (p.amount != null) {
    const val = Number(p.amount);
    if (!Number.isFinite(val) || val <= 0) {
      throw new Error('Ingresa un monto válido para capturar.');
    }
    amountCents = Math.round(val * 100);
  }

  const resp = UrlFetchApp.fetch(SERVI_BASE + '/capture-order', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      orderId,
      amount: amountCents || undefined,
    }),
    headers: adminHeaders_(),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  let out = {};
  try {
    out = JSON.parse(resp.getContentText() || '{}');
  } catch (_) {}
  if (code < 200 || code >= 300) {
    const msg =
      out.error || out.message || resp.getContentText() || 'Captura fallida.';
    throw new Error(msg);
  }

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.ORDERS
  );
  if (sh && row >= 2) {
    const statusLabel =
      out.status === 'succeeded' ? 'Captured' : out.status || 'Captured';
    sh.getRange(row, ORD_COL.STATUS).setValue(statusLabel);
    if (typeof out.captured === 'number' && !isNaN(out.captured)) {
      // Total Paid is the captured-before-refunds amount; set once on capture.
      sh.getRange(row, ORD_COL.TOTAL_PAID).setValue(out.captured / 100);
      if (ORD_COL.FINAL_CAPTURED) {
        sh.getRange(row, ORD_COL.FINAL_CAPTURED).setValue(out.captured / 100);
      }
    }
    const note = out.message ? String(out.message) : 'Captura enviada.';
    sh.getRange(row, ORD_COL.STATUS).setNote(note);
  }

  return out;
}

function refundOrderFromSidebar(payload) {
  const p = payload || {};
  const orderId = String(p.orderId || '').trim();
  const row = Number(p.row || 0);
  if (!orderId) throw new Error('Order ID requerido.');

  let amountCents = null;
  if (p.amount != null) {
    const val = Number(p.amount);
    if (!Number.isFinite(val) || val <= 0) {
      throw new Error('Ingresa un monto válido para reembolso parcial.');
    }
    amountCents = Math.round(val * 100);
  }
  const reason = String(p.reason || '')
    .trim()
    .slice(0, 200);

  const resp = UrlFetchApp.fetch(SERVI_BASE + '/refund-order', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      orderId,
      amountCents: amountCents || undefined,
      reason,
    }),
    headers: adminHeaders_(),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  let out = {};
  try {
    out = JSON.parse(resp.getContentText() || '{}');
  } catch (_) {}
  if (code < 200 || code >= 300) {
    const msg = out.message || resp.getContentText() || 'Reembolso fallido.';
    throw new Error(msg);
  }

  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    SHEET_NAMES.ORDERS
  );
  if (sh && row >= 2) {
    if (out.status) {
      sh.getRange(row, ORD_COL.STATUS).setValue(out.status);
    }
    if (
      ORD_COL.FINAL_CAPTURED &&
      typeof out.remainingAmountCents === 'number' &&
      !isNaN(out.remainingAmountCents)
    ) {
      sh.getRange(row, ORD_COL.FINAL_CAPTURED).setValue(
        out.remainingAmountCents / 100
      );
    }
    const noteParts = [];
    if (reason) noteParts.push('Motivo: ' + reason);
    if (out.message) noteParts.push(out.message);
    if (out.refundedAmountCents) {
      noteParts.push(
        'Reembolsado: $' + (out.refundedAmountCents / 100).toFixed(2)
      );
    }
    const noteText = noteParts.join('\n');
    if (noteText) {
      sh.getRange(row, ORD_COL.STATUS).setNote(noteText);
    }
    const linkCol = ORD_COL.LINK_MSG;
    if (linkCol) {
      sh.getRange(row, linkCol).clearContent();
    }
  }

  return out;
}

function generateChangeId_() {
  const now = new Date();
  const stamp = Utilities.formatDate(
    now,
    'America/Mexico_City',
    'yyyyMMddHHmmss'
  );
  const rand = Math.floor(Math.random() * 1e6)
    .toString()
    .padStart(6, '0');
  return 'CHG-' + stamp + '-' + rand;
}

function normalizeChangeTypeLabel_(raw) {
  const val = String(raw || '')
    .toLowerCase()
    .trim();
  if (!val) return '';
  if (val.indexOf('resched') !== -1 || val.indexOf('reprog') !== -1) {
    return 'Reschedule';
  }
  if (val.indexOf('cancel') !== -1) return 'Cancel';
  if (val.indexOf('address') !== -1 || val.indexOf('direc') !== -1) {
    return 'Address update';
  }
  return '';
}

function parseRequestedDateTime_(dateStr, timeStr) {
  const m = String(dateStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  let hour = 0;
  let minute = 0;
  const t = String(timeStr || '').trim();
  if (t) {
    const tm = t.match(/^(\d{1,2}):(\d{2})/);
    if (tm) {
      hour = Number(tm[1]);
      minute = Number(tm[2]);
    }
  }
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return new Date(year, month, day, hour, minute, 0, 0);
}

function appendNote_(range, text) {
  if (!range || !text) return;
  const existing = String(range.getNote() || '');
  const next = existing ? existing + '\n' + text : text;
  range.setNote(next);
}

function buildBeforeAfterNote_(changeId, beforeVal, afterVal) {
  const before = String(beforeVal || '').trim();
  const after = String(afterVal || '').trim();
  const from = before ? before : '—';
  const to = after ? after : '—';
  let note = (changeId ? changeId + ': ' : '') + from + ' → ' + to;
  if (note.length > 200) {
    note = note.slice(0, 197) + '…';
  }
  return note;
}

function recordOrderChangeRequest_(payload) {
  const data = payload || {};
  ensureChangesSheet_();
  const sh = getSheet_(SHEET_NAMES.CHANGES);
  if (!sh) throw new Error('No se encontró la hoja de cambios.');
  const cols = changesColumnMap_(sh);
  const ordersSheet = getSheet_(SHEET_NAMES.ORDERS);
  const orderCols = ordersSheet ? ordersColumnMap_(ordersSheet) : null;
  let originalDate = '';
  let originalTime = '';
  let originalAddress = '';
  let originalStatus = '';

  if (ordersSheet && orderCols && data.orderId) {
    const row = findRowByOrderId_(
      ordersSheet,
      orderCols.ORDER_ID,
      data.orderId
    );
    if (row) {
      const svcCell = ordersSheet.getRange(row, orderCols.SERVICE_DT);
      const svcVal = svcCell.getValue();
      const svcDisp = String(svcCell.getDisplayValue() || '').trim();
      if (svcVal instanceof Date && !isNaN(svcVal)) {
        originalDate = Utilities.formatDate(
          svcVal,
          'America/Mexico_City',
          'yyyy-MM-dd'
        );
        const hhmm = Utilities.formatDate(
          svcVal,
          'America/Mexico_City',
          'HH:mm'
        );
        // Only record time if it has a non-midnight component
        if (
          svcVal.getHours() !== 0 ||
          svcVal.getMinutes() !== 0 ||
          svcVal.getSeconds() !== 0
        ) {
          originalTime = hhmm;
        }
      } else if (svcDisp) {
        // fallback: try to split display into date/time
        const m = svcDisp.match(
          /^(\d{4}-\d{2}-\d{2})[ T]?(\d{1,2}:\d{2})?/
        );
        if (m) {
          originalDate = m[1] || '';
          if (m[2]) originalTime = m[2];
        } else {
          originalDate = svcDisp;
        }
      }

      originalAddress = String(
        ordersSheet.getRange(row, orderCols.ADDRESS).getDisplayValue() || ''
      ).trim();
      originalStatus = String(
        ordersSheet.getRange(row, orderCols.STATUS).getDisplayValue() || ''
      ).trim();
    }
  }

  const row = sh.getLastRow() + 1;
  const createdAt = new Date();
  const changeId = generateChangeId_();

  const rowValues = new Array(sh.getLastColumn()).fill('');
  rowValues[cols.CHANGE_ID - 1] = changeId;
  rowValues[cols.ORDER_ID - 1] = data.orderId || '';
  rowValues[cols.TYPE - 1] = data.changeType || '';
  if (cols.ORIGINAL_DATE) {
    rowValues[cols.ORIGINAL_DATE - 1] = originalDate;
  }
  if (cols.ORIGINAL_TIME) {
    rowValues[cols.ORIGINAL_TIME - 1] = originalTime;
  }
  if (cols.ORIGINAL_ADDRESS) {
    rowValues[cols.ORIGINAL_ADDRESS - 1] = originalAddress;
  }
  if (cols.ORIGINAL_STATUS) {
    rowValues[cols.ORIGINAL_STATUS - 1] = originalStatus;
  }
  if (cols.REQUESTED_DATE) {
    rowValues[cols.REQUESTED_DATE - 1] = data.requestedDate || '';
  }
  if (cols.REQUESTED_TIME) {
    rowValues[cols.REQUESTED_TIME - 1] = data.requestedTime || '';
  }
  if (cols.REQUESTED_ADDRESS) {
    rowValues[cols.REQUESTED_ADDRESS - 1] = data.requestedAddress || '';
  }
  if (cols.REQUESTED_BY) {
    rowValues[cols.REQUESTED_BY - 1] = data.requestedBy || '';
  }
  rowValues[cols.STATUS - 1] = 'Pending';
  if (cols.NOTES) {
    rowValues[cols.NOTES - 1] = data.notes || '';
  }
  if (cols.APPLIED_NOTE) {
    rowValues[cols.APPLIED_NOTE - 1] = '';
  }
  if (cols.CREATED_AT) {
    rowValues[cols.CREATED_AT - 1] = createdAt;
  }

  sh.getRange(row, 1, 1, rowValues.length).setValues([rowValues]);
  return { changeId, row };
}

function submitOrderChangeFromSidebar(payload) {
  const p = payload || {};
  const orderId = String(p.orderId || '').trim();
  if (!orderId) throw new Error('Order ID requerido.');
  const changeType = normalizeChangeTypeLabel_(p.changeType);
  if (!changeType) throw new Error('Selecciona un tipo de cambio válido.');
  const requestedDate = String(p.requestedDate || '').trim();
  const requestedTime = String(p.requestedTime || '').trim();
  const requestedAddress = String(p.requestedAddress || '').trim();
  const notes = String(p.notes || '').trim();

  if (changeType === 'Reschedule' && !requestedDate) {
    throw new Error('Ingresa la nueva fecha para reprogramar.');
  }
  if (changeType === 'Address update' && !requestedAddress) {
    throw new Error('Ingresa la nueva dirección.');
  }

  let requestedBy = '';
  try {
    requestedBy = Session.getActiveUser().getEmail() || '';
  } catch (_) {}
  if (!requestedBy) {
    requestedBy = String(p.requestedBy || '').trim();
  }

  const record = recordOrderChangeRequest_({
    orderId,
    changeType,
    requestedDate,
    requestedTime,
    requestedAddress,
    requestedBy,
    notes,
  });

  return {
    ok: true,
    changeId: record.changeId,
    status: 'Pending',
    message: 'Cambio registrado en la hoja SERVI Changes.',
  };
}

function processPendingOrderChanges_() {
  const ss = getSpreadsheet_();
  const changesSheet = ss.getSheetByName(SHEET_NAMES.CHANGES);
  const ordersSheet = ss.getSheetByName(SHEET_NAMES.ORDERS);
  if (!changesSheet || !ordersSheet) return 0;

  const changeCols = changesColumnMap_(changesSheet);
  const orderCols = ordersColumnMap_(ordersSheet);
  const last = changesSheet.getLastRow();
  if (last < 2) return 0;

  let processed = 0;
  for (let r = 2; r <= last; r++) {
    const statusVal = String(
      changesSheet.getRange(r, changeCols.STATUS).getDisplayValue() || ''
    )
      .trim()
      .toLowerCase();
    if (statusVal && statusVal !== 'pending') continue;

    const changeId = String(
      changesSheet.getRange(r, changeCols.CHANGE_ID).getDisplayValue() || ''
    ).trim();
    const orderId = String(
      changesSheet.getRange(r, changeCols.ORDER_ID).getDisplayValue() || ''
    ).trim();
    const typeRaw = String(
      changesSheet.getRange(r, changeCols.TYPE).getDisplayValue() || ''
    ).trim();
    const changeType = normalizeChangeTypeLabel_(typeRaw);

    if (!orderId || !changeType) {
      if (changeCols.STATUS) changesSheet.getRange(r, changeCols.STATUS).setValue('Failed');
      if (changeCols.NOTES)
        changesSheet.getRange(r, changeCols.NOTES).setValue('Falta Order ID o tipo de cambio.');
      if (changeCols.PROCESSED_AT)
        changesSheet.getRange(r, changeCols.PROCESSED_AT).setValue(new Date());
      continue;
    }

    const orderRow = findRowByOrderId_(
      ordersSheet,
      orderCols.ORDER_ID,
      orderId
    );
    if (!orderRow) {
      if (changeCols.STATUS) changesSheet.getRange(r, changeCols.STATUS).setValue('Failed');
      if (changeCols.NOTES)
        changesSheet.getRange(r, changeCols.NOTES).setValue('Order no encontrada en SERVI Orders.');
      if (changeCols.PROCESSED_AT)
        changesSheet.getRange(r, changeCols.PROCESSED_AT).setValue(new Date());
      continue;
    }

    let applied = false;
    let note = '';
    let appliedNote = '';

    if (changeType === 'Reschedule') {
      const reqDate = String(
        changesSheet.getRange(r, changeCols.REQUESTED_DATE).getDisplayValue() ||
          ''
      ).trim();
      const reqTime =
        changeCols.REQUESTED_TIME && changeCols.REQUESTED_TIME > 0
          ? String(
              changesSheet.getRange(r, changeCols.REQUESTED_TIME).getDisplayValue() ||
                ''
            ).trim()
          : '';
      const dt = parseRequestedDateTime_(reqDate, reqTime);
      if (dt && !isNaN(dt)) {
        const beforeDisp = String(
          ordersSheet.getRange(orderRow, orderCols.SERVICE_DT).getDisplayValue() ||
            ''
        ).trim();
        ordersSheet.getRange(orderRow, orderCols.SERVICE_DT).setValue(dt);
        const stamp = Utilities.formatDate(
          dt,
          'America/Mexico_City',
          'yyyy-MM-dd HH:mm'
        );
        note = 'Reprogramado a ' + stamp;
        appliedNote = buildBeforeAfterNote_(changeId, beforeDisp, stamp);
        const targetCell = ordersSheet.getRange(orderRow, orderCols.SERVICE_DT);
        appendNote_(targetCell, appliedNote);
        applied = true;
      } else {
        note = 'Fecha u hora inválida.';
      }
    } else if (changeType === 'Cancel') {
      const statusCell = ordersSheet.getRange(orderRow, orderCols.STATUS);
      const before = String(statusCell.getDisplayValue() || '').trim();
      writeStatusSafelyWebhook_(
        ordersSheet,
        orderRow,
        orderCols.STATUS,
        'Canceled (change request)'
      );
      const after = String(statusCell.getDisplayValue() || '').trim();
      if (after && after !== before) {
        applied = true;
        note = 'Estado actualizado a ' + after;
        appliedNote = buildBeforeAfterNote_(changeId, before, after);
        appendNote_(statusCell, appliedNote);
      } else {
        note = 'Estado sin cambio (posible Captured).';
      }
    } else if (changeType === 'Address update') {
      const addr =
        changeCols.REQUESTED_ADDRESS && changeCols.REQUESTED_ADDRESS > 0
          ? String(
              changesSheet.getRange(r, changeCols.REQUESTED_ADDRESS).getDisplayValue() ||
                ''
            ).trim()
          : '';
      if (addr) {
        const beforeAddr = String(
          ordersSheet.getRange(orderRow, orderCols.ADDRESS).getDisplayValue() ||
            ''
        ).trim();
        ordersSheet.getRange(orderRow, orderCols.ADDRESS).setValue(addr);
        note = 'Dirección actualizada.';
        appliedNote = buildBeforeAfterNote_(changeId, beforeAddr, addr);
        appendNote_(ordersSheet.getRange(orderRow, orderCols.ADDRESS), appliedNote);
        applied = true;
      } else {
        note = 'No se especificó dirección.';
      }
    }

    if (applied) {
      if (changeCols.STATUS) changesSheet.getRange(r, changeCols.STATUS).setValue('Done');
      if (changeCols.APPLIED_NOTE) changesSheet.getRange(r, changeCols.APPLIED_NOTE).setValue(appliedNote || note);
      if (changeCols.NOTES) changesSheet.getRange(r, changeCols.NOTES).setValue(note);
      if (changeCols.PROCESSED_AT)
        changesSheet.getRange(r, changeCols.PROCESSED_AT).setValue(new Date());
      processed++;
    } else {
      if (changeCols.STATUS) changesSheet.getRange(r, changeCols.STATUS).setValue('Failed');
      if (changeCols.APPLIED_NOTE) changesSheet.getRange(r, changeCols.APPLIED_NOTE).setValue(appliedNote || note);
      if (changeCols.NOTES) changesSheet.getRange(r, changeCols.NOTES).setValue(note || 'No se aplicó.');
      if (changeCols.PROCESSED_AT)
        changesSheet.getRange(r, changeCols.PROCESSED_AT).setValue(new Date());
    }
  }
  return processed;
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
