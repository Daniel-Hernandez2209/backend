// routes/payments.js - Wompi payment gateway integration
import express from 'express';
import crypto from 'crypto';
import Order from '../models/Order.js';

const router = express.Router();

// ── Genera el hash de integridad para Wompi ────────────────────────────────
// Formula: SHA256(reference + amountInCents + "COP" + integrityKey)
router.post('/wompi/integrity', async (req, res) => {
  try {
    const { reference, amountInCents } = req.body;

    if (!reference || !amountInCents) {
      return res.status(400).json({ success: false, message: 'reference y amountInCents son requeridos' });
    }

    const integrityKey = process.env.WOMPI_INTEGRITY_KEY;
    if (!integrityKey || integrityKey.includes('REEMPLAZA')) {
      return res.status(503).json({ success: false, message: 'Pasarela de pago no configurada' });
    }

    const cadena = `${reference}${amountInCents}COP${integrityKey}`;
    const integrity = crypto.createHash('sha256').update(cadena).digest('hex');

    res.json({
      success: true,
      data: {
        integrity,
        publicKey: process.env.WOMPI_PUBLIC_KEY,
        reference,
        amountInCents,
        currency: 'COP',
      },
    });
  } catch (err) {
    console.error('Error generando integrity Wompi:', err);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ── Webhook de Wompi ───────────────────────────────────────────────────────
// Wompi llama a este endpoint cuando cambia el estado de una transacción
router.post('/wompi/webhook', async (req, res) => {
  try {
    const { event, data, sent_at, signature } = req.body;

    // Verificar firma del evento
    const eventsKey = process.env.WOMPI_EVENTS_KEY;
    if (eventsKey && !eventsKey.includes('REEMPLAZA') && signature?.checksum) {
      const cadena = `${data?.transaction?.id}${sent_at}${eventsKey}`;
      const expectedChecksum = crypto.createHash('sha256').update(cadena).digest('hex');
      if (expectedChecksum !== signature.checksum) {
        console.warn('Wompi webhook: firma inválida');
        return res.status(401).json({ success: false, message: 'Firma inválida' });
      }
    }

    if (event === 'transaction.updated') {
      const transaction = data?.transaction;
      if (!transaction) return res.json({ success: true });

      const { reference, status } = transaction;

      // Mapear estado de Wompi al estado interno del pedido
      const statusMap = {
        APPROVED: 'confirmed',
        DECLINED: 'cancelled',
        VOIDED: 'cancelled',
        ERROR: 'cancelled',
        PENDING: 'pending',
      };

      const newStatus = statusMap[status];
      if (newStatus && reference) {
        // reference es el orderNumber que enviamos a Wompi
        await Order.findOneAndUpdate(
          { orderNumber: reference },
          {
            status: newStatus,
            'payment.status': status === 'APPROVED' ? 'paid' : status.toLowerCase(),
            'payment.transactionId': transaction.id,
            'payment.paidAt': status === 'APPROVED' ? new Date() : undefined,
          },
        );
        console.log(`Wompi webhook: pedido ${reference} → ${newStatus}`);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error en webhook Wompi:', err);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

// ── Consultar estado de transacción ───────────────────────────────────────
// El frontend lo llama desde la página de resultado para confirmar el pago
router.get('/wompi/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !/^[a-zA-Z0-9_-]{5,100}$/.test(id)) {
      return res.status(400).json({ success: false, message: 'ID de transacción inválido' });
    }

    const privateKey = process.env.WOMPI_PRIVATE_KEY;
    if (!privateKey || privateKey.includes('REEMPLAZA')) {
      return res.status(503).json({ success: false, message: 'Pasarela no configurada' });
    }

    const response = await fetch(`https://sandbox.wompi.co/v1/transactions/${id}`, {
      headers: { Authorization: `Bearer ${privateKey}` },
    });

    if (!response.ok) {
      return res.status(502).json({ success: false, message: 'Error consultando Wompi' });
    }

    const wompiData = await response.json();
    const transaction = wompiData.data;

    // Actualizar el pedido si viene aprobado
    if (transaction?.reference && transaction?.status) {
      const statusMap = { APPROVED: 'confirmed', DECLINED: 'cancelled', VOIDED: 'cancelled' };
      const newStatus = statusMap[transaction.status];
      if (newStatus) {
        await Order.findOneAndUpdate(
          { orderNumber: transaction.reference },
          {
            status: newStatus,
            'payment.status': transaction.status === 'APPROVED' ? 'paid' : transaction.status.toLowerCase(),
            'payment.transactionId': transaction.id,
            'payment.paidAt': transaction.status === 'APPROVED' ? new Date() : undefined,
          },
        );
      }
    }

    res.json({
      success: true,
      data: {
        status: transaction?.status,
        reference: transaction?.reference,
        amountInCents: transaction?.amount_in_cents,
        paymentMethod: transaction?.payment_method_type,
      },
    });
  } catch (err) {
    console.error('Error consultando transacción Wompi:', err);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

export default router;
