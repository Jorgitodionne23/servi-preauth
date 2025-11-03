// Local mirror of Google Apps Script project for editing only; changes must be pasted back into Apps Script.
const SHEET_NAME = SHEET_NAMES.ORDERS;
const ADJ_SHEET_NAME = SHEET_NAMES.ADJUSTMENTS;

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'No postData received' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const payloadText = e.postData.contents;
    Logger.log('RAW BODY: %s', payloadText);

    const data = JSON.parse(payloadText);

    if (data && data.type === 'customer.consent') {
      const consentResult = handleCustomerConsentWebhook_(data);
      return ContentService.createTextOutput(
        JSON.stringify({
          status: 'ok_customer_consent',
          consent: Boolean(consentResult && consentResult.consent),
          orderId: consentResult && consentResult.orderId,
          customerId: String(
            consentResult && consentResult.customerId ? consentResult.customerId : ''
          ).trim(),
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (data && data.type === 'order.status') {
      const orderId = String(data.orderId || '').trim();
      const status = String(data.status || '').trim();
      if (!orderId || !status) {
        return ContentService.createTextOutput(
          JSON.stringify({
            status: 'error',
            message: 'Missing orderId or status',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const customerIdPayload = String(data.customerId || '').trim();
      const sheet =
        SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      if (!sheet) {
        return ContentService.createTextOutput(
          JSON.stringify({ status: 'error', message: 'Sheet not found' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      const cols = ordersColumnMap_(sheet);

      const last = sheet.getLastRow();
      let updated = false;
      let foundRow = 0;

      for (let r = 2; r <= last; r++) {
        const oid = String(
          sheet.getRange(r, cols.ORDER_ID).getDisplayValue()
        ).trim();
        if (oid && oid === orderId) {
          writeStatusSafelyWebhook_(sheet, r, cols.STATUS, status);
          if (/^scheduled$/i.test(status)) {
            sheet
              .getRange(r, cols.RECEIPT)
              .setValue(buildReceiptMessage(sheet, r));
          } else if (
            /^saved$/i.test(status) ||
            /^setup created$/i.test(status)
          ) {
            sheet.getRange(r, cols.RECEIPT).clearContent();
          }
          foundRow = r;
          updated = true;
          break;
        }
      }

      if (foundRow) {
        const consentApplied = writeIdentityColumnsInOrders_(
          sheet,
          foundRow,
          orderId,
          customerIdPayload
        );
        updateClientRegistryForConsent_(
          sheet,
          foundRow,
          orderId,
          consentApplied,
          customerIdPayload
        );
      }

      if (!updated) {
        try {
          const workbook = SpreadsheetApp.openById(SPREADSHEET_ID);
          const adjSheet = workbook.getSheetByName(ADJ_SHEET_NAME);
          if (adjSheet) {
            const handled = updateAdjustmentStatus_(
              adjSheet,
              String(data.paymentIntentId || '').trim() || null,
              status,
              orderId,
              Number(data.amount || 0),
              customerIdPayload
            );
            if (handled) {
              return ContentService.createTextOutput(
                JSON.stringify({ status: 'ok_adjustment_status', orderId })
              ).setMimeType(ContentService.MimeType.JSON);
            }
          }
        } catch (adjErr) {
          Logger.log('order.status adjustment update error: %s', adjErr);
        }
      }

      return ContentService.createTextOutput(
        JSON.stringify({
          status: updated ? 'ok_order_status' : 'not_found_by_order',
          orderId,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (data && data.type === 'customer.updated') {
      try {
        upsertClientFromCustomerUpdate_(data);
      } catch (errU) {
        Logger.log('customer.updated handler error: %s', errU);
      }
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'ok_customer_updated' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const paymentIntentId = String(data.paymentIntentId || '').trim();
    const status = String(data.status || '').trim();
    if (!paymentIntentId || !status) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: 'error',
          message: 'Missing paymentIntentId or status',
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const sheet =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'error', message: 'Sheet not found' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const cols = ordersColumnMap_(sheet);

    const paymentIdCol = cols.PI_ID;
    const statusCol = cols.STATUS;
    const receiptCol = cols.RECEIPT;
    const startRow = 2;
    const lastRow = sheet.getLastRow();
    const orderIdFromPayload = String(data.orderId || '').trim();
    let updatedRow = null;
    for (let row = startRow; row <= lastRow; row++) {
      const cell = String(
        sheet.getRange(row, paymentIdCol).getDisplayValue()
      ).trim();
      const orderIdCell = orderIdFromPayload
        ? String(
            sheet.getRange(row, cols.ORDER_ID).getDisplayValue() || ''
          ).trim()
        : '';

      const matchesPi =
        cell && (cell === paymentIntentId || cell.includes(paymentIntentId));
      const matchesOrderId =
        !matchesPi && orderIdFromPayload && orderIdCell === orderIdFromPayload;

      if (matchesPi || matchesOrderId) {
        if (paymentIntentId && cell !== paymentIntentId) {
          sheet.getRange(row, paymentIdCol).setValue(paymentIntentId);
        }
        writeStatusSafelyWebhook_(sheet, row, statusCol, status);

        const sLower = status.toLowerCase();
        if (sLower === 'confirmed' || sLower === 'captured') {
          sheet
            .getRange(row, receiptCol)
            .setValue(buildReceiptMessage(sheet, row));
        }

        const orderIdFromSheet = String(
          sheet.getRange(row, cols.ORDER_ID).getDisplayValue() || ''
        ).trim();
        const consentApplied = writeIdentityColumnsInOrders_(
          sheet,
          row,
          orderIdFromSheet,
          customerIdPayload
        );
        updateClientRegistryForConsent_(
          sheet,
          row,
          orderIdFromSheet,
          consentApplied,
          customerIdPayload
        );

        updatedRow = row;
        break;
      }
    }

    if (!updatedRow) {
      const workbook = SpreadsheetApp.openById(SPREADSHEET_ID);
      const adjSheet = workbook.getSheetByName(ADJ_SHEET_NAME);
      if (adjSheet) {
        const handled = updateAdjustmentStatus_(
          adjSheet,
          paymentIntentId,
          status,
          orderIdFromPayload,
          Number(data.amount || 0),
          customerIdPayload
        );
        if (handled) {
          return ContentService.createTextOutput(
            JSON.stringify({ status: 'success_adjustment' })
          ).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }

    if (updatedRow) {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'success', row: updatedRow })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ status: 'not_found', paymentIntentId })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log(
      'Webhook processing error: %s',
      err && err.stack ? err.stack : err
    );
    return ContentService.createTextOutput(
      JSON.stringify({
        status: 'error',
        message: err.message || 'Unknown error',
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function writeStatusSafelyWebhook_(sheet, row, statusColIndex, newStatusRaw) {
  const nxt = String(newStatusRaw || '').trim();
  if (!nxt) return;

  const current = String(
    sheet.getRange(row, statusColIndex).getDisplayValue() || ''
  ).trim();
  if (!current) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
    return;
  }
  if (current === 'Captured') return;

  if (
    nxt === 'Canceled' ||
    nxt === 'Failed' ||
    nxt === 'Declined' ||
    nxt.startsWith('Canceled (')
  ) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
    return;
  }

  const forwardOnly = {
    '': [
      'Pending',
      'Setup required',
      'Setup created',
      'Pending (3DS)',
      'Scheduled',
      'Confirmed',
      'Captured',
    ],
    Pending: [
      'Setup required',
      'Setup created',
      'Pending (3DS)',
      'Scheduled',
      'Confirmed',
      'Captured',
    ],
    'Setup required': [
      'Setup created',
      'Pending (3DS)',
      'Scheduled',
      'Confirmed',
      'Captured',
    ],
    'Setup created': ['Pending (3DS)', 'Scheduled', 'Confirmed', 'Captured'],
    'Pending (3DS)': ['Scheduled', 'Confirmed', 'Captured'],
    Scheduled: ['Confirmed', 'Captured'],
    Confirmed: ['Captured'],
  };

  if ((forwardOnly[current] || []).includes(nxt)) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
  }
}

function buildReceiptMessage(sheet, row) {
  const cols = ordersColumnMap_(sheet);

  const name = String(
    sheet.getRange(row, cols.CLIENT_NAME).getDisplayValue() || ''
  ).trim();
  const service = String(
    sheet.getRange(row, cols.SERVICE_DESC).getDisplayValue() || ''
  ).trim();
  const totalNum = Number(sheet.getRange(row, cols.TOTAL_PAID).getValue() || 0);
  const serviceCell = sheet.getRange(row, cols.SERVICE_DT);
  const serviceVal = serviceCell.getValue();
  const serviceDisp = String(serviceCell.getDisplayValue() || '').trim();
  const address = String(
    sheet.getRange(row, cols.ADDRESS).getDisplayValue() || ''
  ).trim();
  const orderIdRaw = String(
    sheet.getRange(row, cols.ORDER_ID).getDisplayValue() || ''
  ).trim();
  const linkVal = String(
    sheet.getRange(row, cols.LINK_MSG).getDisplayValue() || ''
  ).trim();
  const shortFromCol = String(
    sheet.getRange(row, cols.SHORT_CODE).getDisplayValue() || ''
  ).trim();

  const blank = (x) => (x && String(x).trim() ? String(x).trim() : '________');

  let orderCode = '________';
  const m = linkVal.match(/\/o\/([A-Za-z0-9]+)/);
  if (m && m[1]) {
    orderCode = m[1].toUpperCase();
  } else if (shortFromCol) {
    orderCode = shortFromCol.toUpperCase();
  } else if (orderIdRaw) {
    orderCode = orderIdRaw.replace(/-/g, '').slice(-8).toUpperCase();
  }

  const totalText =
    Number.isFinite(totalNum) && totalNum > 0
      ? totalNum.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      : '_____';

  function parseServiceDate(displayValue) {
    if (!displayValue) return null;
    const m = displayValue.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
    );
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const hour = m[4] !== undefined ? parseInt(m[4], 10) : 0;
    const minute = m[5] !== undefined ? parseInt(m[5], 10) : 0;
    return new Date(year, month, day, hour, minute, 0, 0);
  }

  let svcDate =
    serviceVal instanceof Date && !isNaN(serviceVal)
      ? new Date(serviceVal.getTime())
      : parseServiceDate(serviceDisp);

  let whenLine = serviceDisp || '_____';
  if (svcDate && !isNaN(svcDate)) {
    const datePart = svcDate.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const timePartRaw = svcDate.toLocaleTimeString('es-MX', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const timePart = /\d/.test(timePartRaw)
      ? timePartRaw.replace(/\b(a\.?\s*m\.?|p\.?\s*m\.?)\b/iu, (match) =>
          match.toLowerCase().startsWith('a') ? 'A.M.' : 'P.M.'
        )
      : '';

    whenLine = timePart ? `${datePart}, ${timePart}` : datePart;
  }

  const lines = [
    `¡${blank(name)}, tu servicio de ${blank(service)} ha sido confirmado!`,
    `Tu número de orden es: ${orderCode}`,
    '¿Necesitas modificar algo o cancelar? Solo responde a este mensaje.',
    'Detalles de tu SERVI:',
    whenLine,
    address || '_____',
    `${totalText}.`,
  ];

  return lines.join('\n');
}

function initAuth() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ss.getSheets()[0].getName();
}

function buildAdjustmentReceipt_(sheet, row) {
  const cols = adjustmentsColumnMap_(sheet);

  const reason = String(
    sheet.getRange(row, cols.REASON).getDisplayValue() || ''
  ).trim();
  const totalVal = Number(
    sheet.getRange(row, cols.TOTAL_CHARGED || cols.AMOUNT).getValue() || 0
  );
  const amtVal =
    totalVal || Number(sheet.getRange(row, cols.AMOUNT).getValue() || 0);
  const childId = String(
    sheet.getRange(row, cols.ADJUSTMENT_ORDER_ID).getDisplayValue() || ''
  ).trim();
  const short = String(
    sheet.getRange(row, cols.SHORT_CODE).getDisplayValue() || ''
  ).trim();

  const amountText = amtVal
    ? amtVal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
    : '________';

  return [
    'Ajuste confirmado',
    reason ? `Motivo: ${reason}` : '',
    `Monto: ${amountText}`,
    childId ? `Adjustment ID: ${childId}` : '',
    short ? `Enlace: ${SERVI_BASE}/o/${short}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function writeIdentityColumnsInOrders_(sheet, row, orderId, customerId, consentOverride) {
  if (customerId) {
    sheet.getRange(row, ORD_COL.CLIENT_ID).setValue(String(customerId));
  }

  if (typeof consentOverride === 'boolean') {
    const typeCell = sheet.getRange(row, ORD_COL.CLIENT_TYPE);
    typeCell.setValue(consentOverride ? 'SERVI Client' : 'Guest');
    return consentOverride;
  }

  let consentOk = null;
  try {
    const r = UrlFetchApp.fetch(
      `${SERVI_BASE}/orders/${encodeURIComponent(orderId)}/consent`,
      { method: 'get', muteHttpExceptions: true }
    );
    if (r.getResponseCode() === 200) {
      const c = JSON.parse(r.getContentText() || '{}');
      const typeCell = sheet.getRange(row, ORD_COL.CLIENT_TYPE);
      consentOk = Boolean(c && c.ok);
      typeCell.setValue(consentOk ? 'SERVI Client' : 'Guest');
    }
  } catch (_) {}

  return consentOk;
}

function ensureClientsSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAMES.CLIENTS);
  if (sh) return sh;

  sh = ss.insertSheet(SHEET_NAMES.CLIENTS);
  const headers = [
    'Date created',
    'Client Name',
    'WhatsApp (E.164)',
    'Email',
    'Stripe Customer ID',
    'First Order ID',
    'Short Order ID',
    'Notes',
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  clearColumnCache_('clients', sh);
  return sh;
}

function upsertClientFromOrdersRow_(ordersSheet, row, orderId, customerId) {
  const clients = ensureClientsSheet_();
  const orderCols = ordersColumnMap_(ordersSheet);
  const clientCols = clientsColumnMap_(clients);

  const name = String(
    ordersSheet.getRange(row, orderCols.CLIENT_NAME).getDisplayValue() || ''
  ).trim();
  const phone = String(
    ordersSheet.getRange(row, orderCols.PHONE).getDisplayValue() || ''
  ).trim();
  const normalizedPhone = normalizePhoneToE164_(phone);
  const short = String(
    ordersSheet.getRange(row, orderCols.SHORT_CODE).getDisplayValue() || ''
  ).trim();

  if (!customerId) return false;

  const last = clients.getLastRow();
  let foundRow = 0;

  if (last >= 2) {
    const phones = clients
      .getRange(2, clientCols.WHATSAPP, last - 1, 1)
      .getDisplayValues();
    const custs = clients
      .getRange(2, clientCols.STRIPE_CUSTOMER_ID, last - 1, 1)
      .getDisplayValues();

    for (let i = 0; i < custs.length; i++) {
      const cid = String(custs[i][0] || '').trim();
      if (cid && cid === customerId) {
        foundRow = i + 2;
        break;
      }
    }
    if (!foundRow && normalizedPhone) {
      for (let i = 0; i < phones.length; i++) {
        const ph = String(phones[i][0] || '').trim();
        if (ph && ph === normalizedPhone) {
          foundRow = i + 2;
          break;
        }
      }
    }
  }

  if (!foundRow) {
    foundRow = last + 1;
    const ts = Utilities.formatDate(
      new Date(),
      'America/Mexico_City',
      'yyyy-MM-dd HH:mm:ss'
    );
    clients
      .getRange(foundRow, clientCols.DATE_CREATED)
      .setValue(ts)
      .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    if (orderId)
      clients.getRange(foundRow, clientCols.FIRST_ORDER_ID).setValue(orderId);
  }

  clients.getRange(foundRow, clientCols.CLIENT_NAME).setValue(name || '');
  clients
    .getRange(foundRow, clientCols.WHATSAPP)
    .setValue(normalizedPhone || '');
  if (clientCols.EMAIL) {
    clients.getRange(foundRow, clientCols.EMAIL).setValue('');
  }
  clients
    .getRange(foundRow, clientCols.STRIPE_CUSTOMER_ID)
    .setValue(customerId || '');

  const existingFirst = String(
    clients.getRange(foundRow, clientCols.FIRST_ORDER_ID).getDisplayValue() ||
      ''
  ).trim();
  if (!existingFirst && orderId) {
    clients.getRange(foundRow, clientCols.FIRST_ORDER_ID).setValue(orderId);
  }

  clients.getRange(foundRow, clientCols.SHORT_ORDER_ID).setValue(short || '');

  return true;
}

function removeClientByCustomerId_(customerId) {
  const id = String(customerId || '').trim();
  if (!id) return false;
  const clients = getSheet_(SHEET_NAMES.CLIENTS);
  if (!clients) return false;
  const cols = clientsColumnMap_(clients);
  const last = clients.getLastRow();
  if (last < 2) return false;
  const ids = clients
    .getRange(2, cols.STRIPE_CUSTOMER_ID, last - 1, 1)
    .getDisplayValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim() === id) {
      clients.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function updateClientRegistryForConsent_(
  ordersSheet,
  row,
  orderId,
  consentOk,
  customerIdOpt
) {
  if (typeof consentOk !== 'boolean') return false;
  const cols = ordersColumnMap_(ordersSheet);
  const idCell = ordersSheet.getRange(row, cols.CLIENT_ID);
  const existingId = String(idCell.getDisplayValue() || '').trim();
  const resolvedCustomerId = String(
    customerIdOpt || existingId || ''
  ).trim();

  if (customerIdOpt && customerIdOpt !== existingId) {
    idCell.setValue(customerIdOpt);
  }

  if (!resolvedCustomerId) return false;

  if (consentOk) {
    return upsertClientFromOrdersRow_(
      ordersSheet,
      row,
      orderId,
      resolvedCustomerId
    );
  }

  return removeClientByCustomerId_(resolvedCustomerId);
}

function updateAdjustmentStatus_(
  sheet,
  paymentIntentId,
  status,
  orderIdOpt,
  amountCentsOpt,
  customerIdOpt
) {
  const COL = adjustmentsColumnMap_(sheet);
  const last = sheet.getLastRow();

  for (let r = 2; r <= last; r++) {
    const pi = String(
      sheet.getRange(r, COL.PAYMENT_INTENT_ID).getDisplayValue() || ''
    ).trim();
    const orderIdCell = String(
      sheet.getRange(r, COL.ADJUSTMENT_ORDER_ID).getDisplayValue() || ''
    ).trim();

    const matchesPi =
      paymentIntentId &&
      pi &&
      (pi === paymentIntentId || pi.includes(paymentIntentId));
    const matchesOrder =
      orderIdOpt && orderIdCell && orderIdCell === orderIdOpt;

    if (!matchesPi && !matchesOrder) continue;

    if (paymentIntentId && (!pi || pi !== paymentIntentId)) {
      sheet.getRange(r, COL.PAYMENT_INTENT_ID).setValue(paymentIntentId);
    }

    if (Number.isFinite(amountCentsOpt)) {
      const totalCell = sheet.getRange(r, COL.TOTAL_CHARGED);
      if (!totalCell.getValue()) {
        totalCell.setValue(amountCentsOpt / 100);
        totalCell.setNumberFormat('$#,##0.00');
      }
    }

    writeStatusSafelyWebhook_(sheet, r, COL.STATUS, status);

    if (/^(confirmed|captured)$/i.test(status)) {
      const txt = buildAdjustmentReceipt_(sheet, r);
      sheet.getRange(r, COL.RECEIPT).setValue(txt);
    } else if (/^canceled$/i.test(status)) {
      sheet.getRange(r, COL.RECEIPT).setValue('Autorización cancelada.');
    } else if (/^failed$/i.test(status)) {
      sheet.getRange(r, COL.RECEIPT).setValue('Pago fallido.');
    }

    const parentOrderId = String(
      sheet.getRange(r, COL.PARENT_ORDER_ID).getDisplayValue() || ''
    ).trim();
    const linkedCustomerId = String(
      customerIdOpt ||
        sheet.getRange(r, COL.CLIENT_ID).getDisplayValue() ||
        ''
    ).trim();

    if (linkedCustomerId) {
      sheet.getRange(r, COL.CLIENT_ID).setValue(linkedCustomerId);
    }

    if (/^(confirmed|captured)$/i.test(status) && parentOrderId) {
      const consentSnapshot = refreshConsentForOrder_(
        parentOrderId,
        linkedCustomerId,
        undefined,
        sheet.getParent()
      );
      if (typeof consentSnapshot === 'boolean') {
        sheet
          .getRange(r, COL.CONSENT)
          .setValue(consentSnapshot ? 'Yes' : 'Missing');
      }
    }

    return true;
  }
  return false;
}

function refreshConsentForOrder_(
  orderId,
  customerIdOpt,
  consentOverrideOpt,
  ssOpt,
  ordersSheetOpt
) {
  const orderKey = String(orderId || '').trim();
  if (!orderKey) return null;
  const ss = ssOpt || SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss) return null;
  const ordersSheet = ordersSheetOpt || ss.getSheetByName(SHEET_NAME);
  if (!ordersSheet) return null;
  const cols = ordersColumnMap_(ordersSheet);
  const row = findRowByOrderId_(ordersSheet, cols.ORDER_ID, orderKey);
  if (!row) return null;
  const applied = writeIdentityColumnsInOrders_(
    ordersSheet,
    row,
    orderKey,
    customerIdOpt,
    consentOverrideOpt
  );
  const consentValue =
    typeof applied === 'boolean'
      ? applied
      : typeof consentOverrideOpt === 'boolean'
      ? consentOverrideOpt
      : null;
  if (typeof consentValue === 'boolean') {
    updateClientRegistryForConsent_(
      ordersSheet,
      row,
      orderKey,
      consentValue,
      customerIdOpt
    );
  }
  return consentValue;
}

function findRowByOrderId_(sheet, columnIndex, targetId, allowPartial) {
  const target = String(targetId || '').trim();
  if (!target) return 0;
  const last = sheet.getLastRow();
  for (let row = 2; row <= last; row++) {
    const value = String(sheet.getRange(row, columnIndex).getDisplayValue() || '').trim();
    if (!value) continue;
    if (value === target) return row;
    if (allowPartial && value.indexOf(target) !== -1) return row;
  }
  return 0;
}

function handleCustomerConsentWebhook_(payload) {
  const consentFlag = Boolean(payload && payload.consent);
  const customerId = String(payload && payload.customerId ? payload.customerId : '').trim();
  const orderIdRaw = String(payload && payload.orderId ? payload.orderId : '').trim();
  const parentOrderId = String(
    payload && payload.parentOrderId ? payload.parentOrderId : orderIdRaw
  ).trim();
  const sourceOrderId = String(
    (payload && (payload.sourceOrderId || payload.adjustmentOrderId)) || orderIdRaw
  ).trim();
  const paymentIntentId = String(
    (payload && payload.paymentIntentId) || ''
  ).trim();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ordersSheet = ss ? ss.getSheetByName(SHEET_NAME) : null;
  const adjSheet = ss ? ss.getSheetByName(ADJ_SHEET_NAME) : null;

  const orderIdsToUpdate = [];
  if (parentOrderId) {
    orderIdsToUpdate.push(parentOrderId);
  } else if (sourceOrderId) {
    orderIdsToUpdate.push(sourceOrderId);
  }

  let parentRow = 0;
  let finalConsent = consentFlag;
  let anyOrderRowUpdated = false;

  if (ordersSheet && orderIdsToUpdate.length) {
    const orderCols = ordersColumnMap_(ordersSheet);
    orderIdsToUpdate.forEach(function (orderIdCandidate, idx) {
      if (!orderIdCandidate) return;
      const rowIdx = findRowByOrderId_(ordersSheet, orderCols.ORDER_ID, orderIdCandidate);
      if (!rowIdx) return;
      if (idx === 0) parentRow = rowIdx;
      const applied = writeIdentityColumnsInOrders_(
        ordersSheet,
        rowIdx,
        orderIdCandidate,
        customerId,
        consentFlag
      );
      finalConsent = typeof applied === 'boolean' ? applied : consentFlag;
      updateClientRegistryForConsent_(
        ordersSheet,
        rowIdx,
        orderIdCandidate,
        finalConsent,
        customerId
      );
      anyOrderRowUpdated = true;
    });
  }

  let adjustmentRow = 0;
  if (adjSheet) {
    const adjCols = adjustmentsColumnMap_(adjSheet);
    const lookupId = sourceOrderId || paymentIntentId || parentOrderId;
    adjustmentRow = findRowByOrderId_(
      adjSheet,
      adjCols.ADJUSTMENT_ORDER_ID,
      lookupId
    );
    if (!adjustmentRow && paymentIntentId) {
      adjustmentRow = findRowByOrderId_(
        adjSheet,
        adjCols.PAYMENT_INTENT_ID,
        paymentIntentId,
        true
      );
    }
    if (adjustmentRow) {
      adjSheet
        .getRange(adjustmentRow, adjCols.CONSENT)
        .setValue(finalConsent ? 'Yes' : 'Missing');
      if (customerId) {
        adjSheet.getRange(adjustmentRow, adjCols.CLIENT_ID).setValue(customerId);
      }
    }
  }

  if (!anyOrderRowUpdated && !finalConsent && customerId) {
    removeClientByCustomerId_(customerId);
  }

  return {
    consent: finalConsent,
    customerId,
    orderId: parentOrderId,
    sourceOrderId,
    paymentIntentId,
    parentRow: parentRow || null,
    adjustmentRow: adjustmentRow || null,
  };
}

function upsertClientFromCustomerUpdate_(payload) {
  const sh = ensureClientsSheet_();
  if (!sh) return false;

  const cols = clientsColumnMap_(sh);

  const id = String(payload.id || '').trim();
  if (!id) return false;

  const name = String(payload.name || '').trim();
  const phone = normalizePhoneToE164_(String(payload.phone || '').trim());
  const email = String(payload.email || '').trim();

  const last = sh.getLastRow();
  let rowToUpdate = 0;

  if (last >= 2) {
    const cids = sh
      .getRange(2, cols.STRIPE_CUSTOMER_ID, last - 1, 1)
      .getDisplayValues();
    for (let i = 0; i < cids.length; i++) {
      if (String(cids[i][0] || '').trim() === id) {
        rowToUpdate = i + 2;
        break;
      }
    }
  }

  if (!rowToUpdate) {
    rowToUpdate = last + 1;
    const ts = Utilities.formatDate(
      new Date(),
      'America/Mexico_City',
      'yyyy-MM-dd HH:mm:ss'
    );
    sh.getRange(rowToUpdate, cols.DATE_CREATED)
      .setValue(ts)
      .setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sh.getRange(rowToUpdate, cols.STRIPE_CUSTOMER_ID).setValue(id);
  }

  if (name) sh.getRange(rowToUpdate, cols.CLIENT_NAME).setValue(name);
  if (phone) sh.getRange(rowToUpdate, cols.WHATSAPP).setValue(phone);
  if (email && cols.EMAIL) sh.getRange(rowToUpdate, cols.EMAIL).setValue(email);

  return true;
}

function normalizePhoneToE164_(raw, defaultCountry) {
  defaultCountry = defaultCountry || '+52';
  if (!raw) return '';
  const src = String(raw).trim();
  const digits = src.replace(/\D+/g, '');
  if (src.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return defaultCountry + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return '+' + digits;
}
