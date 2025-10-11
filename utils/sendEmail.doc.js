```javascript
// ================================================================================
// DESCRIPCIÓN GENERAL DEL ARCHIVO:
// Este módulo implementa un sistema completo de envío de emails para ATHENA BRAND
// usando Nodemailer. Proporciona funciones para:
// - Configurar transporter SMTP (Gmail y otros proveedores)
// - Generar templates HTML para emails (verificación, reset, pedidos, etc.)
// - Enviar emails con templates predefinidos o contenido personalizado
// - Validar configuración y manejar errores
// ================================================================================

// utils/sendEmail.js - Utilidad para envío de emails
const nodemailer = require('nodemailer'); // Importa la librería Nodemailer para envío de emails

// Configuración del transporter
const createTransporter = () => { // Función que crea y configura el objeto transporter para envío de emails
  // Configuración para Gmail (cambiar según tu proveedor)
  return nodemailer.createTransporter({ // Crea una instancia de transporter con configuración SMTP
    host: process.env.EMAIL_HOST || 'smtp.gmail.com', // Servidor SMTP, por defecto Gmail
    port: parseInt(process.env.EMAIL_PORT) || 587, // Puerto SMTP, 587 para STARTTLS
    secure: false, // false para puerto 587 (STARTTLS), true solo para puerto 465 (SSL)
    auth: { // Credenciales de autenticación
      user: process.env.EMAIL_USER, // Usuario/email para autenticación SMTP
      pass: process.env.EMAIL_PASS // Contraseña o App Password para Gmail
    },
    tls: { // Configuración TLS/SSL
      rejectUnauthorized: false // ⚠️ CRÍTICO: Permite certificados no autorizados (INSEGURO)
    }
  });
};

// Templates de email
const getEmailTemplate = (template, data) => { // Función que genera templates HTML basados en el tipo solicitado
  switch (template) { // Evalúa el tipo de template solicitado
    case 'verification': // Template para verificación de cuenta
      return { // Retorna objeto con subject y HTML del email
        subject: 'Verificar cuenta - ATHENA BRAND', // Asunto del email de verificación
        html: ` // HTML del email (inicio de template string)
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #F5F2EF;"> // Contenedor principal con estilos inline
            <div style="background: #CEBCA6; padding: 20px; text-align: center;"> // Header con colores de marca
              <h1 style="color: #161411; margin: 0; font-size: 28px; font-weight: bold;"> // Título principal
                ATHENA BRAND
              </h1>
              <p style="color: #161411; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;"> // Slogan de la marca
                MENOS RUIDO MAS ESENCIA
              </p>
            </div>
            
            <div style="padding: 30px; background: white; margin: 20px;"> // Cuerpo principal del email
              <h2 style="color: #161411; margin-bottom: 20px;">¡Hola ${data.firstName}!</h2> // ⚠️ XSS: Interpolación sin sanitizar
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;"> // Párrafo explicativo
                Gracias por unirte a la familia ATHENA BRAND. Para completar tu registro y 
                acceder a todas las funcionalidades de nuestra tienda, necesitas verificar tu email.
              </p>
              
              <div style="text-align: center; margin: 30px 0;"> // Contenedor del botón
                <a href="${data.verificationUrl}"  // ⚠️ URL INJECTION: URL sin validar
                   style="background: #CEBCA6; color: #161411; padding: 15px 30px;  // Estilos del botón
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block; text-transform: uppercase;">
                  VERIFICAR CUENTA // Texto del botón
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px;"> // Texto de disclaimer
                Si no creaste esta cuenta, puedes ignorar este email.<br>
                Este enlace expira en 24 horas.
              </p>
            </div>
            
            <div style="background: #F4EBE0; padding: 20px; text-align: center; color: #666;"> // Footer
              <p style="margin: 0; font-size: 12px;"> // Información de contacto
                ATHENA BRAND - San Pedro, Antioquia, Colombia<br>
                Instagram: @athena.brand.co
              </p>
            </div>
          </div>
        ` // Fin del HTML template
      };

    case 'password-reset': // Template para reseteo de contraseña
      return { // Retorna objeto con configuración del email
        subject: 'Resetear contraseña - ATHENA BRAND', // Asunto del email
        html: ` // Inicio del HTML template
          <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background: #F5F2EF;"> // Contenedor principal
            <div style="background: #CEBCA6; padding: 20px; text-align: center;"> // Header
              <h1 style="color: #161411; margin: 0; font-size: 28px; font-weight: bold;"> // Logo/título
                ATHENA BRAND
              </h1>
              <p style="color: #161411; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;"> // Slogan
                MENOS RUIDO MAS ESENCIA
              </p>
            </div>
            
            <div style="padding: 30px; background: white; margin: 20px;"> // Cuerpo del email
              <h2 style="color: #161411; margin-bottom: 20px;">Hola ${data.firstName},</h2> // ⚠️ XSS: Sin sanitización
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 25px;"> // Mensaje explicativo
                Recibimos una solicitud para resetear la contraseña de tu cuenta. 
                Si fuiste tú, haz clic en el botón de abajo para crear una nueva contraseña.
              </p>
              
              <div style="text-align: center; margin: 30px 0;"> // Contenedor del botón
                <a href="${data.resetUrl}"  // ⚠️ URL INJECTION: URL sin validar
                   style="background: #CEBCA6; color: #161411; padding: 15px 30px;  // Estilos del botón
                          text-decoration: none; border-radius: 5px; font-weight: bold;
                          display: inline-block; text-transform: uppercase;">
                  RESETEAR CONTRASEÑA // Texto del botón
                </a>
              </div>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px;"> // Información de seguridad
                Si no solicitaste este cambio, puedes ignorar este email.<br>
                Este enlace expira en 10 minutos por seguridad.
              