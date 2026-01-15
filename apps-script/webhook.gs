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
    const customerIdPayload = String(data.customerId || '').trim();

    if (data && data.type === 'customer.consent') {
      const consentResult = handleCustomerConsentWebhook_(data);
      return ContentService.createTextOutput(
        JSON.stringify({
          status: 'ok_customer_consent',
          consent: Boolean(consentResult && consentResult.consent),
          orderId: consentResult && consentResult.orderId,
          customerId: String(
            consentResult && consentResult.customerId
              ? consentResult.customerId
              : ''
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

      const paymentIntentPayload = String(data.paymentIntentId || '').trim();
      const amountPayload = Number(data.amount || 0);
      const sheet =
        SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
      if (!sheet) {
        return ContentService.createTextOutput(
          JSON.stringify({ status: 'error', message: 'Sheet not found' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      const cols = ordersColumnMap_(sheet);

      const last = sheet.getLastRow();
      const paymentIdCol = cols.PI_ID;
      let updated = false;
      let foundRow = 0;

      for (let r = 2; r <= last; r++) {
        const oid = String(sheet.getRange(r, cols.ORDER_ID).getDisplayValue()).trim();
        const pidCell = paymentIdCol
          ? String(sheet.getRange(r, paymentIdCol).getDisplayValue()).trim()
          : '';
        const matchesOrder = oid && orderId && oid === orderId;
        const matchesPi =
          paymentIdCol && paymentIntentPayload
            ? pidCell && (pidCell === paymentIntentPayload || pidCell.includes(paymentIntentPayload))
            : false;

        if (matchesOrder || matchesPi) {
          if (paymentIdCol && paymentIntentPayload && pidCell !== paymentIntentPayload) {
            sheet.getRange(r, paymentIdCol).setValue(paymentIntentPayload);
          }
          writeStatusSafelyWebhook_(sheet, r, cols.STATUS, status);
          if (cols.UPDATE_PAYMENT_METHOD) {
            applyUpdatePaymentMethodMessageWebhook_(
              sheet,
              r,
              cols.UPDATE_PAYMENT_METHOD,
              data,
              status
            );
          }
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
        writeIdentityColumnsInOrders_(
          sheet,
          foundRow,
          orderId,
          customerIdPayload
        );
      }

      let adjustmentHandled = false;
      try {
        const adjSheet = sheet.getParent().getSheetByName(ADJ_SHEET_NAME);
        if (adjSheet) {
          adjustmentHandled = updateAdjustmentStatus_(
            adjSheet,
            paymentIntentPayload || null,
            status,
            orderId,
            amountPayload,
            customerIdPayload
          );
        }
      } catch (adjErr) {
        Logger.log('order.status adjustment update error: %s', adjErr);
      }

      return ContentService.createTextOutput(
        JSON.stringify({
          status: updated
            ? 'ok_order_status'
            : adjustmentHandled
              ? 'ok_adjustment_status'
              : 'not_found_by_order',
          orderId,
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (data && data.type === 'customer.updated') {
      return ContentService.createTextOutput(
        JSON.stringify({ status: 'ignored_customer_update' })
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
        if (cols.UPDATE_PAYMENT_METHOD) {
          applyUpdatePaymentMethodMessageWebhook_(
            sheet,
            row,
            cols.UPDATE_PAYMENT_METHOD,
            data,
            status
          );
        }

        const sLower = status.toLowerCase();
        if (sLower === 'confirmed' || sLower === 'captured') {
          sheet
            .getRange(row, receiptCol)
            .setValue(buildReceiptMessage(sheet, row));
        }

        const orderIdFromSheet = String(
          sheet.getRange(row, cols.ORDER_ID).getDisplayValue() || ''
        ).trim();
        writeIdentityColumnsInOrders_(
          sheet,
          row,
          orderIdFromSheet,
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

  const nxtLower = nxt.toLowerCase();
  const current = String(
    sheet.getRange(row, statusColIndex).getDisplayValue() || ''
  ).trim();
  const currentLower = current.toLowerCase();

  if (!current) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
    return;
  }
  if (currentLower === 'captured') return;

  if (
    nxtLower === 'canceled' ||
    nxtLower === 'failed' ||
    nxtLower === 'declined' ||
    nxtLower.startsWith('canceled (')
  ) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
    return;
  }

  if (
    (currentLower === 'declined' || currentLower === 'failed') &&
    nxt &&
    nxtLower !== currentLower
  ) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
    return;
  }

  const forwardOnly = {
    '': [
      'pending',
      'setup required',
      'setup created',
      'pending (3ds)',
      'scheduled',
      'confirmed',
      'captured',
    ],
    pending: [
      'setup required',
      'setup created',
      'pending (3ds)',
      'scheduled',
      'confirmed',
      'captured',
    ],
    'setup required': [
      'setup created',
      'pending (3ds)',
      'scheduled',
      'confirmed',
      'captured',
    ],
    'setup created': ['pending (3ds)', 'scheduled', 'confirmed', 'captured'],
    'pending (3ds)': ['scheduled', 'confirmed', 'captured'],
    scheduled: ['confirmed', 'captured'],
    confirmed: ['captured'],
  };

  if ((forwardOnly[currentLower] || []).includes(nxtLower)) {
    sheet.getRange(row, statusColIndex).setValue(nxt);
  }
}

function applyUpdatePaymentMethodMessageWebhook_(
  sheet,
  row,
  columnIndex,
  payload,
  status
) {
  if (!columnIndex) return;
  const message = String(
    (payload &&
      (payload.updatePaymentMessage || payload.billingPortalMessage)) ||
      ''
  ).trim();
  const url = String(
    (payload && (payload.updatePaymentUrl || payload.billingPortalUrl)) || ''
  ).trim();
  const reason = String((payload && payload.failureReason) || '').trim();
  const target = sheet.getRange(row, columnIndex);
  if (message) {
    target.setValue(message);
    return;
  }
  if (url) {
    target.setValue(url);
    return;
  }
  if (reason) {
    target.setValue(`Motivo: ${reason}`);
    return;
  }
  if (/^(confirmed|captured|scheduled)$/i.test(String(status || ''))) {
    target.clearContent();
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

function writeIdentityColumnsInOrders_(
  sheet,
  row,
  orderId,
  customerId,
  consentOverride
) {
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
      customerIdOpt || sheet.getRange(r, COL.CLIENT_ID).getDisplayValue() || ''
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
  return consentValue;
}

function findRowByOrderId_(sheet, columnIndex, targetId, allowPartial) {
  const target = String(targetId || '').trim();
  if (!target) return 0;
  const last = sheet.getLastRow();
  for (let row = 2; row <= last; row++) {
    const value = String(
      sheet.getRange(row, columnIndex).getDisplayValue() || ''
    ).trim();
    if (!value) continue;
    if (value === target) return row;
    if (allowPartial && value.indexOf(target) !== -1) return row;
  }
  return 0;
}

function handleCustomerConsentWebhook_(payload) {
  const consentFlag = Boolean(payload && payload.consent);
  const customerId = String(
    payload && payload.customerId ? payload.customerId : ''
  ).trim();
  const orderIdRaw = String(
    payload && payload.orderId ? payload.orderId : ''
  ).trim();
  const parentOrderId = String(
    payload && payload.parentOrderId ? payload.parentOrderId : orderIdRaw
  ).trim();
  const sourceOrderId = String(
    (payload && (payload.sourceOrderId || payload.adjustmentOrderId)) ||
      orderIdRaw
  ).trim();
  const paymentIntentId = String(
    (payload && payload.paymentIntentId) || ''
  ).trim();

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ordersSheet = ss ? ss.getSheetByName(SHEET_NAME) : null;
  const adjSheet = ss ? ss.getSheetByName(ADJ_SHEET_NAME) : null;

  const orderIdsToUpdate = [];
  if (parentOrderId) orderIdsToUpdate.push(parentOrderId);
  if (
    sourceOrderId &&
    sourceOrderId !== parentOrderId &&
    orderIdsToUpdate.indexOf(sourceOrderId) === -1
  ) {
    orderIdsToUpdate.push(sourceOrderId);
  }

  let parentRow = 0;
  let finalConsent = consentFlag;
  let anyOrderRowUpdated = false;

  if (ordersSheet && orderIdsToUpdate.length) {
    const orderCols = ordersColumnMap_(ordersSheet);
    orderIdsToUpdate.forEach(function (orderIdCandidate, idx) {
      if (!orderIdCandidate) return;
      const rowIdx = findRowByOrderId_(
        ordersSheet,
        orderCols.ORDER_ID,
        orderIdCandidate
      );
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
        adjSheet
          .getRange(adjustmentRow, adjCols.CLIENT_ID)
          .setValue(customerId);
      }
    }
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
