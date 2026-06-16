// utils/sendEmail.js - Utilidad para envío de emails
import nodemailer from "nodemailer";

// Configuración del transporter
const createTransporter = () => {
  // ✅ VALIDATE required environment variables
  const requiredVars = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASS"];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(", ")}`);
  }

  // Configuración para Gmail (cambiar según tu proveedor)
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.EMAIL_REJECT_UNAUTHORIZED !== "false",
    },
  });
};

// Templates de email
const getEmailTemplate = (template, data) => {
  switch (template) {
    case "verification":
      return {
        subject: "Verificar cuenta - ATHENA BRAND",
        html: `
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #F5F2EF;">
            <div style="background: #CEBCA6; padding: 20px; text-align: center;">
              <h1 style="color: #161411; margin: 0; font-size: 28px; font-weight: bold;">
                ATHENA BRAND
              </h1>
              <p style="color: #161411; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">
                MENOS RUIDO MAS ESENCIA
              </p>
            </div>
            
            <div style="padding: 30px; background: white; margin: 20px;">
              <h2 style="color: #161411; margin-bottom: 20px;">¡Hola ${data.firstName}!</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Gracias por unirte a la familia ATHENA BRAND. Para completar tu registro y 
                acceder a todas las funcionalidades de nuestra tienda, necesitas verificar tu email.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.verificationUrl}" 
                   style="background: #CEBCA6; color: #161411; padding: 15px 30px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block; text-transform: uppercase;">
                  VERIFICAR CUENTA
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Si no creaste esta cuenta, puedes ignorar este email.<br>
                Este enlace expira en 24 horas.
              </p>
            </div>
            
            <div style="background: #F4EBE0; padding: 20px; text-align: center; color: #666;">
              <p style="margin: 0; font-size: 12px;">
                ATHENA BRAND - San Pedro, Antioquia, Colombia<br>
                Instagram: @athena.brand.co
              </p>
            </div>
          </div>
        `,
      };

    case "password-reset":
      return {
        subject: "Resetear contraseña - ATHENA BRAND",
        html: `
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #F5F2EF;">
            <div style="background: #CEBCA6; padding: 20px; text-align: center;">
              <h1 style="color: #161411; margin: 0; font-size: 28px; font-weight: bold;">
                ATHENA BRAND
              </h1>
              <p style="color: #161411; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">
                MENOS RUIDO MAS ESENCIA
              </p>
            </div>
            
            <div style="padding: 30px; background: white; margin: 20px;">
              <h2 style="color: #161411; margin-bottom: 20px;">Hola ${data.firstName},</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Recibimos una solicitud para resetear la contraseña de tu cuenta. 
                Si fuiste tú, haz clic en el botón de abajo para crear una nueva contraseña.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.resetUrl}" 
                   style="background: #CEBCA6; color: #161411; padding: 15px 30px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block; text-transform: uppercase;">
                  RESETEAR CONTRASEÑA
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px;">
                Si no solicitaste este cambio, puedes ignorar este email.<br>
                Este enlace expira en 10 minutos por seguridad.
              </p>
            </div>
            
            <div style="background: #F4EBE0; padding: 20px; text-align: center; color: #666;">
              <p style="margin: 0; font-size: 12px;">
                ATHENA BRAND - San Pedro, Antioquia, Colombia<br>
                Instagram: @athena.brand.co
              </p>
            </div>
          </div>
        `,
      };

    case "order-confirmation":
      const itemsHtml = data.items
        .map(
          (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <strong>${item.productSnapshot.name}</strong><br>
            <small style="color: #666;">Talla: ${item.size} | Cantidad: ${item.quantity}</small>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
            $${item.subtotal.toLocaleString("es-CO")}
          </td>
        </tr>
      `,
        )
        .join("");

      return {
        subject: `Pedido confirmado #${data.order.orderNumber} - ATHENA BRAND`,
        html: `
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #F5F2EF;">
            <div style="background: #CEBCA6; padding: 20px; text-align: center;">
              <h1 style="color: #161411; margin: 0; font-size: 28px; font-weight: bold;">
                ATHENA BRAND
              </h1>
              <p style="color: #161411; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">
                MENOS RUIDO MAS ESENCIA
              </p>
            </div>
            
            <div style="padding: 30px; background: white; margin: 20px;">
              <h2 style="color: #161411; margin-bottom: 20px;">¡Gracias por tu pedido, ${data.customerName}!</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Tu pedido <strong>#${data.order.orderNumber}</strong> ha sido recibido y está siendo procesado.
                Te enviaremos actualizaciones sobre el estado de tu envío.
              </p>
              
              <div style="background: #F4EBE0; padding: 20px; margin: 25px 0; border-radius: 5px;">
                <h3 style="color: #161411; margin-top: 0;">Resumen del pedido:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  ${itemsHtml}
                  <tr style="font-weight: bold; background: #F5F2EF;">
                    <td style="padding: 15px;">Total:</td>
                    <td style="padding: 15px; text-align: right;">$${data.order.pricing.total.toLocaleString("es-CO")}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.trackingUrl}" 
                   style="background: #CEBCA6; color: #161411; padding: 15px 30px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block; text-transform: uppercase;">
                  SEGUIR PEDIDO
                </a>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 25px;">
                <strong>Dirección de envío:</strong><br>
                ${data.order.shippingAddress.firstName} ${data.order.shippingAddress.lastName}<br>
                ${data.order.shippingAddress.street}<br>
                ${data.order.shippingAddress.city}, ${data.order.shippingAddress.department}
              </p>
            </div>
            
            <div style="background: #F4EBE0; padding: 20px; text-align: center; color: #666;">
              <p style="margin: 0; font-size: 12px;">
                ATHENA BRAND - San Pedro, Antioquia, Colombia<br>
                Instagram: @athena.brand.co | WhatsApp: +57 300 123 4567
              </p>
            </div>
          </div>
        `,
      };

    case "order-status-update":
      return {
        subject: `Actualización de pedido #${data.orderNumber} - ATHENA BRAND`,
        html: `
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #F5F2EF;">
            <div style="background: #CEBCA6; padding: 20px; text-align: center;">
              <h1 style="color: #161411; margin: 0; font-size: 28px; font-weight: bold;">
                ATHENA BRAND
              </h1>
            </div>
            
            <div style="padding: 30px; background: white; margin: 20px;">
              <h2 style="color: #161411; margin-bottom: 20px;">Hola ${data.customerName},</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                Tu pedido <strong>#${data.orderNumber}</strong> ha sido actualizado.
              </p>
              
              <div style="background: #F4EBE0; padding: 20px; margin: 25px 0; border-radius: 5px; text-align: center;">
                <h3 style="color: #161411; margin: 0 0 10px 0;">Estado actual:</h3>
                <span style="background: #CEBCA6; color: #161411; padding: 10px 20px; 
                             border-radius: 25px; font-weight: bold; text-transform: uppercase;">
                  ${data.statusText}
                </span>
              </div>
              
              ${
                data.trackingNumber
                  ? `
                <div style="margin: 25px 0;">
                  <p style="color: #666; margin-bottom: 10px;">
                    <strong>Número de seguimiento:</strong> ${data.trackingNumber}
                  </p>
                </div>
              `
                  : ""
              }
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.trackingUrl}" 
                   style="background: #CEBCA6; color: #161411; padding: 15px 30px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block; text-transform: uppercase;">
                  VER DETALLES
                </a>
              </div>
            </div>
          </div>
        `,
      };

    default:
      throw new Error(`Template '${template}' no encontrado`);
  }
};

// Función principal para enviar emails
const sendEmail = async ({ to, subject, template, data, html, text }) => {
  try {
    const transporter = createTransporter();

    let emailContent = {};

    if (template && data) {
      // Usar template predefinido
      const templateContent = getEmailTemplate(template, data);
      emailContent = {
        subject: templateContent.subject,
        html: templateContent.html,
      };
    } else {
      // Usar contenido personalizado
      emailContent = {
        subject,
        html: html || text,
        text,
      };
    }

    const mailOptions = {
      from: {
        name: "ATHENA BRAND",
        address: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      },
      to,
      ...emailContent,
      // Headers adicionales
      headers: {
        "X-Mailer": "ATHENA BRAND API",
        "X-Priority": "3",
      },
    };

    const result = await transporter.sendMail(mailOptions);

    console.log("✅ Email enviado exitosamente:", {
      to,
      subject: emailContent.subject,
      messageId: result.messageId,
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("❌ Error enviando email:", error);

    throw new Error(`Error enviando email: ${error.message}`);
  }
};

// Función para validar configuración de email
const validateEmailConfig = () => {
  const importdVars = ["EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS"];
  const missing = importdVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    console.warn("⚠️ Variables de email faltantes:", missing);
    return false;
  }

  return true;
};

// Función para enviar email de bienvenida
const sendWelcomeEmail = async (user) => {
  return sendEmail({
    to: user.email,
    template: "verification",
    data: {
      firstName: user.firstName,
      verificationToken: user.verificationToken,
      verificationUrl: `${process.env.FRONTEND_URL}/verificar-cuenta?token=${user.verificationToken}`,
    },
  });
};

export { sendEmail, validateEmailConfig, sendWelcomeEmail, getEmailTemplate };

export default {
  sendEmail,
  validateEmailConfig,
  sendWelcomeEmail,
  getEmailTemplate,
};
