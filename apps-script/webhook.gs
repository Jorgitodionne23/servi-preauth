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
        writeIdentityColumnsInOrders_(
          sheet,
          foundRow,
          orderId,
          String(data.customerId || '')
        );
      }

      if (
        foundRow &&
        /(scheduled|saved|setup created)/i.test(status) &&
        data.customerId
      ) {
        upsertClientFromOrdersRow_(
          sheet,
          foundRow,
          orderId,
          String(data.customerId || '')
        );
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

    let updatedRow = null;
    for (let row = startRow; row <= lastRow; row++) {
      const cell = String(
        sheet.getRange(row, paymentIdCol).getDisplayValue()
      ).trim();
      if (!cell) continue;
      if (cell === paymentIntentId || cell.includes(paymentIntentId)) {
        writeStatusSafelyWebhook_(sheet, row, statusCol, status);

        const sLower = status.toLowerCase();
        if (sLower === 'confirmed' || sLower === 'captured') {
          sheet
            .getRange(row, receiptCol)
            .setValue(buildReceiptMessage(sheet, row));
        }

        try {
          const orderIdFromRow = String(
            sheet.getRange(row, cols.ORDER_ID).getDisplayValue() || ''
          ).trim();
          if (orderIdFromRow) {
            const resp = UrlFetchApp.fetch(
              `${SERVI_BASE}/orders/${encodeURIComponent(orderIdFromRow)}/consent`,
              { method: 'get', muteHttpExceptions: true }
            );
            if (resp.getResponseCode() === 200) {
              const consent = JSON.parse(resp.getContentText() || '{}');
              if (consent && consent.ok) {
                sheet.getRange(row, cols.CLIENT_TYPE).setValue('SERVI Client');
                const customerIdPayload = String(data.customerId || '').trim();
                if (customerIdPayload) {
                  sheet
                    .getRange(row, cols.CLIENT_ID)
                    .setValue(customerIdPayload);
                }
              }
            }
          }
        } catch (errFlag) {
          Logger.log('client flag write error: %s', errFlag);
        }

        const orderIdFromSheet = String(
          sheet.getRange(row, cols.ORDER_ID).getDisplayValue() || ''
        ).trim();
        writeIdentityColumnsInOrders_(
          sheet,
          row,
          orderIdFromSheet,
          String(data.customerId || '')
        );

        updatedRow = row;
        break;
      }
    }

    if (updatedRow && /^(confirmed|captured)$/i.test(status)) {
      try {
        const orderIdFromSheet = String(
          sheet.getRange(updatedRow, cols.ORDER_ID).getDisplayValue() || ''
        ).trim();
        if (orderIdFromSheet) {
          const consentResp = UrlFetchApp.fetch(
            `${SERVI_BASE}/orders/${encodeURIComponent(orderIdFromSheet)}/consent`,
            { method: 'get', muteHttpExceptions: true }
          );
          if (consentResp.getResponseCode() === 200) {
            const consentData = JSON.parse(
              consentResp.getContentText() || '{}'
            );
            if (consentData && consentData.ok) {
              const orderIdPayload =
                String(data.orderId || '') || orderIdFromSheet;
              const customerIdPayload = String(data.customerId || '');
              upsertClientFromOrdersRow_(
                sheet,
                updatedRow,
                orderIdPayload,
                customerIdPayload
              );
            }
          }
        }
      } catch (errClient) {
        Logger.log('Auto client upsert failed: %s', errClient);
      }
    }

    if (!updatedRow) {
      const workbook = SpreadsheetApp.openById(SPREADSHEET_ID);
      const adjSheet = workbook.getSheetByName(ADJ_SHEET_NAME);
      if (adjSheet) {
        const handled = updateAdjustmentStatus_(
          adjSheet,
          paymentIntentId,
          status
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
  const amountNum = Number(sheet.getRange(row, cols.AMOUNT).getValue() || 0);
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

  const amountText = amountNum
    ? amountNum.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
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
    `${amountText}.`,
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
  const amtVal = Number(sheet.getRange(row, cols.AMOUNT).getValue() || 0);
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

function writeIdentityColumnsInOrders_(sheet, row, orderId, customerId) {
  if (customerId) {
    sheet.getRange(row, ORD_COL.CLIENT_ID).setValue(String(customerId));
  }
  try {
    const r = UrlFetchApp.fetch(
      `${SERVI_BASE}/orders/${encodeURIComponent(orderId)}/consent`,
      { method: 'get', muteHttpExceptions: true }
    );
    if (r.getResponseCode() === 200) {
      const c = JSON.parse(r.getContentText() || '{}');
      const typeCell = sheet.getRange(row, ORD_COL.CLIENT_TYPE);
      const existing = String(typeCell.getDisplayValue() || '').trim();
      if (c && c.ok) {
        typeCell.setValue('SERVI Client');
      } else if (!existing) {
        typeCell.setValue('Guest');
      }
    }
  } catch (_) {}
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

function updateAdjustmentStatus_(sheet, paymentIntentId, status) {
  const COL = adjustmentsColumnMap_(sheet);
  const last = sheet.getLastRow();

  for (let r = 2; r <= last; r++) {
    const pi = String(
      sheet.getRange(r, COL.PAYMENT_INTENT_ID).getDisplayValue() || ''
    ).trim();
    if (!pi) continue;
    if (pi === paymentIntentId || pi.includes(paymentIntentId)) {
      writeStatusSafelyWebhook_(sheet, r, COL.STATUS, status);

      if (/^(confirmed|captured)$/i.test(status)) {
        const txt = buildAdjustmentReceipt_(sheet, r);
        sheet.getRange(r, COL.RECEIPT).setValue(txt);
      } else if (/^canceled$/i.test(status)) {
        sheet.getRange(r, COL.RECEIPT).setValue('Autorización cancelada.');
        sheet.getRange(r, COL.MESSAGE).clearContent();
      } else if (/^failed$/i.test(status)) {
        sheet.getRange(r, COL.RECEIPT).setValue('Pago fallido.');
        sheet.getRange(r, COL.MESSAGE).clearContent();
      }
      return true;
    }
  }
  return false;
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
